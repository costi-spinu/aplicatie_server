import { useState } from "react";
import axios from "axios";
import Register from "./Register";
import ResetParola from "./ResetParola";

export default function Login({ onLogin, onBack }) {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [view, setView] = useState("login"); // login | register | reset

    const handleLogin = async () => {
        setError("");

        try {
            const res = await axios.post(
                "http://127.0.0.1:8000/api/token/",
                { username, password }
            );

            localStorage.setItem("access", res.data.access);
            localStorage.setItem("refresh", res.data.refresh);

            onLogin();
        } catch {
            setError("Date de autentificare incorecte");
        }
    };

    if (view === "register") {
        return (
            <Register
                onBack={() => setView("login")}
                onHome={onBack}
            />
        );
    }

    if (view === "reset") {
        return (
            <ResetParola
                onBack={() => setView("login")}
                onHome={onBack}
            />
        );
    }

    return (
        <div style={styles.container}>
            <div style={styles.card}>

                <div style={styles.icon}>🔐</div>

                <h2 style={styles.title}>Autentificare</h2>

                <input
                    style={styles.input}
                    placeholder="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                />

                <input
                    style={styles.input}
                    type="password"
                    placeholder="Parolă"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />

                <button
                    onClick={handleLogin}
                    style={styles.loginButton}
                >
                    Login
                </button>

                {error && (
                    <div style={styles.errorBox}>
                        {error}
                    </div>
                )}

                <div style={styles.separator} />

                <button
                    onClick={() => setView("register")}
                    style={styles.secondaryButton}
                >
                    📝 Creează cont
                </button>

                <button
                    onClick={() => setView("reset")}
                    style={styles.linkButton}
                >
                    Ai uitat parola?
                </button>

                <button
                    onClick={onBack}
                    style={styles.backButton}
                >
                    ⬅ Înapoi la pagina principală
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
    loginButton: {
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
        marginTop: "15px",
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
};
