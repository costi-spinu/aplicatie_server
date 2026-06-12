import { useState } from "react";
import AppControls from "./AppControls";
import InstallAppButton from "./InstallAppButton";

export default function Sidebar({ setPage, isAdmin, logout, user }) {
  const [active, setActive] = useState(null);
  const profilePhoto = user?.profile?.poza;
  const displayName =
    [user?.first_name, user?.last_name].filter(Boolean).join(" ") ||
    user?.username ||
    "-";

  const navItems = [
    { key: "venit", label: "Venit" },
    { key: "cheltuieli", label: "Cheltuieli" },
    { key: "economii", label: "Economii si vacanta" },
    { key: "fonduri", label: "Fonduri investitii" },
    { key: "realizari", label: "Obiective cheltuieli" },
    { key: "profil", label: "Profil utilizator" },
  ];

  if (isAdmin) {
    navItems.push({ key: "admin", label: "Administrare" });
  }

  const handleClick = (key) => {
    setActive(key);
    setPage(key);
  };

  return (
    <div style={styles.page}>
      <div style={styles.shell}>
        <header style={styles.header}>
          <div style={styles.brandBlock}>
            {profilePhoto && (
              <img src={profilePhoto} alt="Profil" style={styles.avatar} />
            )}
            <div>
              <div style={styles.appName}>Buget & Economii</div>
              <div style={styles.userLine}>Cont: {displayName}</div>
            </div>
          </div>
          <div style={styles.headerActions}>
            <InstallAppButton />
            <AppControls />
            <button onClick={logout} style={styles.logoutButton}>
              Logout
            </button>
          </div>
        </header>

        <section style={styles.panel}>
          <div style={styles.panelHeader}>
            <h1 style={styles.title}>Meniu principal</h1>
            <span style={styles.subtitle}>Planificare financiara personala</span>
          </div>
          <div style={styles.navList}>
            {navItems.map((item) => (
              <button
                key={item.key}
                onClick={() => handleClick(item.key)}
                style={{
                  ...styles.navButton,
                  ...(active === item.key ? styles.navButtonActive : {}),
                }}
              >
                <span>{item.label}</span>
                <span style={styles.navAction}>Deschide</span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "var(--app-page)",
    padding: "24px",
    fontFamily: "'Segoe UI', Arial, sans-serif",
    color: "var(--app-text)",
  },
  shell: {
    width: "100%",
    maxWidth: 1040,
    margin: "0 auto",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    background: "var(--app-panel)",
    border: "1px solid var(--app-border)",
    borderTop: "4px solid var(--app-primary)",
    borderRadius: 6,
    padding: "16px 18px",
    marginBottom: 18,
  },
  appName: {
    fontSize: 23,
    fontWeight: 800,
    marginBottom: 4,
  },
  brandBlock: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    minWidth: 0,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 4,
    objectFit: "cover",
    border: "1px solid var(--app-border)",
    background: "var(--app-panel-alt)",
    flexShrink: 0,
  },
  userLine: {
    fontSize: 14,
    color: "var(--app-muted)",
  },
  headerActions: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  logoutButton: {
    border: "1px solid var(--app-border)",
    background: "var(--app-panel-alt)",
    color: "var(--app-text)",
    borderRadius: 4,
    padding: "7px 9px",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
  },
  panel: {
    background: "var(--app-panel)",
    border: "1px solid var(--app-border)",
    borderRadius: 6,
    padding: 18,
  },
  panelHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: 16,
    marginBottom: 14,
  },
  title: {
    margin: 0,
    fontSize: 22,
    lineHeight: 1.2,
  },
  subtitle: {
    color: "var(--app-muted)",
    fontSize: 14,
  },
  navList: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 10,
  },
  navButton: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    border: "1px solid var(--app-border)",
    background: "var(--app-panel-alt)",
    color: "var(--app-text)",
    borderRadius: 4,
    padding: "14px 16px",
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
    textAlign: "left",
  },
  navButtonActive: {
    background: "var(--app-primary-soft)",
    borderColor: "var(--app-primary)",
    color: "var(--app-primary-dark)",
  },
  navAction: {
    fontSize: 12,
    color: "var(--app-muted)",
    fontWeight: 700,
  },
};
