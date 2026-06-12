import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../services/api";
import styles from "../styles/iosStyles";

const RUBRICI = [
  { value: "fond_urgenta", label: "Fond de urgenta" },
  { value: "trading212", label: "Investitii - Trading212" },
  { value: "xtb", label: "Investitii - XTB" },
  { value: "revolut", label: "Investitii - Revolut" },
  { value: "tradeville", label: "Investitii - Tradeville" },
  { value: "cont_economii", label: "Cont de economii" },
  { value: "alte_investitii", label: "Alte investitii" },
];

const getRubricaLabel = (value) =>
  RUBRICI.find((rubrica) => rubrica.value === value)?.label || value;
const formatAmount = (value) => Number(value || 0).toFixed(2);
const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export default function Fonduri() {
  const [activeTab, setActiveTab] = useState("date");
  const [tip, setTip] = useState("adauga");
  const [rubrica, setRubrica] = useState("fond_urgenta");
  const [sumaEur, setSumaEur] = useState("");
  const [sumaRon, setSumaRon] = useState("");
  const [observatii, setObservatii] = useState("");
  const [msg, setMsg] = useState(null);
  const [editId, setEditId] = useState(null);
  const [miscari, setMiscari] = useState([]);
  const [totalEur, setTotalEur] = useState(0);
  const [totalRon, setTotalRon] = useState(0);

  const loadMiscari = useCallback(async () => {
    try {
      const res = await api.get("fonduri/");
      setMiscari(res.data.miscari || []);
      setTotalEur(res.data.total_eur || 0);
      setTotalRon(res.data.total_ron || 0);
    } catch (err) {
      console.error("Eroare la incarcare fonduri:", err);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadMiscari();
    }, 0);

    return () => clearTimeout(timer);
  }, [loadMiscari]);

  const resetForm = () => {
    setEditId(null);
    setTip("adauga");
    setRubrica("fond_urgenta");
    setSumaEur("");
    setSumaRon("");
    setObservatii("");
  };

  const totaluriPeRubrica = useMemo(() => {
    const initial = RUBRICI.reduce((acc, item) => {
      acc[item.value] = { eur: 0, ron: 0 };
      return acc;
    }, {});

    miscari.forEach((miscare) => {
      const key = miscare.rubrica || "alte_investitii";
      if (!initial[key]) initial[key] = { eur: 0, ron: 0 };
      initial[key].eur += Number(miscare.suma_eur || 0);
      initial[key].ron += Number(miscare.suma_ron || 0);
    });

    return initial;
  }, [miscari]);

  const rubriciRetragere = useMemo(
    () =>
      RUBRICI.filter((item) => {
        const total = totaluriPeRubrica[item.value];
        return (total?.eur || 0) > 0 || (total?.ron || 0) > 0;
      }),
    [totaluriPeRubrica]
  );

  const availableRubrici = tip === "retrage" ? rubriciRetragere : RUBRICI;
  const selectedRubrica = availableRubrici.some((item) => item.value === rubrica)
    ? rubrica
    : availableRubrici[0]?.value || "fond_urgenta";

  const submit = async (event) => {
    event.preventDefault();
    setMsg(null);

    const payload = { tip, rubrica: selectedRubrica };
    if (sumaEur) payload.suma_eur = Number(sumaEur);
    if (sumaRon) payload.suma_ron = Number(sumaRon);
    if (observatii) payload.observatii = observatii;

    if (!payload.suma_eur && !payload.suma_ron) {
      setMsg("Introdu o suma in EUR sau RON");
      return;
    }

    try {
      if (editId) {
        await api.put(`fonduri/miscare/${editId}/`, payload);
        setMsg("Miscare actualizata");
      } else {
        await api.post("fonduri/miscare/", payload);
        setMsg("Miscare salvata");
      }

      resetForm();
      await loadMiscari();
    } catch {
      setMsg("Eroare la salvare");
    }
  };

  const startEdit = (miscare) => {
    setEditId(miscare.id);
    setTip(miscare.tip || "adauga");
    setRubrica(miscare.rubrica || "fond_urgenta");
    setSumaEur(
      miscare.suma_eur ? String(Math.abs(Number(miscare.suma_eur))) : ""
    );
    setSumaRon(
      miscare.suma_ron ? String(Math.abs(Number(miscare.suma_ron))) : ""
    );
    setObservatii(miscare.observatii || "");
    setMsg(null);
    setActiveTab("date");
  };

  const stergeMiscare = async (id) => {
    if (!window.confirm("Sigur stergi aceasta miscare?")) return;

    try {
      await api.delete(`fonduri/miscare/${id}/`);
      setMsg("Miscare stearsa");
      if (editId === id) resetForm();
      await loadMiscari();
    } catch {
      setMsg("Eroare la stergere");
    }
  };

  const exportRows = [
    ["Data", "Utilizator", "Tip", "Rubrica", "Suma EUR", "Suma RON", "Observatii"],
    ...miscari.map((miscare) => [
      miscare.data,
      miscare.username || "-",
      miscare.tip || "-",
      getRubricaLabel(miscare.rubrica),
      formatAmount(miscare.suma_eur),
      formatAmount(miscare.suma_ron),
      miscare.observatii || "",
    ]),
  ];

  const makeTable = (rows) =>
    `<table><tbody>${rows
      .map(
        (row, index) =>
          `<tr>${row
            .map((value) =>
              index === 0
                ? `<th>${escapeHtml(value)}</th>`
                : `<td>${escapeHtml(value)}</td>`
            )
            .join("")}</tr>`
      )
      .join("")}</tbody></table>`;

  const buildExportHtml = () => `<!doctype html><html><head><meta charset="UTF-8" />
    <title>Fonduri investitii</title>
    <style>
      body { font-family: Segoe UI, Arial, sans-serif; color: #10201a; margin: 28px; }
      h1 { font-size: 22px; margin: 0 0 8px; }
      .meta { color: #5f6f66; font-size: 12px; margin-bottom: 16px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #cfd8d3; padding: 7px 8px; font-size: 12px; text-align: left; }
      th { background: #eef2f1; font-weight: 700; }
    </style></head><body>
      <h1>Fonduri investitii</h1>
      <div class="meta">Total EUR: ${formatAmount(totalEur)}. Total RON: ${formatAmount(totalRon)}.</div>
      ${makeTable(exportRows)}
    </body></html>`;

  const downloadExcel = () => {
    const blob = new Blob([buildExportHtml()], {
      type: "application/vnd.ms-excel;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "fonduri-investitii.xls";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadPdf = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(buildExportHtml());
    win.document.close();
    win.focus();
    win.print();
  };

  const renderTotals = () => (
    <div style={localStyles.tableWrap}>
      <table style={localStyles.table}>
        <thead>
          <tr>
            <th style={localStyles.th}>Rubrica</th>
            <th style={localStyles.th}>Total EUR</th>
            <th style={localStyles.th}>Total RON</th>
          </tr>
        </thead>
        <tbody>
          {RUBRICI.map((item) => {
            const total = totaluriPeRubrica[item.value] || { eur: 0, ron: 0 };
            return (
              <tr key={item.value}>
                <td style={localStyles.td}>{item.label}</td>
                <td style={localStyles.td}>{formatAmount(total.eur)}</td>
                <td style={localStyles.td}>{formatAmount(total.ron)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const renderHistory = () => (
    <div style={styles.card}>
      <h3 style={styles.sectionTitle}>Fonduri investite</h3>
      {miscari.length === 0 && (
        <div style={styles.message}>Nu exista inca miscari de fonduri.</div>
      )}
      {miscari.map((miscare) => (
        <div key={miscare.id} style={styles.row}>
          <div>
            <div style={localStyles.itemTitle}>{getRubricaLabel(miscare.rubrica)}</div>
            <div style={styles.date}>
              {miscare.data} - {miscare.username || "-"}
            </div>
            {miscare.observatii && (
              <div style={localStyles.itemObs}>{miscare.observatii}</div>
            )}
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={localStyles.amountGreen}>
              {formatAmount(miscare.suma_eur)} EUR
            </div>
            <div style={localStyles.amountBlue}>
              {formatAmount(miscare.suma_ron)} RON
            </div>
            <div style={localStyles.rowActions}>
              <button
                type="button"
                style={localStyles.editBtn}
                onClick={() => startEdit(miscare)}
              >
                Edit
              </button>
              <button
                type="button"
                style={styles.deleteBtn}
                onClick={() => stergeMiscare(miscare.id)}
              >
                Sterge
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Fonduri investitii</h2>

      <div style={localStyles.heroGrid}>
        <div style={localStyles.heroBox}>
          <div style={styles.heroLabel}>Total EUR</div>
          <div style={styles.heroValue}>{formatAmount(totalEur)}</div>
        </div>
        <div style={localStyles.heroBox}>
          <div style={styles.heroLabel}>Total RON</div>
          <div style={styles.heroValue}>{formatAmount(totalRon)}</div>
        </div>
      </div>

      {msg && <div style={styles.message}>{msg}</div>}

      <div style={localStyles.tabWrap}>
        {[
          ["date", "Adauga fonduri"],
          ["istoric", "Istoric fonduri"],
          ["export", "Export fonduri"],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            style={{
              ...localStyles.tabBtn,
              ...(activeTab === key ? localStyles.tabBtnActive : {}),
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === "date" && (
        <>
          <div style={styles.card}>
            <h3 style={styles.sectionTitle}>
              {editId ? "Modifica fonduri" : "Adauga fonduri"}
            </h3>
            <form onSubmit={submit}>
              <select
                style={styles.input}
                value={tip}
                onChange={(event) => {
                  const nextTip = event.target.value;
                  setTip(nextTip);
                  if (nextTip === "retrage" && rubriciRetragere.length > 0) {
                    setRubrica((current) =>
                      rubriciRetragere.some((item) => item.value === current)
                        ? current
                        : rubriciRetragere[0].value
                    );
                  }
                }}
              >
                <option value="adauga">Adauga</option>
                <option value="retrage">Retrage</option>
              </select>
              <select
                style={styles.input}
                value={selectedRubrica}
                onChange={(event) => setRubrica(event.target.value)}
              >
                {availableRubrici.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              {tip === "retrage" && rubriciRetragere.length === 0 && (
                <div style={styles.message}>
                  Nu ai fonduri disponibile pentru retragere.
                </div>
              )}
              <input
                style={styles.input}
                type="number"
                placeholder="Suma EUR"
                value={sumaEur}
                onChange={(event) => {
                  setSumaEur(event.target.value);
                  setSumaRon("");
                }}
              />
              <input
                style={styles.input}
                type="number"
                placeholder="Suma RON"
                value={sumaRon}
                onChange={(event) => {
                  setSumaRon(event.target.value);
                  setSumaEur("");
                }}
              />
              <textarea
                style={styles.input}
                placeholder="Observatii"
                value={observatii}
                onChange={(event) => setObservatii(event.target.value)}
              />
              <div style={localStyles.formActions}>
                <button type="submit" style={styles.blueButton}>
                  {editId ? "Salveaza modificarile" : "Salveaza"}
                </button>
                {editId && (
                  <button
                    type="button"
                    style={localStyles.secondaryBtn}
                    onClick={resetForm}
                  >
                    Anuleaza editarea
                  </button>
                )}
              </div>
            </form>
          </div>

          <div style={styles.card}>
            <h3 style={styles.sectionTitle}>Total pe rubrici</h3>
            {renderTotals()}
          </div>
        </>
      )}

      {activeTab === "istoric" && renderHistory()}

      {activeTab === "export" && (
        <div style={styles.card}>
          <h3 style={styles.sectionTitle}>Export fonduri</h3>
          <div style={localStyles.exportActions}>
            <button type="button" style={styles.blueButton} onClick={downloadExcel}>
              Descarca Excel
            </button>
            <button type="button" style={localStyles.secondaryBtn} onClick={downloadPdf}>
              Descarca PDF
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const localStyles = {
  heroGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 12,
    marginBottom: 18,
  },
  heroBox: {
    background: "var(--app-panel)",
    border: "1px solid var(--app-border)",
    borderLeft: "5px solid var(--app-primary)",
    borderRadius: 6,
    padding: 18,
  },
  tabWrap: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: 8,
    marginBottom: 16,
  },
  tabBtn: {
    border: "1px solid var(--app-border)",
    background: "var(--app-panel)",
    color: "var(--app-text)",
    borderRadius: 4,
    padding: "10px 12px",
    fontWeight: 800,
    cursor: "pointer",
  },
  tabBtnActive: {
    background: "var(--app-primary-soft)",
    borderColor: "var(--app-primary)",
    color: "var(--app-primary-dark)",
  },
  tableWrap: {
    overflowX: "auto",
    border: "1px solid var(--app-border)",
    borderRadius: 4,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    textAlign: "left",
    padding: "10px 12px",
    borderBottom: "1px solid var(--app-border)",
    fontSize: 13,
    color: "var(--app-text)",
    background: "var(--app-panel-alt)",
  },
  td: {
    padding: "10px 12px",
    borderBottom: "1px solid var(--app-border-soft)",
    fontSize: 14,
  },
  itemTitle: {
    fontWeight: 800,
    fontSize: 15,
  },
  itemObs: {
    fontSize: 13,
    color: "var(--app-muted)",
    marginTop: 4,
  },
  amountGreen: {
    fontWeight: 800,
    color: "var(--app-success)",
  },
  amountBlue: {
    fontWeight: 800,
    color: "var(--app-primary-dark)",
    marginTop: 4,
  },
  rowActions: {
    marginTop: 6,
    display: "flex",
    gap: 8,
    justifyContent: "flex-end",
  },
  editBtn: {
    background: "var(--app-panel)",
    border: "1px solid var(--app-border)",
    borderRadius: 4,
    color: "var(--app-primary-dark)",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
    padding: "4px 7px",
  },
  formActions: {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: 10,
    alignItems: "center",
  },
  secondaryBtn: {
    border: "1px solid var(--app-border)",
    background: "var(--app-panel-alt)",
    color: "var(--app-text)",
    borderRadius: 4,
    padding: "10px 14px",
    fontWeight: 800,
    cursor: "pointer",
  },
  exportActions: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 10,
  },
};
