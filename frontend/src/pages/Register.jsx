import { useState } from "react";
import api from "../services/api";

export default function Register({ onBack, onHome }) {
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");

    const handleRegister = async () => {
        setError("");

        try {
            await api.post("register/", { username, email, password });
            onBack();
        } catch {
            setError("Eroare la creare cont");
        }
    };

    return (
        <div style={styles.container}>
            <div style={styles.card}>

                <div style={styles.icon}>📝</div>

                <h2 style={styles.title}>Creează cont</h2>

                <input
                    style={styles.input}
                    placeholder="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                />

                <input
                    style={styles.input}
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                />

                <input
                    style={styles.input}
                    type="password"
                    placeholder="Parolă"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />

                {error && (
                    <div style={styles.errorBox}>
                        ❌ {error}
                    </div>
                )}

                <button
                    onClick={handleRegister}
                    style={styles.primaryButton}
                >
                    Creează cont
                </button>

                <div style={styles.separator} />

                <div style={styles.bottomActions}>
                    <button
                        onClick={onBack}
                        style={styles.linkBlue}
                    >
                        ⬅ Înapoi
                    </button>

                    <button
                        onClick={onHome}
                        style={styles.linkGray}
                    >
                        🏠 Home
                    </button>
                </div>

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
        width: "100%",
        maxWidth: "400px",
        boxShadow: "0 20px 50px rgba(0,0,0,0.08)",
        textAlign: "center",
    },
    icon: {
        fontSize: "42px",
        marginBottom: "15px",
    },
    title: {
        fontSize: "24px",
        fontWeight: "700",
        marginBottom: "25px",
    },
    input: {
        width: "100%",
        padding: "14px",
        borderRadius: "14px",
        border: "1px solid #E5E5EA",
        marginBottom: "14px",
        fontSize: "15px",
        background: "#F9F9FB",
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
    errorBox: {
        marginTop: "10px",
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
};
