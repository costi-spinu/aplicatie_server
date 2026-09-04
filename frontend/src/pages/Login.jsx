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
  const [submitting, setSubmitting] = useState(false);
  const [view, setView] = useState("login");

  const handleLogin = async (event) => {
    event?.preventDefault();
    setError("");
    setSubmitting(true);

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
    } finally {
      setSubmitting(false);
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
      <form style={styles.centerCard} onSubmit={handleLogin}>
        <h2 style={styles.authTitle}>Autentificare</h2>
        <input
          style={styles.authInput}
          name="username"
          autoComplete="username"
          enterKeyHint="next"
          placeholder="Username sau email"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          style={styles.authInput}
          type="password"
          name="password"
          autoComplete="current-password"
          enterKeyHint="done"
          placeholder="Parola"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button type="submit" style={styles.primaryButton} disabled={submitting}>
          {submitting ? "Se conecteaza..." : "Login"}
        </button>

        {error && <div style={styles.errorBox}>{error}</div>}

        <div style={styles.separator} />
        <button
          type="button"
          onClick={() => setView("register")}
          style={styles.secondaryButton}
        >
          Creeaza cont
        </button>
        <button
          type="button"
          onClick={() => setView("reset")}
          style={styles.linkButton}
        >
          Ai uitat parola?
        </button>
        <button type="button" onClick={onBack} style={styles.backButton}>
          Inapoi la pagina principala
        </button>
      </form>
    </div>
  );
}
