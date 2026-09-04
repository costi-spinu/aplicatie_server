import { useState } from "react";
import api from "../services/api";
import styles from "../styles/iosStyles";

export default function Register({ onBack, onHome }) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleRegister = async (event) => {
    event?.preventDefault();
    setError("");
    setSuccess("");

    const cleanUsername = username.trim();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanUsername || !cleanEmail || !password) {
      setError("Completează numele de utilizator, emailul și parola.");
      return;
    }
    if (password.length < 6) {
      setError("Parola trebuie să aibă minimum 6 caractere.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Parolele introduse nu coincid.");
      return;
    }

    setSubmitting(true);
    try {
      await api.post("register/", {
        username: cleanUsername,
        email: cleanEmail,
        password,
      });
      setUsername("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setSuccess("Contul a fost creat. Te poți autentifica acum.");
    } catch (err) {
      const responseData = err.response?.data;
      const messages = responseData && typeof responseData === "object"
        ? Object.values(responseData)
            .flatMap((value) => (Array.isArray(value) ? value : [value]))
            .filter(Boolean)
            .map(String)
        : [];
      setError(messages.join(" ") || "Contul nu a putut fi creat. Verifică legătura cu serverul.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={styles.centerContainer}>
      <form style={styles.centerCard} onSubmit={handleRegister}>
        <h2 style={styles.authTitle}>Creeaza cont</h2>
        <input
          style={styles.authInput}
          name="username"
          autoComplete="username"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          style={styles.authInput}
          type="email"
          name="email"
          autoComplete="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          style={styles.authInput}
          type="password"
          name="password"
          autoComplete="new-password"
          placeholder="Parola"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <input
          style={styles.authInput}
          type="password"
          name="confirmPassword"
          autoComplete="new-password"
          placeholder="Confirmă parola"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />

        {error && <div style={styles.errorBox}>{error}</div>}
        {success && <div style={styles.messageBox}>{success}</div>}

        <button type="submit" style={styles.primaryButton} disabled={submitting}>
          {submitting ? "Se creează..." : "Creează cont"}
        </button>

        <div style={styles.separator} />
        <div style={styles.bottomActions}>
          <button type="button" onClick={onBack} style={styles.linkBlue}>
            {success ? "Mergi la autentificare" : "Înapoi"}
          </button>
          {onHome && (
            <button type="button" onClick={onHome} style={styles.linkGray}>
              Home
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
