import { useCallback, useEffect, useRef, useState } from "react";
import api from "./services/api";
import {
  clearApiDataCache,
  clearStoredAuthTokens,
  preloadApiData,
} from "./services/apiConfig";
import { PAGE_PRELOAD_ENDPOINTS } from "./services/preloadEndpoints";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ResetParola from "./pages/ResetParola";
import Venit from "./pages/Venit";
import Cheltuieli from "./pages/Cheltuieli";
import Economii from "./pages/Economii";
import AdminPanel from "./pages/AdminPanel";
import Sidebar from "./components/Sidebar";
import Fonduri from "./pages/Fonduri";
import ProfilUtilizator from "./pages/ProfilUtilizator";
import Realizari from "./pages/Realizari";
import AppControls from "./components/AppControls";
import InstallAppButton from "./components/InstallAppButton";

function App() {
  const [activePage, setActivePage] = useState(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [loggedIn, setLoggedIn] = useState(() =>
    Boolean(localStorage.getItem("access"))
  );
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(loggedIn);
  const [pageLoading, setPageLoading] = useState(false);
  const [authView, setAuthView] = useState("home");
  const openPageRequestId = useRef(0);

  const resetAuthState = useCallback(() => {
    openPageRequestId.current += 1;
    clearApiDataCache();
    setLoggedIn(false);
    setUser(null);
    setAuthView("home");
    setActivePage(null);
    setShowSidebar(true);
    setPageLoading(false);
    setLoading(false);
  }, []);

  const loadCurrentUser = useCallback(async () => {
    try {
      const res = await api.get("me/");
      setUser(res.data);
      setLoggedIn(true);
    } catch {
      clearStoredAuthTokens();
      resetAuthState();
    } finally {
      setLoading(false);
    }
  }, [resetAuthState]);

  useEffect(() => {
    if (!loggedIn) {
      setLoading(false);
      return;
    }

    loadCurrentUser();
  }, [loadCurrentUser, loggedIn]);

  useEffect(() => {
    const handleProfileUpdated = (event) => {
      if (event.detail) {
        setUser((current) => ({
          ...current,
          ...event.detail,
          is_admin: current?.is_admin ?? event.detail?.is_admin,
          is_superuser: current?.is_superuser ?? event.detail?.is_superuser,
        }));
      }

      void loadCurrentUser();
    };

    window.addEventListener("profile-updated", handleProfileUpdated);
    return () =>
      window.removeEventListener("profile-updated", handleProfileUpdated);
  }, [loadCurrentUser]);

  useEffect(() => {
    window.addEventListener("auth-expired", resetAuthState);
    return () => window.removeEventListener("auth-expired", resetAuthState);
  }, [resetAuthState]);

  const handleLoginSuccess = async () => {
    setLoading(true);
    await loadCurrentUser();
    setAuthView("home");
  };

  const isAdmin = user?.is_admin === true || user?.is_superuser === true;

  const logout = () => {
    clearStoredAuthTokens();
    resetAuthState();
  };

  const handleOpenPage = async (pageKey) => {
    const requestId = openPageRequestId.current + 1;
    openPageRequestId.current = requestId;
    setActivePage(null);
    setShowSidebar(false);
    setPageLoading(true);
    await preloadApiData(PAGE_PRELOAD_ENDPOINTS[pageKey] || []);
    if (openPageRequestId.current !== requestId) return;
    setActivePage(pageKey);
    setPageLoading(false);
  };

  const handleBack = () => {
    openPageRequestId.current += 1;
    setActivePage(null);
    setShowSidebar(true);
    setPageLoading(false);
  };

  if (loading) {
    return <div style={styles.loading}>Se incarca...</div>;
  }

  if (!user) {
    if (authView === "home") {
      return <Home onLoginClick={() => setAuthView("login")} />;
    }

    if (authView === "login") {
      return (
        <Login onLogin={handleLoginSuccess} onBack={() => setAuthView("home")} />
      );
    }

    if (authView === "register") {
      return <Register onBack={() => setAuthView("login")} />;
    }

    if (authView === "reset") {
      return <ResetParola onBack={() => setAuthView("login")} />;
    }

    return null;
  }

  return (
    <div style={styles.appContainer}>
      {showSidebar && (
        <Sidebar
          setPage={handleOpenPage}
          isAdmin={isAdmin}
          logout={logout}
          user={user}
        />
      )}

      {!showSidebar && (
        <div style={styles.pageContainer}>
          <div style={styles.navBar}>
            <button onClick={handleBack} style={styles.backButton}>
              Inapoi
            </button>
            <div style={styles.navActions}>
              <InstallAppButton />
              <AppControls />
            </div>
          </div>
          <div style={styles.pageContent}>
            {pageLoading && <div style={styles.loading}>Se incarca datele...</div>}
            {activePage === "venit" && <Venit />}
            {activePage === "cheltuieli" && <Cheltuieli user={user} />}
            {activePage === "economii" && <Economii />}
            {activePage === "fonduri" && <Fonduri />}
            {activePage === "realizari" && <Realizari />}
            {activePage === "admin" && isAdmin && <AdminPanel />}
            {activePage === "profil" && <ProfilUtilizator />}
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  appContainer: {
    minHeight: "100vh",
    background: "var(--app-page)",
    fontFamily: "'Segoe UI', Arial, sans-serif",
    color: "var(--app-text)",
  },
  pageContainer: {
    minHeight: "100vh",
  },
  navBar: {
    position: "sticky",
    top: 0,
    background: "var(--app-panel)",
    borderBottom: "1px solid var(--app-border)",
    padding: "calc(10px + env(safe-area-inset-top, 0px)) 24px 10px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    zIndex: 10,
  },
  backButton: {
    background: "var(--app-panel)",
    border: "1px solid var(--app-border)",
    borderRadius: 4,
    color: "var(--app-text)",
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
    padding: "8px 12px",
  },
  navActions: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
    flexWrap: "wrap",
  },
  pageContent: {
    padding: "0 0 32px",
  },
  loading: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'Segoe UI', Arial, sans-serif",
    background: "var(--app-page)",
    color: "var(--app-text)",
  },
};

export default App;
