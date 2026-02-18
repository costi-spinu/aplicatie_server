/* ==========================
   STIL iOS 17 GLOBAL
========================== */

const baseFont = "-apple-system, BlinkMacSystemFont, sans-serif";

const styles = {
    container: {
        maxWidth: "520px",
        margin: "40px auto",
        padding: "20px",
        fontFamily: baseFont,
        background: "#F2F2F7",
        minHeight: "100vh",
    },

    // Reusable centered layout for auth/home pages
    centerContainer: {
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#F2F2F7",
        padding: "20px",
        fontFamily: baseFont,
    },
    centerCard: {
        background: "white",
        borderRadius: "28px",
        padding: "40px",
        width: "100%",
        maxWidth: "420px",
        boxShadow: "0 20px 50px rgba(0,0,0,0.08)",
        textAlign: "center",
    },

    title: {
        fontSize: "28px",
        fontWeight: "700",
        marginBottom: "20px",
    },
    heroCard: {
        background: "linear-gradient(135deg, #34C759, #30B0C7)",
        color: "white",
        borderRadius: "24px",
        padding: "30px",
        marginBottom: "25px",
        boxShadow: "0 20px 40px rgba(0,0,0,0.15)",
    },
    heroLabel: { fontSize: "16px", opacity: 0.9 },
    heroValue: {
        fontSize: "36px",
        fontWeight: "700",
        marginTop: "10px",
    },
    card: {
        background: "white",
        borderRadius: "20px",
        padding: "20px",
        marginBottom: "20px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
    },
    sectionTitle: {
        marginBottom: "15px",
        fontWeight: "600",
    },
    input: {
        width: "90%",
        padding: "12px",
        borderRadius: "14px",
        border: "1px solid #E5E5EA",
        marginBottom: "12px",
        fontSize: "16px",
        background: "#F9F9FB",
    },
    blueButton: {
        width: "95%",
        padding: "14px",
        borderRadius: "16px",
        border: "none",
        background: "#0A84FF",
        color: "white",
        fontWeight: "600",
        fontSize: "16px",
        cursor: "pointer",
    },
    greenButton: {
        width: "95%",
        padding: "14px",
        borderRadius: "16px",
        border: "none",
        background: "#34C759",
        color: "white",
        fontWeight: "600",
        fontSize: "16px",
        cursor: "pointer",
    },

    // Auth/Home reusable elements
    authIcon: {
        fontSize: "42px",
        marginBottom: "15px",
    },
    authTitle: {
        fontSize: "24px",
        fontWeight: "700",
        marginBottom: "16px",
    },
    authSubtitle: {
        fontSize: "14px",
        color: "#8E8E93",
        marginBottom: "25px",
    },
    authInput: {
        width: "100%",
        padding: "14px",
        borderRadius: "14px",
        border: "1px solid #E5E5EA",
        marginBottom: "14px",
        fontSize: "15px",
        background: "#F9F9FB",
        boxSizing: "border-box",
    },
    primaryButton: {
        width: "100%",
        padding: "15px",
        borderRadius: "18px",
        border: "none",
        background: "linear-gradient(135deg, #0A84FF, #5E5CE6)",
        color: "white",
        fontWeight: "600",
        fontSize: "16px",
        cursor: "pointer",
        marginTop: "10px",
        boxShadow: "0 10px 25px rgba(10,132,255,0.3)",
    },
    messageBox: {
        marginTop: "15px",
        padding: "12px",
        borderRadius: "12px",
        fontSize: "14px",
    },
    errorBox: {
        marginTop: "12px",
        marginBottom: "10px",
        padding: "12px",
        borderRadius: "12px",
        background: "#FFE5E5",
        color: "#FF3B30",
        fontSize: "14px",
    },
    separator: {
        height: "1px",
        background: "#E5E5EA",
        margin: "25px 0",
    },
    secondaryButton: {
        width: "100%",
        padding: "12px",
        borderRadius: "14px",
        border: "none",
        background: "#E5E5EA",
        fontWeight: "500",
        cursor: "pointer",
        marginBottom: "10px",
    },
    linkButton: {
        background: "none",
        border: "none",
        color: "#0A84FF",
        fontSize: "14px",
        cursor: "pointer",
        marginBottom: "10px",
    },
    backButton: {
        background: "none",
        border: "none",
        color: "#8E8E93",
        fontSize: "14px",
        cursor: "pointer",
    },
    bottomActions: {
        display: "flex",
        justifyContent: "space-between",
        fontSize: "14px",
    },
    linkBlue: {
        background: "none",
        border: "none",
        color: "#0A84FF",
        cursor: "pointer",
    },
    linkGray: {
        background: "none",
        border: "none",
        color: "#8E8E93",
        cursor: "pointer",
    },

    homeHeroIcon: {
        fontSize: "52px",
        marginBottom: "20px",
    },
    homeSubtitle: {
        fontSize: "16px",
        color: "#636366",
        lineHeight: 1.5,
        marginBottom: "25px",
    },
    homeFooter: {
        fontSize: "13px",
        color: "#8E8E93",
        marginBottom: "30px",
    },

    row: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "14px 0",
        borderBottom: "1px solid #F0F0F5",
        cursor: "pointer",
    },
    activeRow: {
        background: "#E6F9ED",
        borderRadius: "12px",
    },
    selectedCard: {
        background: "#b4b4b4",
        color: "white",
        borderRadius: "18px",
        padding: "10px",
        marginBottom: "20px",
        boxShadow: "0 8px 20px rgba(52,199,89,0.25)",
    },
    selectedLabel: { fontSize: "13px", opacity: 0.9 },
    selectedValue: {
        fontSize: "18px",
        fontWeight: "600",
        marginTop: "6px",
    },
    amount: { fontWeight: "600", fontSize: "16px" },
    date: { fontSize: "13px", color: "#8E8E93" },
    updated: { fontSize: "11px", color: "#C7C7CC" },
    deleteBtn: {
        border: "none",
        background: "transparent",
        fontSize: "18px",
        color: "#FF3B30",
        cursor: "pointer",
    },
    message: {
        textAlign: "center",
        marginBottom: "15px",
        fontWeight: "500",
    },
};

export default styles;
