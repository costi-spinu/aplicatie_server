import { useState } from "react";
import axios from "axios";
import Register from "./Register";
import ResetParola from "./ResetParola";
import styles from "../styles/iosStyles";

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
        <div style={styles.centerContainer}>
            <div style={styles.centerCard}>
                <div style={styles.authIcon}>🔐</div>

                <h2 style={styles.authTitle}>Autentificare</h2>

                <input
                    style={styles.authInput}
                    placeholder="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                />

                <input
                    style={styles.authInput}
                    type="password"
                    placeholder="Parolă"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />

                <button
                    onClick={handleLogin}
                    style={styles.primaryButton}
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
