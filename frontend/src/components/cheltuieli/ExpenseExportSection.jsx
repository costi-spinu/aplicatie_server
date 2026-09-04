import localStyles from "../../styles/cheltuieliStyles";
import styles from "../../styles/iosStyles";
import { formatBudgetCycleLabel } from "../../utils/cheltuieliUtils";

export default function ExpenseExportSection({
  exportMonth,
  periodStartDay,
  exportLoading,
  exportReady,
  onDownloadExcel,
  onDownloadPdf,
  onExportMonthChange,
}) {
  return (
    <div style={styles.card}>
      <h3 style={styles.sectionTitle}>Desfasurator cheltuieli</h3>
      <div style={styles.date}>
        Ciclu bugetar: {formatBudgetCycleLabel(exportMonth, periodStartDay)}
      </div>
      <input
        type="month"
        style={styles.input}
        value={exportMonth}
        onChange={(e) => onExportMonthChange(e.target.value)}
      />
      <div style={localStyles.exportActions}>
        <button
          style={styles.blueButton}
          onClick={onDownloadExcel}
          disabled={!exportReady || exportLoading}
        >
          {exportLoading ? "Se calculeaza..." : "Descarca Excel"}
        </button>
        <button
          style={localStyles.secondaryButton}
          onClick={onDownloadPdf}
          disabled={!exportReady || exportLoading}
        >
          Descarca PDF
        </button>
      </div>
    </div>
  );
}
