import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../services/api";
import { getCachedApiData } from "../services/apiConfig";
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
const getIncomeMonthKey = (item) => String(item.data || "").slice(0, 7);
const todayIso = () => new Date().toISOString().split("T")[0];
const emptySalaryForm = {
  data: todayIso(),
  ocupatie: "",
  suma: "",
  moneda: "RON",
  activ: true,
};
const emptyIncomeSummary = {
  venitBrut: 0,
  deduceriCredite: 0,
  deduceriAutomate: 0,
  deduceriTotal: 0,
  venitNet: 0,
};

const buildIncomeSummary = (data) => ({
  venitBrut: Number(data?.venit_brut || 0),
  deduceriCredite: Number(data?.deduceri_credite || 0),
  deduceriAutomate: Number(data?.deduceri_automate || 0),
  deduceriTotal: Number(data?.deduceri_total || 0),
  venitNet: Number(data?.venit || 0),
});
const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export default function Venit() {
  const cachedVenituri = getCachedApiData("venituri/");
  const cachedMe = getCachedApiData("me/");
  const cachedSalarySchedules = getCachedApiData("salary-schedules/");
  const cachedCredits = getCachedApiData("credite/");
  const cachedBudget = getCachedApiData("buget/lunar/");
  const cachedIncomeSummary = cachedBudget
    ? buildIncomeSummary(cachedBudget)
    : emptyIncomeSummary;
  const cachedRate = getCachedApiData("curs-bnr/");
  const cachedRonToEurRate =
    Number(cachedRate?.ron_eur || 0) || RON_TO_EUR_FALLBACK;
  const cachedEurRonRate = Number(cachedRate?.eur_ron || 0) || null;

  const [activeTab, setActiveTab] = useState("form");
  const [suma, setSuma] = useState("");
  const [currentUser, setCurrentUser] = useState(cachedMe || null);
  const [moneda, setMoneda] = useState("EUR");
  const [data, setData] = useState(new Date().toISOString().split("T")[0]);
  const [allVenituri, setAllVenituri] = useState(() =>
    Array.isArray(cachedVenituri) ? cachedVenituri : []
  );
  const [total, setTotal] = useState(cachedIncomeSummary.venitNet);
  const [editId, setEditId] = useState(null);
  const [msg, setMsg] = useState(null);
  const [ronToEurRate, setRonToEurRate] = useState(cachedRonToEurRate);
  const [eurRonRate, setEurRonRate] = useState(cachedEurRonRate);
  const [rateDate, setRateDate] = useState(cachedRate?.date || "");
  const [rateSource, setRateSource] = useState(cachedRate?.source || "fallback");
  const [selectedHistoryMonth, setSelectedHistoryMonth] = useState("");
  const [salarySchedules, setSalarySchedules] = useState(() =>
    Array.isArray(cachedSalarySchedules) ? cachedSalarySchedules : []
  );
  const [salaryForm, setSalaryForm] = useState(emptySalaryForm);
  const [salaryEditId, setSalaryEditId] = useState(null);
  const [credits, setCredits] = useState(() =>
    Array.isArray(cachedCredits) ? cachedCredits : []
  );
  const [creditEditId, setCreditEditId] = useState(null);
  const [creditDenumire, setCreditDenumire] = useState("");
  const [creditSuma, setCreditSuma] = useState("");
  const [creditMoneda, setCreditMoneda] = useState("EUR");
  const [creditData, setCreditData] = useState(todayIso());
  const [incomeSummary, setIncomeSummary] = useState(cachedIncomeSummary);

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
      const [all, meRes, salaryRes, creditsRes, budgetRes] = await Promise.all([
        api.get("venituri/"),
        api.get("me/"),
        api.get("salary-schedules/"),
        api.get("credite/"),
        api.get("buget/lunar/"),
      ]);
      const nextIncomeSummary = buildIncomeSummary(budgetRes.data);
      setAllVenituri(all.data || []);
      setTotal(nextIncomeSummary.venitNet || calculateCurrentCycleTotal(all.data || []));
      setCurrentUser(meRes.data);
      setSalarySchedules(salaryRes.data || []);
      setCredits(creditsRes.data || []);
      setIncomeSummary(nextIncomeSummary);
    } catch (err) {
      console.error("Eroare venit:", err);
    }
  }, [calculateCurrentCycleTotal]);

  useEffect(() => {
    fetchExchangeRate();
  }, [fetchExchangeRate]);

  useEffect(() => {
    loadData();
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

  const resetCreditForm = () => {
    setCreditEditId(null);
    setCreditDenumire("");
    setCreditSuma("");
    setCreditMoneda("EUR");
    setCreditData(todayIso());
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
      await loadData();
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
      await loadData();
    } catch {
      setMsg("Eroare la modificare");
    }
  };

  const stergeVenit = async (id) => {
    if (!window.confirm("Sigur stergi acest venit?")) return;

    try {
      await api.delete(`venituri/${id}/`);
      await loadData();
    } catch {
      setMsg("Eroare la stergere");
    }
  };

  const previewEur =
    suma && moneda === "RON"
      ? `aprox. ${round2(Number(suma) * ronToEurRate)} EUR`
      : null;
  const recordsVenituri = useMemo(
    () =>
      allVenituri
        .slice()
        .sort((a, b) => {
          const dateDiff = new Date(b.data) - new Date(a.data);
          if (dateDiff !== 0) return dateDiff;
          return Number(b.id || 0) - Number(a.id || 0);
        }),
    [allVenituri]
  );
  const monthlyIncomeRows = useMemo(() => {
    const totals = allVenituri.reduce((acc, item) => {
      const key = getIncomeMonthKey(item);
      if (!key) return acc;
      acc[key] = (acc[key] || 0) + Number(item.suma || 0);
      return acc;
    }, {});

    return Object.entries(totals)
      .map(([key, sum]) => ({ key, sum }))
      .filter((item) => item.key < getCurrentMonthKey())
      .sort((a, b) => b.key.localeCompare(a.key));
  }, [allVenituri]);
  const normalizedSelectedHistoryMonth =
    selectedHistoryMonth &&
    monthlyIncomeRows.some((item) => item.key === selectedHistoryMonth)
      ? selectedHistoryMonth
      : monthlyIncomeRows[0]?.key || "";
  const selectedHistoryRows = useMemo(
    () =>
      recordsVenituri.filter(
        (item) => getIncomeMonthKey(item) === normalizedSelectedHistoryMonth
      ),
    [normalizedSelectedHistoryMonth, recordsVenituri]
  );
  const selectedHistoryTotal = selectedHistoryRows.reduce(
    (acc, item) => acc + Number(item.suma || 0),
    0
  );
  const salaryPreviewEur =
    salaryForm.suma && salaryForm.moneda === "RON"
      ? round2(Number(salaryForm.suma) * ronToEurRate)
      : null;
  const creditPreviewEur =
    creditSuma && creditMoneda === "RON"
      ? round2(Number(creditSuma) * ronToEurRate)
      : null;
  const currentCycleCredits = useMemo(
    () =>
      credits
        .filter((item) => {
          const creditDate = toDateOnly(item.data);
          return creditDate >= cycleRange.start && creditDate <= cycleRange.end;
        })
        .sort((a, b) => new Date(b.data) - new Date(a.data)),
    [credits, cycleRange]
  );
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

  const saveCredit = async () => {
    if (!creditDenumire.trim() || !creditSuma || !creditData) {
      setMsg("Completeaza denumirea, suma si data creditului.");
      return;
    }

    const sumaInEur = round2(convertToEur(creditSuma, creditMoneda));
    const payload = {
      denumire: creditDenumire.trim(),
      suma: sumaInEur,
      moneda: "EUR",
      data: creditData,
    };

    try {
      if (creditEditId) {
        await api.put(`credite/${creditEditId}/`, payload);
        setMsg("Credit modificat");
      } else {
        await api.post("credite/", payload);
        setMsg("Credit salvat");
      }

      resetCreditForm();
      await loadData();
    } catch {
      setMsg("Eroare la salvarea creditului");
    }
  };

  const startCreditEdit = (item) => {
    setCreditEditId(item.id);
    setCreditDenumire(item.denumire || "");
    setCreditSuma(item.suma || "");
    setCreditMoneda(item.moneda || "EUR");
    setCreditData(item.data || todayIso());
  };

  const deleteCredit = async (id) => {
    if (!window.confirm("Sigur stergi acest credit?")) return;

    try {
      await api.delete(`credite/${id}/`);
      if (creditEditId === id) resetCreditForm();
      await loadData();
      setMsg("Credit sters");
    } catch {
      setMsg("Eroare la stergerea creditului");
    }
  };

  const exportExcel = () => {
    const header = "Data,Suma,Moneda,Utilizator,Sursa\n";
    const rows = selectedHistoryRows
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
    link.download = `venituri-${normalizedSelectedHistoryMonth || "istoric"}.xls`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = () => {
    const rows = selectedHistoryRows
      .map(
        (v) =>
          `<tr><td>${escapeHtml(v.data)}</td><td>${escapeHtml(v.suma)}</td><td>${escapeHtml(v.moneda)}</td><td>${escapeHtml(v.username || currentUser?.username || "")}</td><td>${escapeHtml(v.sursa || "manual")}</td></tr>`
      )
      .join("");
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(
      `<!doctype html><html><head><meta charset="UTF-8" /><title>Venituri ${escapeHtml(normalizedSelectedHistoryMonth)}</title><style>
        body { font-family: Segoe UI, Arial, sans-serif; color: #10201a; margin: 28px; }
        h1 { font-size: 22px; margin: 0 0 6px; }
        .meta { color: #5f6f66; font-size: 12px; margin-bottom: 16px; }
        .total { font-size: 14px; font-weight: 700; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #cfd8d3; padding: 7px 8px; text-align: left; font-size: 12px; }
        th { background: #eef2f1; font-weight: 700; }
        tr { page-break-inside: avoid; }
        @media print { body { margin: 14mm; } }
      </style></head><body>
        <h1>Venituri ${escapeHtml(normalizedSelectedHistoryMonth)}</h1>
        <div class="meta">Generat la ${escapeHtml(new Date().toLocaleString("ro-RO"))}</div>
        <div class="total">Total venit luna selectata: ${selectedHistoryTotal.toFixed(2)} EUR</div>
        <table><thead><tr><th>Data</th><th>Suma</th><th>Moneda</th><th>Utilizator</th><th>Sursa</th></tr></thead><tbody>${rows}</tbody></table>
      </body></html>`
    );
    win.document.close();
    win.focus();
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
            ...(activeTab === "credits" ? localStyles.segmentBtnActive : {}),
          }}
          onClick={() => setActiveTab("credits")}
        >
          Credite
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
              Venit disponibil ({formatDate(cycleRange.start)} -{" "}
              {formatDate(cycleRange.end)})
            </div>
            <div style={styles.heroValue}>{total.toFixed(2)} EUR</div>
            <div style={localStyles.summaryLines}>
              <div>
                <span>Venit brut</span>
                <strong>{incomeSummary.venitBrut.toFixed(2)} EUR</strong>
              </div>
              <div>
                <span>Scazut credite</span>
                <strong>-{incomeSummary.deduceriCredite.toFixed(2)} EUR</strong>
              </div>
              <div>
                <span>Scazut automate pe 27</span>
                <strong>-{incomeSummary.deduceriAutomate.toFixed(2)} EUR</strong>
              </div>
            </div>
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

      {activeTab === "credits" && (
        <>
          {msg && <div style={styles.message}>{msg}</div>}
          <div style={styles.card}>
            <h3 style={styles.sectionTitle}>
              {creditEditId ? "Modifica credit" : "Adauga credit"}
            </h3>
            <input
              style={styles.input}
              value={creditDenumire}
              placeholder="Denumire credit"
              onChange={(e) => setCreditDenumire(e.target.value)}
            />
            <input
              style={styles.input}
              type="number"
              placeholder="Suma"
              value={creditSuma}
              onChange={(e) => setCreditSuma(e.target.value)}
            />
            <select
              style={styles.input}
              value={creditMoneda}
              onChange={(e) => setCreditMoneda(e.target.value)}
            >
              <option value="EUR">EUR</option>
              <option value="RON">RON / LEI</option>
            </select>
            {creditPreviewEur !== null && (
              <div style={localStyles.previewText}>
                Conversie automata: {creditPreviewEur.toFixed(2)} EUR.{" "}
                {rateLabel}
              </div>
            )}
            <input
              style={styles.input}
              type="date"
              value={creditData}
              onChange={(e) => setCreditData(e.target.value)}
            />
            <div style={localStyles.formActions}>
              <button style={styles.blueButton} onClick={saveCredit}>
                {creditEditId ? "Salveaza credit" : "Adauga credit"}
              </button>
              {creditEditId && (
                <button style={localStyles.secondaryBtn} onClick={resetCreditForm}>
                  Anuleaza
                </button>
              )}
            </div>
          </div>

          <div style={styles.card}>
            <h3 style={styles.sectionTitle}>Credite in intervalul curent</h3>
            <div style={localStyles.historyTotal}>
              <span>Total scazut din venit</span>
              <strong>{incomeSummary.deduceriCredite.toFixed(2)} EUR</strong>
            </div>
            {currentCycleCredits.length === 0 && (
              <div style={styles.message}>Nu exista credite in intervalul curent.</div>
            )}
            {currentCycleCredits.map((item) => (
              <div key={item.id} style={styles.row}>
                <div>
                  <div style={styles.amount}>{item.denumire}</div>
                  <div style={localStyles.userText}>
                    {item.suma} {item.moneda} - {item.data}
                  </div>
                </div>
                <div style={localStyles.rowActions}>
                  <button
                    style={localStyles.editBtn}
                    onClick={() => startCreditEdit(item)}
                  >
                    Edit
                  </button>
                  <button style={styles.deleteBtn} onClick={() => deleteCredit(item.id)}>
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
          <h3 style={styles.sectionTitle}>Inregistrari venit</h3>
          {recordsVenituri.length === 0 && (
            <div style={styles.message}>
              Nu exista venituri inregistrate.
            </div>
          )}
          {recordsVenituri.map((v) => (
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
          {monthlyIncomeRows.length === 0 && (
            <div style={styles.message}>
              Nu exista venituri in lunile precedente.
            </div>
          )}
          {monthlyIncomeRows.length > 0 && (
            <>
              <select
                style={styles.input}
                value={normalizedSelectedHistoryMonth}
                onChange={(e) => setSelectedHistoryMonth(e.target.value)}
              >
                {monthlyIncomeRows.map((row) => (
                  <option key={row.key} value={row.key}>
                    {row.key} - {row.sum.toFixed(2)} EUR
                  </option>
                ))}
              </select>
              <div style={localStyles.historyTotal}>
                <span>Total venit luna selectata</span>
                <strong>{selectedHistoryTotal.toFixed(2)} EUR</strong>
              </div>
            </>
          )}
          <div style={localStyles.exportActions}>
            <button style={styles.blueButton} onClick={exportExcel}>
              Export Excel
            </button>
            <button style={styles.greenButton} onClick={exportPdf}>
              Export PDF
            </button>
          </div>
          {selectedHistoryRows.map((v) => (
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
    gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
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
  summaryLines: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
    gap: 8,
    marginTop: 12,
    fontSize: 13,
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
  historyTotal: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    border: "1px solid var(--app-border)",
    borderRadius: 4,
    padding: "10px 12px",
    marginBottom: 12,
    background: "var(--app-panel-alt)",
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
