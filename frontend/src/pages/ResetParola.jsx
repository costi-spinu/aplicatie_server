import { useState } from "react";
import axios from "axios";
import { PASSWORD_RESET_URL } from "../helpers/appConstants";
import styles from "../styles/iosStyles";

export default function ResetParola({ onBack, onHome }) {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [isError, setIsError] = useState(false);

  const trimite = async () => {
    setMsg("");
    setIsError(false);

    try {
      await axios.post(PASSWORD_RESET_URL, { email });
      setMsg("Verifica emailul pentru resetare");
      setIsError(false);
    } catch {
      setMsg("Email invalid");
      setIsError(true);
    }
  };

  return (
    <div style={styles.centerContainer}>
      <div style={styles.centerCard}>
        <h2 style={styles.authTitle}>Resetare parola</h2>
        <p style={styles.authSubtitle}>
          Introdu adresa de email pentru a primi linkul de resetare.
        </p>
        <input
          style={styles.authInput}
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button onClick={trimite} style={styles.primaryButton}>
          Trimite link
        </button>

        {msg && (
          <div
            style={{
              ...styles.messageBox,
              background: isError ? "#fdebea" : "#e6f4ed",
              color: isError ? "#b42318" : "#146c43",
            }}
          >
            {msg}
          </div>
        )}

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
