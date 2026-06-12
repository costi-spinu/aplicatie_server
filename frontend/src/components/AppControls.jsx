import { LANGUAGES, useAppSettings } from "../contexts/AppSettingsContext";

export default function AppControls({ compact = false }) {
  const { language, setLanguage, colorMode, toggleColorMode, t } =
    useAppSettings();

  return (
    <div style={{ ...styles.wrap, ...(compact ? styles.compactWrap : {}) }}>
      <label style={styles.label}>
        {t("Limba")}
        <select
          style={styles.select}
          value={language}
          onChange={(event) => setLanguage(event.target.value)}
        >
          {LANGUAGES.map((item) => (
            <option key={item.code} value={item.code}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <button
        key={colorMode}
        type="button"
        style={styles.themeButton}
        onClick={toggleColorMode}
      >
        {colorMode === "dark" ? t("Tema alba") : t("Tema neagra")}
      </button>
    </div>
  );
}

const styles = {
  wrap: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    justifyContent: "flex-end",
    flexWrap: "wrap",
  },
  compactWrap: {
    justifyContent: "flex-start",
  },
  label: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 12,
    color: "var(--app-muted)",
    fontWeight: 700,
  },
  select: {
    border: "1px solid var(--app-border)",
    background: "var(--app-panel)",
    color: "var(--app-text)",
    borderRadius: 4,
    padding: "6px 8px",
    fontWeight: 700,
    cursor: "pointer",
  },
  themeButton: {
    border: "1px solid var(--app-border)",
    background: "var(--app-panel-alt)",
    color: "var(--app-text)",
    borderRadius: 4,
    padding: "7px 9px",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
  },
};
