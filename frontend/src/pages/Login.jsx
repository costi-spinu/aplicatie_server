import { useState } from "react";
import Register from "./Register";
import ResetParola from "./ResetParola";
import api from "../services/api";
import { API_BASE_URLS } from "../helpers/appConstants";
import styles from "../styles/iosStyles";

export default function Login({ onLogin, onBack }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [view, setView] = useState("login");

  const handleLogin = async () => {
    setError("");

    try {
      const res = await api.post("token/", {
        username: username.trim(),
        password,
      });
      localStorage.setItem("access", res.data.access);
      localStorage.setItem("refresh", res.data.refresh);
      await onLogin();
    } catch (err) {
      if (!err.response) {
        setError(`Backend indisponibil la ${API_BASE_URLS.join(", ")}`);
        return;
      }

      const detail = err.response?.data?.detail;
      setError(detail || "Date de autentificare incorecte");
    }
  };

  if (view === "register") {
    return <Register onBack={() => setView("login")} onHome={onBack} />;
  }

  if (view === "reset") {
    return <ResetParola onBack={() => setView("login")} onHome={onBack} />;
  }

  return (
    <div style={styles.centerContainer}>
      <div style={styles.centerCard}>
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
          placeholder="Parola"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button onClick={handleLogin} style={styles.primaryButton}>
          Login
        </button>

        {error && <div style={styles.errorBox}>{error}</div>}

        <div style={styles.separator} />
        <button onClick={() => setView("register")} style={styles.secondaryButton}>
          Creeaza cont
        </button>
        <button onClick={() => setView("reset")} style={styles.linkButton}>
          Ai uitat parola?
        </button>
        <button onClick={onBack} style={styles.backButton}>
          Inapoi la pagina principala
        </button>
      </div>
    </div>
  );
}