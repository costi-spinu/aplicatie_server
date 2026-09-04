import localStyles from "../../styles/cheltuieliStyles";
import styles from "../../styles/iosStyles";

export default function VariableStatusSection({
  statusMonth,
  totalVariabileCurente,
  variableStatusRows,
  onStatusMonthChange,
}) {
  return (
    <div style={styles.card}>
      <h3 style={styles.sectionTitle}>Status cheltuieli variabile</h3>
      <input
        type="month"
        style={styles.input}
        value={statusMonth}
        onChange={(e) => onStatusMonthChange(e.target.value)}
      />
      <div style={styles.date}>Luna selectata: {statusMonth}</div>
      <div style={{ marginTop: 16 }}>
        {variableStatusRows.length === 0 && (
          <div style={styles.message}>Nu exista cheltuieli variabile in interval.</div>
        )}
        {variableStatusRows.map((row) => (
          <div key={row.key} style={styles.row}>
            <span>{row.label}</span>
            <strong>{row.sum.toLocaleString("ro-RO")} EUR</strong>
          </div>
        ))}
        {variableStatusRows.length > 0 && (
          <div style={localStyles.summaryRow}>
            <strong>Total variabile</strong>
            <strong>{totalVariabileCurente.toLocaleString("ro-RO")} EUR</strong>
          </div>
        )}
      </div>
    </div>
  );
}
