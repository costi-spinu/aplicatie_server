import styles from "../../styles/iosStyles";
import ExpenseRow from "./ExpenseRow";

export default function ExpenseHistorySection({
  combinedHistory,
  historyMonth,
  onDelete,
  onEdit,
  onHistoryMonthChange,
}) {
  return (
    <div style={styles.card}>
      <h3 style={styles.sectionTitle}>Istoric cheltuieli</h3>
      <div style={styles.date}>
        Selecteaza luna pentru care vrei sa vezi si sa modifici cheltuielile.
      </div>
      <input
        type="month"
        style={styles.input}
        value={historyMonth}
        onChange={(e) => onHistoryMonthChange(e.target.value)}
      />
      <div style={{ marginTop: 14 }}>
        {combinedHistory.length === 0 && (
          <div style={styles.message}>Nu exista cheltuieli in luna selectata.</div>
        )}
        {combinedHistory.map((item) => (
          <ExpenseRow
            key={`${item.expenseType}-${item.id}-${item.data}`}
            item={item}
            showType
            onEdit={() => onEdit(item, item.expenseType)}
            onDelete={() => onDelete(item, item.expenseType)}
          />
        ))}
      </div>
    </div>
  );
}
