import localStyles from "../../styles/cheltuieliStyles";
import styles from "../../styles/iosStyles";
import {
  fixedAutomationCadenceOptions,
  getDayFromDate,
  getFixedAutomationCadenceLabel,
  getMonthFromDate,
  requiresFixedAutomationStartMonth,
} from "../../utils/cheltuieliUtils";

export default function AutomationsSection({
  autoActiv,
  autoCursivitate,
  autoDay,
  autoDenumire,
  autoEditId,
  autoFixedPreview,
  autoMoneda,
  autoStartMonth,
  autoSuma,
  automationTotals,
  fixeAutomate,
  rateLabel,
  onAutoActivChange,
  onAutoCursivitateChange,
  onAutoDayChange,
  onAutoDenumireChange,
  onAutoMonedaChange,
  onAutoStartMonthChange,
  onAutoSumaChange,
  onCancel,
  onDelete,
  onEdit,
  onSave,
}) {
  return (
    <div style={styles.card}>
      <h3 style={styles.sectionTitle}>
        {autoEditId ? "Modifica automatizare" : "Adauga automatizare"}
      </h3>
      <input
        style={styles.input}
        placeholder="Denumire"
        value={autoDenumire}
        onChange={(e) => onAutoDenumireChange(e.target.value)}
      />
      <input
        style={styles.input}
        type="number"
        min="1"
        max="31"
        placeholder="Ziua lunii"
        value={autoDay}
        onChange={(e) => onAutoDayChange(e.target.value)}
      />
      <select
        style={styles.input}
        value={autoCursivitate}
        onChange={(e) => onAutoCursivitateChange(e.target.value)}
      >
        {fixedAutomationCadenceOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {requiresFixedAutomationStartMonth(autoCursivitate) && (
        <label style={localStyles.fieldGroup}>
          <span style={localStyles.fieldLabel}>Luna primei plati</span>
          <input
            style={{ ...styles.input, marginBottom: 0 }}
            type="month"
            value={autoStartMonth}
            onChange={(e) => onAutoStartMonthChange(e.target.value)}
          />
          <span style={localStyles.fieldHint}>
            Recurenta se calculeaza automat incepand cu aceasta luna.
          </span>
        </label>
      )}
      <input
        style={styles.input}
        type="number"
        placeholder="Suma"
        value={autoSuma}
        onChange={(e) => onAutoSumaChange(e.target.value)}
      />
      <select
        style={styles.input}
        value={autoMoneda}
        onChange={(e) => onAutoMonedaChange(e.target.value)}
      >
        <option value="EUR">EUR</option>
        <option value="RON">RON / lei</option>
      </select>
      {autoFixedPreview !== null && (
        <div style={localStyles.previewText}>
          Conversie automata: {autoFixedPreview.toFixed(2)} EUR. {rateLabel}
        </div>
      )}
      <label style={localStyles.checkboxRow}>
        <input
          type="checkbox"
          checked={autoActiv}
          onChange={(e) => onAutoActivChange(e.target.checked)}
        />
        Activ
      </label>
      <div style={localStyles.formActions}>
        <button style={styles.blueButton} onClick={onSave}>
          {autoEditId ? "Salveaza" : "Adauga"}
        </button>
        {autoEditId && (
          <button style={localStyles.cancelBtn} onClick={onCancel}>
            Anuleaza
          </button>
        )}
      </div>

      <div style={localStyles.autoTableWrap}>
        <div style={localStyles.autoTotalsGrid}>
          <div style={localStyles.autoTotalItem}>
            <span>Total luna curenta fara chirie</span>
            <strong>
              {automationTotals.currentMonthWithoutRent.toFixed(2)} EUR
            </strong>
          </div>
          <div style={localStyles.autoTotalItem}>
            <span>Total general fara chirie</span>
            <strong>{automationTotals.generalWithoutRent.toFixed(2)} EUR</strong>
          </div>
          <div style={localStyles.autoTotalItem}>
            <span>Total chirie</span>
            <strong>{automationTotals.rent.toFixed(2)} EUR</strong>
          </div>
        </div>
        <table style={localStyles.autoTable}>
          <thead>
            <tr>
              <th style={localStyles.tableHeaderCell}>Denumire</th>
              <th style={localStyles.tableHeaderCell}>Ziua lunii</th>
              <th style={localStyles.tableHeaderCell}>Luna de pornire</th>
              <th style={localStyles.tableHeaderCell}>Cursivitate</th>
              <th style={localStyles.tableHeaderCell}>Suma</th>
              <th style={localStyles.tableHeaderCell}>Status</th>
              <th style={localStyles.tableHeaderCell}>Actiuni</th>
            </tr>
          </thead>
          <tbody>
            {fixeAutomate.length === 0 && (
              <tr>
                <td colSpan="7" style={localStyles.emptyTableCell}>
                  Nu exista automatizari salvate.
                </td>
              </tr>
            )}
            {fixeAutomate.map((item) => (
              <tr key={item.id}>
                <td style={localStyles.tableCell}>{item.denumire}</td>
                <td style={localStyles.tableCell}>{getDayFromDate(item.data)}</td>
                <td style={localStyles.tableCell}>
                  {getMonthFromDate(item.data)}
                </td>
                <td style={localStyles.tableCell}>
                  {getFixedAutomationCadenceLabel(item.cursivitate)}
                </td>
                <td style={localStyles.tableCell}>
                  {item.suma} {item.moneda}
                </td>
                <td style={localStyles.tableCell}>
                  {item.activ ? "Activ" : "Inactiv"}
                </td>
                <td style={localStyles.tableCell}>
                  <div style={localStyles.tableActionGroup}>
                    <button onClick={() => onEdit(item)} style={localStyles.editBtn}>
                      Edit
                    </button>
                    <button onClick={() => onDelete(item)} style={styles.deleteBtn}>
                      Sterge
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
