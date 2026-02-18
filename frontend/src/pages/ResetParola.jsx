import { useState } from "react";
import axios from "axios";
import styles from "../styles/iosStyles";

export default function ResetParola({ onBack, onHome }) {
    const [email, setEmail] = useState("");
    const [msg, setMsg] = useState("");
    const [isError, setIsError] = useState(false);

    const trimite = async () => {
        setMsg("");
        setIsError(false);

        try {
            await axios.post(
                "http://127.0.0.1:8000/password-reset/",
                { email }
            );

            setMsg("Verifică emailul pentru resetare");
            setIsError(false);
        } catch {
            setMsg("Email invalid");
            setIsError(true);
        }
    };

    return (
        <div style={styles.centerContainer}>
            <div style={styles.centerCard}>
                <div style={styles.authIcon}>🔑</div>

                <h2 style={styles.authTitle}>Resetare parolă</h2>

                <p style={styles.authSubtitle}>
                    Introdu adresa de email pentru a primi linkul de resetare.
                </p>

                <input
                    style={styles.authInput}
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                />

                <button
                    onClick={trimite}
                    style={styles.primaryButton}
                >
                    Trimite link
                </button>

                {msg && (
                    <div
                        style={{
                            ...styles.messageBox,
                            background: isError ? "#FFE5E5" : "#E6F9ED",
                            color: isError ? "#FF3B30" : "#34C759",
                        }}
                    >
                        {isError ? "❌ " : "📧 "} {msg}
                    </div>
                )}

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
