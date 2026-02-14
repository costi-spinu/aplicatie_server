import { useState } from "react";

export default function Sidebar({
    setPage,
    isAdmin,
    logout,
    theme,
    setTheme,
    user, // 🔥 primim user-ul
}) {
    const [active, setActive] = useState(null);

    const navItems = [
        { key: "venit", label: "Venit" },
        { key: "status-venit", label: "Status Venit" },
        { key: "cheltuieli", label: "Cheltuieli" },
        { key: "grafice", label: "Grafic cheltuieli" },
        { key: "economii", label: "Economii / Vacanță" },
        { key: "diagrama", label: "Diagramă luna în curs" },
        { key: "fonduri", label: "Fonduri investiții" },
        { key: "grafice-fonduri", label: "Grafice Fonduri" },
    ];

    if (isAdmin) {
        navItems.push({ key: "admin", label: "Admin" });
    } else {
        navItems.push({ key: "profil", label: "Profil utilizator" });
    }

    const handleClick = (key) => {
        setActive(key);
        setPage(key);
    };

    return (
        <div style={styles.container}>
            {/* HERO CARD */}
            <div style={styles.heroCard}>

                {/* 🔥 WELCOME TEXT */}
                <div style={styles.welcomeText}>
                    Bine ai venit,
                    <span style={styles.username}>
                        {" "}{user?.username}
                    </span>
                </div>

                <div style={styles.heroLabel}>💰</div>
                <div style={styles.heroTitle}>Budget App</div>
            </div>

            {/* NAVIGATION CARD */}
            <div style={styles.card}>
                {navItems.map((item, index) => (
                    <div
                        key={item.key}
                        onClick={() => handleClick(item.key)}
                        style={{
                            ...styles.row,
                            ...(active === item.key
                                ? styles.activeRow
                                : {}),
                            borderBottom:
                                index !== navItems.length - 1
                                    ? "1px solid #eee"
                                    : "none",
                        }}
                    >
                        <span>{item.label}</span>
                        <span style={styles.chevron}>›</span>
                    </div>
                ))}
            </div>

            {/* SETTINGS CARD */}
            <div style={styles.card}>
                <div
                    onClick={() =>
                        setTheme(theme === "dark" ? "light" : "dark")
                    }
                    style={styles.row}
                >
                    <span>
                        {theme === "dark"
                            ? "☀️ Light Mode"
                            : "🌙 Dark Mode"}
                    </span>
                </div>

                <div
                    onClick={logout}
                    style={{
                        ...styles.row,
                        color: "#FF3B30",
                    }}
                >
                    Logout
                </div>
            </div>
        </div>
    );
}

//////////////////////////////////////////////////////
// 🎨 STIL iOS 17 PREMIUM
//////////////////////////////////////////////////////

const fontStack =
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

const styles = {
    container: {
        maxWidth: "500px",
        margin: "40px auto",
        padding: "10px",
        fontFamily: fontStack,
        background: "#F2F2F7",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
    },

    heroCard: {
        background: "linear-gradient(135deg, #0A84FF, #5E5CE6)",
        borderRadius: "24px",
        padding: "20px",
        marginBottom: "25px",
        boxShadow: "0 20px 40px rgba(0,0,0,0.15)",
        width: "100%",
        maxWidth: "600px",
        color: "white",
    },

    welcomeText: {
        fontSize: "14px",
        fontWeight: "400",
        opacity: 0.9,
    },

    username: {
        fontWeight: "600",
    },

    heroLabel: {
        fontSize: "48px",
        opacity: 0.95,
        marginTop: "12px",
    },

    heroTitle: {
        fontSize: "16px",
        fontWeight: "500",
        marginTop: "12px",
    },

    card: {
        background: "white",
        borderRadius: "20px",
        padding: "20px",
        marginBottom: "20px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
        width: "100%",
        maxWidth: "600px",
    },

    row: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "16px 18px",
        cursor: "pointer",
        fontSize: "15px",
        fontWeight: "400",
        transition: "background 0.15s ease",
    },

    activeRow: {
        background: "#E5F0FF",
        color: "#0A84FF",
        fontWeight: "600",
        borderRadius: "12px",
    },

    chevron: {
        fontSize: "18px",
        color: "#C7C7CC",
    },
};
