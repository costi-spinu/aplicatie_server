import styles from "../styles/iosStyles";

export default function Home({ onLoginClick }) {
    return (
        <div style={styles.centerContainer}>
            <div style={styles.centerCard}>
                <div style={styles.homeHeroIcon}>🏡</div>

                <h1 style={styles.title}>Aplicație de casă</h1>

                <p style={styles.homeSubtitle}>
                    Gestionare venituri, cheltuieli, economii și fonduri
                    într-un mod simplu și elegant.
                </p>

                <div style={styles.separator} />

                <p style={styles.homeFooter}>Made with ❤️ by Costi</p>

                <button
                    onClick={onLoginClick}
                    style={styles.primaryButton}
                >
                    🔐 Autentificare
                </button>
            </div>
        </div>
    );
}
