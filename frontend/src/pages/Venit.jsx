import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../services/api";
import styles from "../styles/iosStyles";

const RON_TO_EUR_FALLBACK = 0.2;

const getCurrentCycleRange = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();

  if (today.getDate() >= 26) {
    return {
      start: new Date(year, month, 26),
      end: new Date(year, month + 1, 25, 23, 59, 59, 999),
    };
  }

  return {
    start: new Date(year, month - 1, 26),
    end: new Date(year, month, 25, 23, 59, 59, 999),
  };
};

const toDateOnly = (value) => {
  const date = new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

const round2 = (value) => Math.round(value * 100) / 100;
const getCurrentMonthKey = () => new Date().toISOString().slice(0, 7);
const todayIso = () => new Date().toISOString().split("T")[0];
const emptySalaryForm = {
  data: todayIso(),
  ocupatie: "",
  suma: "",
  moneda: "RON",
  activ: true,
};

export default function Venit() {
  const [activeTab, setActiveTab] = useState("form");
  const [suma, setSuma] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const [moneda, setMoneda] = useState("EUR");
  const [data, setData] = useState(new Date().toISOString().split("T")[0]);
  const [allVenituri, setAllVenituri] = useState([]);
  const [total, setTotal] = useState(0);
  const [editId, setEditId] = useState(null);
  const [msg, setMsg] = useState(null);
  const [ronToEurRate, setRonToEurRate] = useState(RON_TO_EUR_FALLBACK);
  const [eurRonRate, setEurRonRate] = useState(null);
  const [rateDate, setRateDate] = useState("");
  const [rateSource, setRateSource] = useState("fallback");
  const [olderVenituri, setOlderVenituri] = useState([]);
  const [salarySchedules, setSalarySchedules] = useState([]);
  const [salaryForm, setSalaryForm] = useState(emptySalaryForm);
  const [salaryEditId, setSalaryEditId] = useState(null);

  const cycleRange = useMemo(() => getCurrentCycleRange(), []);
  const formatDateTime = (dt) => new Date(dt).toLocaleString("ro-RO");
  const formatDate = (dateObj) => dateObj.toLocaleDateString("ro-RO");

  const fetchExchangeRate = useCallback(async () => {
    try {
      const response = await api.get("curs-bnr/");
      const rate = Number(response.data?.ron_eur);
      if (!rate || Number.isNaN(rate)) throw new Error("Curs valutar invalid");

      setRonToEurRate(rate);
      setEurRonRate(Number(response.data?.eur_ron || 0) || null);
      setRateDate(response.data?.date || "");
      setRateSource("BNR");
    } catch (error) {
      console.warn("Curs valutar indisponibil, folosesc fallback:", error);
      setRonToEurRate(RON_TO_EUR_FALLBACK);
      setEurRonRate(null);
      setRateDate("");
      setRateSource("fallback");
    }
  }, []);

  const convertToEur = useCallback(
    (amount, currency) => {
      if (currency === "EUR") return Number(amount);
      return Number(amount) * ronToEurRate;
    },
    [ronToEurRate]
  );

  const calculateCurrentCycleTotal = useCallback(
    (items) => {
      const totalCycle = items
        .filter((item) => {
          const incomeDate = toDateOnly(item.data);
          return incomeDate >= cycleRange.start && incomeDate <= cycleRange.end;
        })
        .reduce((sum, item) => sum + convertToEur(item.suma, item.moneda), 0);

      return round2(totalCycle);
    },
    [convertToEur, cycleRange]
  );

  const loadData = useCallback(async () => {
    try {
      const [older, all, meRes, salaryRes] = await Promise.all([
        api.get("venituri/?archived=1"),
        api.get("venituri/"),
        api.get("me/"),
        api.get("salary-schedules/"),
      ]);
      setOlderVenituri(older.data || []);
      setAllVenituri(all.data || []);
      setTotal(calculateCurrentCycleTotal(all.data || []));
      setCurrentUser(meRes.data);
      setSalarySchedules(salaryRes.data || []);
    } catch (err) {
      console.error("Eroare venit:", err);
    }
  }, [calculateCurrentCycleTotal]);

  useEffect(() => {
    fetchExchangeRate();
  }, [fetchExchangeRate]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 0);

    return () => clearTimeout(timer);
  }, [loadData]);

  const resetForm = () => {
    setSuma("");
    setMoneda("EUR");
    setData(todayIso());
    setEditId(null);
  };

  const resetSalaryForm = () => {
    setSalaryForm({ ...emptySalaryForm, data: todayIso() });
    setSalaryEditId(null);
  };

  const adaugaVenit = async () => {
    if (!suma) return;

    try {
      const sumaInEur = round2(convertToEur(suma, moneda));
      await api.post("venituri/", { suma: sumaInEur, moneda: "EUR", data });

      setMsg(
        moneda === "RON"
          ? `Venit adaugat (${suma} RON, aprox. ${sumaInEur} EUR)`
          : "Venit adaugat"
      );

      resetForm();
      loadData();
    } catch {
      setMsg("Eroare la adaugare");
    }
  };

  const salveazaEdit = async () => {
    if (!suma) return;

    try {
      const sumaInEur = round2(convertToEur(suma, moneda));
      await api.put(`venituri/${editId}/`, {
        suma: sumaInEur,
        moneda: "EUR",
        data,
      });

      setMsg(
        moneda === "RON"
          ? `Venit modificat (${suma} RON, aprox. ${sumaInEur} EUR)`
          : "Venit modificat"
      );

      resetForm();
      loadData();
    } catch {
      setMsg("Eroare la modificare");
    }
  };

  const stergeVenit = async (id) => {
    if (!window.confirm("Sigur stergi acest venit?")) return;

    try {
      await api.delete(`venituri/${id}/`);
      loadData();
    } catch {
      setMsg("Eroare la stergere");
    }
  };

  const previewEur =
    suma && moneda === "RON"
      ? `aprox. ${round2(Number(suma) * ronToEurRate)} EUR`
      : null;
  const currentMonthVenituri = useMemo(
    () =>
      allVenituri
        .filter((item) => String(item.data || "").slice(0, 7) === getCurrentMonthKey())
        .sort((a, b) => new Date(b.data) - new Date(a.data)),
    [allVenituri]
  );
  const salaryPreviewEur =
    salaryForm.suma && salaryForm.moneda === "RON"
      ? round2(Number(salaryForm.suma) * ronToEurRate)
      : null;
  const rateLabel =
    rateSource === "BNR" && eurRonRate
      ? `Curs BNR: 1 EUR = ${eurRonRate} RON${rateDate ? ` (${rateDate})` : ""}`
      : "Curs BNR indisponibil, folosesc curs fallback.";

  const updateSalaryField = (field, value) =>
    setSalaryForm((prev) => ({ ...prev, [field]: value }));

  const saveSalary = async () => {
    if (!salaryForm.suma || !salaryForm.data) return;

    const payload = {
      data: salaryForm.data,
      ocupatie: salaryForm.ocupatie || "",
      suma: Number(salaryForm.suma),
      moneda: salaryForm.moneda,
      activ: salaryForm.activ !== false,
    };

    try {
      if (salaryEditId) {
        await api.put(`salary-schedules/${salaryEditId}/`, payload);
        setMsg("Salariu modificat");
      } else {
        await api.post("salary-schedules/", payload);
        setMsg("Salariu salvat");
      }
      resetSalaryForm();
      await loadData();
    } catch {
      setMsg("Eroare la salvarea salariului");
    }
  };

  const startSalaryEdit = (item) => {
    setSalaryEditId(item.id);
    setSalaryForm({
      data: item.data || todayIso(),
      ocupatie: item.ocupatie || "",
      suma: item.suma || "",
      moneda: item.moneda || "RON",
      activ: item.activ !== false,
    });
  };

  const deleteSalary = async (id) => {
    if (!window.confirm("Sigur stergi acest salariu automat?")) return;

    try {
      await api.delete(`salary-schedules/${id}/`);
      if (salaryEditId === id) resetSalaryForm();
      await loadData();
      setMsg("Salariu sters");
    } catch {
      setMsg("Eroare la stergerea salariului");
    }
  };

  const exportExcel = () => {
    const header = "Data,Suma,Moneda,Utilizator,Sursa\n";
    const rows = olderVenituri
      .map(
        (v) =>
          `${v.data},${v.suma},${v.moneda},${v.username || currentUser?.username || ""},${v.sursa || "manual"}`
      )
      .join("\n");
    const blob = new Blob([header + rows], {
      type: "application/vnd.ms-excel;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "venituri-vechi.xls";
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = () => {
    const rows = olderVenituri
      .map(
        (v) =>
          `<tr><td>${v.data}</td><td>${v.suma}</td><td>${v.moneda}</td><td>${v.username || currentUser?.username || ""}</td></tr>`
      )
      .join("");
    const win = window.open("", "_blank");
    win.document.write(
      `<html><head><title>Venituri vechi</title></head><body><h1>Venituri vechi</h1><table border="1" cellspacing="0" cellpadding="6"><thead><tr><th>Data</th><th>Suma</th><th>Moneda</th><th>Utilizator</th></tr></thead><tbody>${rows}</tbody></table></body></html>`
    );
    win.document.close();
    win.print();
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Venit</h2>

      <div style={localStyles.segmentWrapper}>
        <button
          style={{
            ...localStyles.segmentBtn,
            ...(activeTab === "form" ? localStyles.segmentBtnActive : {}),
          }}
          onClick={() => setActiveTab("form")}
        >
          Date venit
        </button>
        <button
          style={{
            ...localStyles.segmentBtn,
            ...(activeTab === "salary" ? localStyles.segmentBtnActive : {}),
          }}
          onClick={() => setActiveTab("salary")}
        >
          Salariu
        </button>
        <button
          style={{
            ...localStyles.segmentBtn,
            ...(activeTab === "records" ? localStyles.segmentBtnActive : {}),
          }}
          onClick={() => setActiveTab("records")}
        >
          Inregistrari
        </button>
        <button
          style={{
            ...localStyles.segmentBtn,
            ...(activeTab === "older" ? localStyles.segmentBtnActive : {}),
            borderRight: "none",
          }}
          onClick={() => setActiveTab("older")}
        >
          Istoric venit
        </button>
      </div>

      {activeTab === "form" && (
        <>
          <div style={styles.heroCard}>
            <div style={styles.heroLabel}>
              Total pe interval curent ({formatDate(cycleRange.start)} -{" "}
              {formatDate(cycleRange.end)})
            </div>
            <div style={styles.heroValue}>{total} EUR</div>
            <div style={localStyles.rateText}>
              Curs BNR:{" "}
              {eurRonRate ? `1 EUR = ${eurRonRate} RON` : `${ronToEurRate} EUR/RON`}{" "}
              {rateSource === "BNR" && rateDate ? `(${rateDate})` : "(fallback)"}
            </div>
          </div>

          {msg && <div style={styles.message}>{msg}</div>}

          <div style={styles.card}>
            <h3 style={styles.sectionTitle}>
              {editId ? "Modifica venit" : "Adauga venit"}
            </h3>

            <input
              style={styles.input}
              type="number"
              placeholder="Suma"
              value={suma}
              onChange={(e) => setSuma(e.target.value)}
            />

            <select
              style={styles.input}
              value={moneda}
              onChange={(e) => setMoneda(e.target.value)}
            >
              <option value="EUR">EUR</option>
              <option value="RON">RON / LEI</option>
            </select>

            {previewEur && (
              <div style={localStyles.previewText}>
                Conversie automata: {previewEur}
              </div>
            )}

            <input
              style={styles.input}
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
            />

            {editId ? (
              <button style={styles.greenButton} onClick={salveazaEdit}>
                Salveaza modificarea
              </button>
            ) : (
              <button style={styles.blueButton} onClick={adaugaVenit}>
                Adauga venit
              </button>
            )}
          </div>

          {editId && (
            <div style={styles.selectedCard}>
              <div style={styles.selectedLabel}>
                Venit selectat pentru modificare
              </div>
              <div style={styles.selectedValue}>
                {suma} {moneda} - {data}
              </div>
            </div>
          )}

        </>
      )}

      {activeTab === "salary" && (
        <>
          {msg && <div style={styles.message}>{msg}</div>}
          <div style={styles.card}>
            <h3 style={styles.sectionTitle}>
              {salaryEditId ? "Modifica salariu" : "Adauga salariu"}
            </h3>
            <input
              style={styles.input}
              type="number"
              placeholder="Salariu"
              value={salaryForm.suma}
              onChange={(e) => updateSalaryField("suma", e.target.value)}
            />
            <select
              style={styles.input}
              value={salaryForm.moneda}
              onChange={(e) => updateSalaryField("moneda", e.target.value)}
            >
              <option value="RON">RON / LEI</option>
              <option value="EUR">EUR</option>
            </select>
            {salaryPreviewEur !== null && (
              <div style={localStyles.previewText}>
                Conversie automata: {salaryPreviewEur.toFixed(2)} EUR.{" "}
                {rateLabel}
              </div>
            )}
            <input
              style={styles.input}
              value={salaryForm.ocupatie}
              placeholder="Ocupatie optional"
              onChange={(e) => updateSalaryField("ocupatie", e.target.value)}
            />
            <input
              style={styles.input}
              type="date"
              value={salaryForm.data}
              onChange={(e) => updateSalaryField("data", e.target.value)}
            />
            <label style={localStyles.checkRow}>
              <input
                type="checkbox"
                checked={salaryForm.activ}
                onChange={(e) => updateSalaryField("activ", e.target.checked)}
              />
              Activ
            </label>
            <div style={localStyles.formActions}>
              <button style={styles.blueButton} onClick={saveSalary}>
                {salaryEditId ? "Salveaza salariu" : "Adauga salariu"}
              </button>
              {salaryEditId && (
                <button style={localStyles.secondaryBtn} onClick={resetSalaryForm}>
                  Anuleaza
                </button>
              )}
            </div>
          </div>

          <div style={styles.card}>
            <h3 style={styles.sectionTitle}>Salarii automate</h3>
            {salarySchedules.length === 0 && (
              <div style={styles.message}>Nu exista salarii salvate.</div>
            )}
            {salarySchedules.map((item) => (
              <div key={item.id} style={styles.row}>
                <div>
                  <div style={styles.amount}>
                    {item.suma} {item.moneda}
                  </div>
                  <div style={styles.date}>{item.data}</div>
                  {item.ocupatie && (
                    <div style={localStyles.userText}>{item.ocupatie}</div>
                  )}
                </div>
                <div style={localStyles.rowActions}>
                  <button
                    style={localStyles.editBtn}
                    onClick={() => startSalaryEdit(item)}
                  >
                    Edit
                  </button>
                  <button style={styles.deleteBtn} onClick={() => deleteSalary(item.id)}>
                    Sterge
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {activeTab === "records" && (
        <div style={styles.card}>
          <h3 style={styles.sectionTitle}>Inregistrari luna curenta</h3>
          {currentMonthVenituri.length === 0 && (
            <div style={styles.message}>
              Nu exista venituri inregistrate in luna curenta.
            </div>
          )}
          {currentMonthVenituri.map((v) => (
            <div
              key={v.id}
              style={{
                ...styles.row,
                ...(editId === v.id ? styles.activeRow : {}),
              }}
              onClick={() => {
                setEditId(v.id);
                setSuma(v.suma);
                setMoneda(v.moneda);
                setData(v.data);
                setActiveTab("form");
              }}
            >
              <div>
                <div style={styles.amount}>
                  {v.suma} {v.moneda}
                </div>
                <div style={localStyles.userText}>
                  {v.username || currentUser?.username}
                </div>
                <div style={styles.date}>{v.data}</div>
                {v.updated_at && (
                  <div style={styles.updated}>
                    ultima modificare: {formatDateTime(v.updated_at)}
                  </div>
                )}
              </div>
              <button
                style={styles.deleteBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  stergeVenit(v.id);
                }}
              >
                Sterge
              </button>
            </div>
          ))}
        </div>
      )}

      {activeTab === "older" && (
        <div style={styles.card}>
          <h3 style={styles.sectionTitle}>Istoric venit</h3>
          <div style={localStyles.exportActions}>
            <button style={styles.blueButton} onClick={exportExcel}>
              Export Excel
            </button>
            <button style={styles.greenButton} onClick={exportPdf}>
              Export PDF
            </button>
          </div>
          {olderVenituri.length === 0 && (
            <div style={styles.message}>Nu exista venituri in istoric.</div>
          )}
          {olderVenituri.map((v) => (
            <div
              key={v.id}
              style={{
                ...styles.row,
                ...(editId === v.id ? styles.activeRow : {}),
              }}
              onClick={() => {
                setEditId(v.id);
                setSuma(v.suma);
                setMoneda(v.moneda);
                setData(v.data);
                setActiveTab("form");
              }}
            >
              <div>
                <div style={styles.amount}>
                  {v.suma} {v.moneda}
                </div>
                <div style={localStyles.userText}>
                  {v.username || currentUser?.username}
                </div>
                <div style={styles.date}>{v.data}</div>
                {v.updated_at && (
                  <div style={styles.updated}>
                    ultima modificare: {formatDateTime(v.updated_at)}
                  </div>
                )}
              </div>
              <button
                style={styles.deleteBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  stergeVenit(v.id);
                }}
              >
                Sterge
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const localStyles = {
  segmentWrapper: {
    width: "100%",
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    border: "1px solid var(--app-border)",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 18,
  },
  segmentBtn: {
    border: "none",
    borderRight: "1px solid var(--app-border)",
    background: "var(--app-panel)",
    padding: "10px",
    fontWeight: 700,
    fontSize: 14,
    color: "var(--app-text)",
    cursor: "pointer",
  },
  segmentBtnActive: {
    background: "var(--app-primary-soft)",
    color: "var(--app-primary-dark)",
  },
  rateText: {
    marginTop: 8,
    fontSize: 12,
    color: "var(--app-muted)",
  },
  previewText: {
    marginBottom: 12,
    fontSize: 13,
    color: "var(--app-muted)",
  },
  userText: {
    fontSize: 12,
    color: "var(--app-muted)",
  },
  exportActions: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
    marginBottom: 12,
  },
  checkRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
    fontWeight: 700,
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
  rowActions: {
    display: "flex",
    gap: 8,
    alignItems: "center",
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
};
