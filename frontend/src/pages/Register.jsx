import { useState } from "react";
import api from "../services/api";
import styles from "../styles/iosStyles";

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
    <div style={styles.centerContainer}>
      <div style={styles.centerCard}>
        <h2 style={styles.authTitle}>Creeaza cont</h2>
        <input
          style={styles.authInput}
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          style={styles.authInput}
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          style={styles.authInput}
          type="password"
          placeholder="Parola"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && <div style={styles.errorBox}>{error}</div>}

        <button onClick={handleRegister} style={styles.primaryButton}>
          Creeaza cont
        </button>

        <div style={styles.separator} />
        <div style={styles.bottomActions}>
          <button onClick={onBack} style={styles.linkBlue}>
            Inapoi
          </button>
          <button onClick={onHome} style={styles.linkGray}>
            Home
          </button>
        </div>
      </div>
    </div>
  );
}
