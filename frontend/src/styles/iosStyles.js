/* ==========================
   STIL iOS 17 GLOBAL
========================== */

const styles = {
    container: {
        maxWidth: "520px",
        margin: "40px auto",
        padding: "20px",
        fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
        background: "#F2F2F7",
        minHeight: "100vh",
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
