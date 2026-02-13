export default function Home({ onLoginClick }) {
    return (
        <div style={styles.container}>
            <div style={styles.card}>

                {/* HERO ICON */}
                <div style={styles.heroIcon}>
                    🏡
                </div>

                <h1 style={styles.title}>
                    Aplicație de casă
                </h1>

                <p style={styles.subtitle}>
                    Gestionare venituri, cheltuieli, economii și fonduri
                    într-un mod simplu și elegant.
                </p>

                <div style={styles.separator} />

                <p style={styles.footer}>
                    Made with ❤️ by Costi
                </p>

                <button
                    onClick={onLoginClick}
                    style={styles.loginButton}
                >
                    🔐 Autentificare
                </button>

            </div>
        </div>
    );
}

//////////////////////////////////////////////////////
// STIL iOS 17
//////////////////////////////////////////////////////

const styles = {
    container: {
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#F2F2F7",
        padding: "20px",
        fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
    },
    card: {
        background: "white",
        borderRadius: "28px",
        padding: "40px",
        maxWidth: "420px",
        width: "100%",
        textAlign: "center",
        boxShadow: "0 20px 50px rgba(0,0,0,0.08)",
    },
    heroIcon: {
        fontSize: "52px",
        marginBottom: "20px",
    },
    title: {
        fontSize: "28px",
        fontWeight: "700",
        marginBottom: "15px",
    },
    subtitle: {
        fontSize: "16px",
        color: "#636366",
        lineHeight: 1.5,
        marginBottom: "25px",
    },
    separator: {
        height: "1px",
        background: "#E5E5EA",
        margin: "25px 0",
    },
    footer: {
        fontSize: "13px",
        color: "#8E8E93",
        marginBottom: "30px",
    },
    loginButton: {
        width: "100%",
        padding: "16px",
        borderRadius: "18px",
        border: "none",
        background: "linear-gradient(135deg, #0A84FF, #5E5CE6)",
        color: "white",
        fontWeight: "600",
        fontSize: "17px",
        cursor: "pointer",
        boxShadow: "0 10px 25px rgba(10,132,255,0.3)",
        transition: "transform 0.1s ease",
    },
};
