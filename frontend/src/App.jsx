import { useState, useEffect } from "react";
import api from "./services/api";

import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ResetParola from "./pages/ResetParola";

import Venit from "./pages/Venit";
import Cheltuieli from "./pages/Cheltuieli";
import Economii from "./pages/Economii";
import AdminPanel from "./pages/AdminPanel";
import DiagramaLunara from "./pages/DiagramaLunara";
import Sidebar from "./components/Sidebar";
import Fonduri from "./pages/Fonduri";
import GraficeFonduri from "./pages/GraficeFonduri";
import ProfilUtilizator from "./pages/ProfilUtilizator";
import Realizari from "./pages/Realizari";

function App() {
  const [activePage, setActivePage] = useState(null);
  const [showSidebar, setShowSidebar] = useState(true);

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authView, setAuthView] = useState("home");

  const [theme, setTheme] = useState(
    localStorage.getItem("theme") || "light"
  );

  const loggedIn = Boolean(localStorage.getItem("access"));

  // THEME
  useEffect(() => {
    const root = document.documentElement;
    theme === "dark"
      ? root.classList.add("dark")
      : root.classList.remove("dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  // AUTH CHECK
  useEffect(() => {
    if (!loggedIn) {
      setUser(null);
      setLoading(false);
      return;
    }

    api
      .get("me/")
      .then((res) => setUser(res.data))
      .catch(() => {
        localStorage.clear();
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, [loggedIn]);

  const isAdmin =
    user?.is_admin === true || user?.is_superuser === true;

  const logout = () => {
    localStorage.clear();
    setUser(null);
    setAuthView("home");
    setActivePage(null);
    setShowSidebar(true);
  };

  const handleOpenPage = (pageKey) => {
    setActivePage(pageKey);
    setShowSidebar(false);
  };

  const handleBack = () => {
    setActivePage(null);
    setShowSidebar(true);
  };

  if (loading) {
    return (
      <div style={styles.loading}>
        ⏳ Se încarcă...
      </div>
    );
  }

  // =========================
  // NELOGAT
  // =========================
  if (!user) {
    if (authView === "home")
      return <Home onLoginClick={() => setAuthView("login")} />;

    if (authView === "login")
      return (
        <Login
          onLogin={() => setAuthView("home")}
          onBack={() => setAuthView("home")}
        />
      );

    if (authView === "register")
      return <Register onBack={() => setAuthView("login")} />;

    if (authView === "reset")
      return <ResetParola onBack={() => setAuthView("login")} />;

    return null;
  }

  // =========================
  // LOGAT
  // =========================
  return (
    <div style={styles.appContainer}>

      {showSidebar && (
        <Sidebar
          setPage={handleOpenPage}
          isAdmin={isAdmin}
          logout={logout}
          theme={theme}
          setTheme={setTheme}
          user={user}   // 🔥 ADAUGĂ ASTA
        />
      )}

      {!showSidebar && (
        <div style={styles.pageContainer}>

          {/* 🔵 iOS NAV BAR */}
          <div style={styles.navBar}>
            <button onClick={handleBack} style={styles.backButton}>
              <span style={styles.backArrow}>‹</span>
              Înapoi
            </button>
          </div>

          <div style={styles.pageContent}>
            {activePage === "venit" && <Venit />}
            {activePage === "cheltuieli" && <Cheltuieli />}
            {activePage === "economii" && <Economii />}
            {activePage === "diagrama" && <DiagramaLunara />}
            {activePage === "fonduri" && <Fonduri />}
            {/* {activePage === "grafice-fonduri" && <GraficeFonduri />} */}
            {activePage === "realizari" && <Realizari />}
            {activePage === "admin" && isAdmin && <AdminPanel />}
            {activePage === "profil" && !isAdmin && <ProfilUtilizator />}

          </div>

        </div>
      )}
    </div>
  );
}

//////////////////////////////////////////////////////
// 🎨 STIL iOS 17 PREMIUM
//////////////////////////////////////////////////////

const styles = {
  appContainer: {
    minHeight: "100vh",
    background: "#F2F2F7",
    fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
  },

  pageContainer: {
    minHeight: "100vh",
  },

  navBar: {
    position: "sticky",
    top: 0,
    background: "rgba(255,255,255,0.85)",
    backdropFilter: "blur(14px)",
    borderBottom: "1px solid #E5E5EA",
    padding: "12px 20px",
    display: "flex",
    alignItems: "center",
  },

  backButton: {
    background: "none",
    border: "none",
    color: "#0A84FF",
    fontSize: "17px",
    fontWeight: "500",
    display: "flex",
    alignItems: "center",
    cursor: "pointer",
  },

  backArrow: {
    fontSize: "28px",
    marginRight: "4px",
    lineHeight: 1,
  },

  pageContent: {
    padding: "20px",
  },

  loading: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
    background: "#F2F2F7",
  },
};

export default App;
