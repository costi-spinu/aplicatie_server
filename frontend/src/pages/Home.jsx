import styles from "../styles/iosStyles";
import InstallAppButton from "../components/InstallAppButton";

export default function Home({ onLoginClick }) {
  return (
    <div style={styles.centerContainer}>
      <div style={styles.centerCard}>
        <h1 style={styles.title}>Buget & Economii</h1>
        <p style={styles.homeSubtitle}>
          O aplicatie simpla pentru venituri, cheltuieli, economii si fonduri,
          cu accent pe control si evidenta clara.
        </p>
        <div style={styles.separator} />
        <p style={styles.homeFooter}>Administrare financiara personala</p>
        <button onClick={onLoginClick} style={styles.primaryButton}>
          Autentificare
        </button>
        <div style={styles.installAction}>
          <InstallAppButton />
        </div>
      </div>
    </div>
  );
}
