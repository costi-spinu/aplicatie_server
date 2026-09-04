import localStyles from "../../styles/cheltuieliStyles";
import styles from "../../styles/iosStyles";
import { categoryKeys, categoryLabelMap } from "../../utils/cheltuieliUtils";

export default function ManualExpenseForm({
  categorie,
  data,
  descriere,
  editId,
  manualFixedPreview,
  manualVariablePreview,
  moneda,
  rateLabel,
  suma,
  tab,
  onCancel,
  onSave,
  onCategorieChange,
  onDataChange,
  onDescriereChange,
  onMonedaChange,
  onSumaChange,
}) {
  return (
    <div style={styles.card}>
      <h3 style={styles.sectionTitle}>
        {editId ? "Modifica inregistrare" : "Adauga inregistrare"}
      </h3>
      {tab === "variabile" && (
        <select
          style={styles.input}
          value={categorie}
          onChange={(e) => onCategorieChange(e.target.value)}
        >
          {categoryKeys.map((key) => (
            <option key={key} value={key}>
              {categoryLabelMap[key]}
            </option>
          ))}
        </select>
      )}
      <input
        style={styles.input}
        placeholder="Descriere optionala"
        value={descriere}
        onChange={(e) => onDescriereChange(e.target.value)}
      />
      <input
        style={styles.input}
        type="number"
        placeholder="Suma"
        value={suma}
        onChange={(e) => onSumaChange(e.target.value)}
      />
      <select
        style={styles.input}
        value={moneda}
        onChange={(e) => onMonedaChange(e.target.value)}
      >
        <option value="EUR">EUR</option>
        <option value="RON">RON / lei</option>
      </select>
      {manualFixedPreview !== null && (
        <div style={localStyles.previewText}>
          Conversie automata: {manualFixedPreview.toFixed(2)} EUR. {rateLabel}
        </div>
      )}
      {manualVariablePreview !== null && (
        <div style={localStyles.previewText}>
          Conversie automata: {manualVariablePreview.toFixed(2)} EUR. {rateLabel}
        </div>
      )}
      <input
        style={styles.input}
        type="date"
        value={data}
        onChange={(e) => onDataChange(e.target.value)}
      />
      <div style={localStyles.formActions}>
        <button style={styles.blueButton} onClick={onSave}>
          {editId ? "Salveaza" : "Adauga"}
        </button>
        {editId && (
          <button style={localStyles.cancelBtn} onClick={onCancel}>
            Anuleaza
          </button>
        )}
      </div>
    </div>
  );
}
