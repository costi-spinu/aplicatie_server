import localStyles from "../../styles/cheltuieliStyles";
import styles from "../../styles/iosStyles";
import {
  formatExpenseDescription,
  formatExpenseTitle,
  formatExpenseType,
} from "../../utils/cheltuieliUtils";

export default function ExpenseRow({ item, onEdit, onDelete, showType = false }) {
  const description = formatExpenseDescription(item);

  return (
    <div style={styles.row}>
      <div>
        <div style={{ fontWeight: 700 }}>{formatExpenseTitle(item)}</div>
        {description && <div style={styles.date}>{description}</div>}
        <div style={styles.date}>{new Date(item.data).toLocaleDateString("ro-RO")}</div>
        {showType && <div style={styles.date}>{formatExpenseType(item.expenseType)}</div>}
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={styles.amount}>
          {item.suma} {item.moneda}
        </div>
        <div style={localStyles.rowActions}>
          {item.username && <span style={localStyles.userBadge}>{item.username}</span>}
          <button onClick={onEdit} style={localStyles.editBtn}>
            Edit
          </button>
          <button onClick={onDelete} style={styles.deleteBtn}>
            Sterge
          </button>
        </div>
      </div>
    </div>
  );
}
