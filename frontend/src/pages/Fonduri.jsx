import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../services/api";
import { getCachedApiData } from "../services/apiConfig";
import styles from "../styles/iosStyles";

const FALLBACK_RUBRICI = [
  { value: "fond_urgenta", label: "Fond de urgenta" },
  { value: "trading212", label: "Investitii - Trading212" },
  { value: "xtb", label: "Investitii - XTB" },
  { value: "revolut", label: "Investitii - Revolut" },
  { value: "tradeville", label: "Investitii - Tradeville" },
  { value: "cont_economii", label: "Cont de economii" },
  { value: "alte_investitii", label: "Alte investitii" },
];

const getRubricaLabel = (value, categorii = FALLBACK_RUBRICI) =>
  categorii.find((rubrica) => rubrica.value === value)?.label || value || "-";
const toNumber = (value) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};
const formatAmount = (value) => toNumber(value).toFixed(2);
const getCurrentMonthKey = () => new Date().toISOString().slice(0, 7);
const getItemMonthKey = (item) => String(item.data || "").slice(0, 7);
const clampDay = (value) => Math.min(Math.max(Number(value || 1), 1), 31);
const getDayFromDate = (value) => {
  if (!value) return String(new Date().getDate()).padStart(2, "0");
  return String(clampDay(String(value).split("-")[2])).padStart(2, "0");
};
const buildDateForCurrentMonthDay = (dayValue) => {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const day = clampDay(dayValue);
  const lastDay = new Date(year, month + 1, 0).getDate();
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(
    Math.min(day, lastDay)
  ).padStart(2, "0")}`;
};
const normalizeCategories = (items) => {
  const source = Array.isArray(items) && items.length > 0 ? items : FALLBACK_RUBRICI;
  const seen = new Set();

  return source.reduce((acc, item) => {
    const value = String(item?.value || "").trim();
    if (!value || seen.has(value)) return acc;
    seen.add(value);
    acc.push({
      id: item.id ?? null,
      value,
      label: item.label || value,
      default: item.default !== false,
    });
    return acc;
  }, []);
};
const sumFonduri = (items) =>
  items.reduce(
    (acc, item) => ({
      eur: acc.eur + toNumber(item.suma_eur),
      ron: acc.ron + toNumber(item.suma_ron),
    }),
    { eur: 0, ron: 0 }
  );
const sortMiscari = (items) =>
  items.slice().sort((a, b) => {
    const dateDiff = new Date(b.data || 0) - new Date(a.data || 0);
    if (dateDiff !== 0) return dateDiff;
    return toNumber(b.id) - toNumber(a.id);
  });
const upsertById = (items, nextItem) => {
  const exists = items.some((item) => item.id === nextItem.id);
  return exists
    ? items.map((item) => (item.id === nextItem.id ? nextItem : item))
    : [nextItem, ...items];
};
const notifyFinanceDataChanged = () => {
  window.dispatchEvent(new Event("finance-data-updated"));
};
const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
const getApiErrorMessage = (error, fallback) => {
  const data = error?.response?.data;
  if (typeof data === "string" && data.trim()) return data;
  if (data?.detail) return data.detail;
  if (data && typeof data === "object") {
    const firstValue = Object.values(data)[0];
    if (Array.isArray(firstValue) && firstValue[0]) return String(firstValue[0]);
    if (firstValue) return String(firstValue);
  }
  return fallback;
};

export default function Fonduri() {
  const cachedFonduri = getCachedApiData("fonduri/") || {};
  const cachedMiscari = Array.isArray(cachedFonduri.miscari)
    ? cachedFonduri.miscari
    : [];
  const cachedFonduriTotals = sumFonduri(cachedMiscari);
  const cachedCategorii =
    getCachedApiData("fonduri/categorii/") || cachedFonduri.categorii;
  const cachedAutomate = getCachedApiData("investitii-automate/");

  const [activeTab, setActiveTab] = useState("date");
  const [tip, setTip] = useState("adauga");
  const [rubrica, setRubrica] = useState("fond_urgenta");
  const [sumaEur, setSumaEur] = useState("");
  const [sumaRon, setSumaRon] = useState("");
  const [observatii, setObservatii] = useState("");
  const [msg, setMsg] = useState(null);
  const [editId, setEditId] = useState(null);
  const [miscari, setMiscari] = useState(cachedMiscari);
  const [totalEur, setTotalEur] = useState(
    cachedFonduri.total_eur ?? cachedFonduriTotals.eur
  );
  const [totalRon, setTotalRon] = useState(
    cachedFonduri.total_ron ?? cachedFonduriTotals.ron
  );
  const [historyMonth, setHistoryMonth] = useState(getCurrentMonthKey());
  const [categorii, setCategorii] = useState(() =>
    normalizeCategories(cachedCategorii)
  );
  const [automate, setAutomate] = useState(() =>
    Array.isArray(cachedAutomate) ? cachedAutomate : []
  );
  const [autoEditId, setAutoEditId] = useState(null);
  const [autoDenumire, setAutoDenumire] = useState("");
  const [autoDay, setAutoDay] = useState(String(new Date().getDate()));
  const [autoRubrica, setAutoRubrica] = useState("fond_urgenta");
  const [autoSumaEur, setAutoSumaEur] = useState("");
  const [autoSumaRon, setAutoSumaRon] = useState("");
  const [autoActiv, setAutoActiv] = useState(true);
  const [newCategoryLabel, setNewCategoryLabel] = useState("");
  const [loadingTotals, setLoadingTotals] = useState(false);

  const loadMiscari = useCallback(async () => {
    setLoadingTotals(true);
    try {
      const fonduriRes = await api.get("fonduri/");
      const data = fonduriRes.data || {};
      const nextMiscari = Array.isArray(data.miscari) ? data.miscari : [];
      const calculatedTotals = sumFonduri(nextMiscari);
      setMiscari(nextMiscari);
      setTotalEur(data.total_eur ?? calculatedTotals.eur);
      setTotalRon(data.total_ron ?? calculatedTotals.ron);
      if (data.categorii) setCategorii(normalizeCategories(data.categorii));
      setLoadingTotals(false);

      const [categoriiRes, automateRes] = await Promise.allSettled([
        api.get("fonduri/categorii/"),
        api.get("investitii-automate/"),
      ]);

      if (categoriiRes.status === "fulfilled") {
        setCategorii(normalizeCategories(categoriiRes.value.data || []));
      } else {
        console.error("Eroare la incarcare categorii fonduri:", categoriiRes.reason);
      }

      if (automateRes.status === "fulfilled") {
        setAutomate(Array.isArray(automateRes.value.data) ? automateRes.value.data : []);
      } else {
        console.error(
          "Eroare la incarcare investitii automate:",
          automateRes.reason
        );
      }
    } catch (err) {
      console.error("Eroare la incarcare fonduri:", err);
      setLoadingTotals(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadMiscari);
  }, [loadMiscari]);

  useEffect(() => {
    const refreshFonduri = () => {
      void loadMiscari();
    };
    const refreshWhenVisible = () => {
      if (!document.hidden) refreshFonduri();
    };

    window.addEventListener("finance-data-updated", refreshFonduri);
    window.addEventListener("focus", refreshFonduri);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      window.removeEventListener("finance-data-updated", refreshFonduri);
      window.removeEventListener("focus", refreshFonduri);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [loadMiscari]);

  const applyLocalMiscari = useCallback(
    (buildNextMiscari) => {
      const nextMiscari = sortMiscari(buildNextMiscari(miscari));
      const calculatedTotals = sumFonduri(nextMiscari);
      setMiscari(nextMiscari);
      setTotalEur(calculatedTotals.eur);
      setTotalRon(calculatedTotals.ron);
    },
    [miscari]
  );

  const resetForm = () => {
    setEditId(null);
    setTip("adauga");
    setRubrica(categorii[0]?.value || "fond_urgenta");
    setSumaEur("");
    setSumaRon("");
    setObservatii("");
  };

  const resetAutoForm = () => {
    setAutoEditId(null);
    setAutoDenumire("");
    setAutoDay(String(new Date().getDate()));
    setAutoRubrica(categorii[0]?.value || "fond_urgenta");
    setAutoSumaEur("");
    setAutoSumaRon("");
    setAutoActiv(true);
  };

  const categoryLabelMap = useMemo(
    () =>
      categorii.reduce((acc, item) => {
        acc[item.value] = item.label;
        return acc;
      }, {}),
    [categorii]
  );

  const totaluriPeRubrica = useMemo(() => {
    const initial = categorii.reduce((acc, item) => {
      acc[item.value] = { eur: 0, ron: 0 };
      return acc;
    }, {});

    miscari.forEach((miscare) => {
      const key = miscare.rubrica || "alte_investitii";
      if (!initial[key]) initial[key] = { eur: 0, ron: 0 };
      initial[key].eur += toNumber(miscare.suma_eur);
      initial[key].ron += toNumber(miscare.suma_ron);
    });

    return initial;
  }, [categorii, miscari]);

  const totalRows = useMemo(() => {
    const rows = categorii.map((item) => ({
      ...item,
      total: totaluriPeRubrica[item.value] || { eur: 0, ron: 0 },
    }));
    const extraRows = Object.keys(totaluriPeRubrica)
      .filter((key) => !categoryLabelMap[key])
      .map((key) => ({
        value: key,
        label: key,
        total: totaluriPeRubrica[key],
      }));

    return [...rows, ...extraRows];
  }, [categorii, categoryLabelMap, totaluriPeRubrica]);

  const totalGeneralCalculat = useMemo(
    () =>
      totalRows.reduce(
        (acc, item) => ({
          eur: acc.eur + toNumber(item.total.eur),
          ron: acc.ron + toNumber(item.total.ron),
        }),
        { eur: 0, ron: 0 }
      ),
    [totalRows]
  );

  const rubriciRetragere = useMemo(
    () =>
      categorii.filter((item) => {
        const total = totaluriPeRubrica[item.value];
        return (total?.eur || 0) > 0 || (total?.ron || 0) > 0;
      }),
    [categorii, totaluriPeRubrica]
  );

  const availableRubrici = tip === "retrage" ? rubriciRetragere : categorii;
  const selectedRubrica = availableRubrici.some((item) => item.value === rubrica)
    ? rubrica
    : availableRubrici[0]?.value || "fond_urgenta";
  const selectedAutoRubrica = categorii.some((item) => item.value === autoRubrica)
    ? autoRubrica
    : categorii[0]?.value || "fond_urgenta";
  const filteredHistory = useMemo(
    () => miscari.filter((miscare) => getItemMonthKey(miscare) === historyMonth),
    [historyMonth, miscari]
  );
  const displayTotalEur =
    totalEur !== null && totalEur !== undefined
      ? toNumber(totalEur)
      : totalGeneralCalculat.eur;
  const displayTotalRon =
    totalRon !== null && totalRon !== undefined
      ? toNumber(totalRon)
      : totalGeneralCalculat.ron;
  const selectedMonthTotals = useMemo(
    () => sumFonduri(filteredHistory),
    [filteredHistory]
  );
  const totalAutomatizari = useMemo(
    () =>
      automate
        .filter((item) => item.activ !== false)
        .reduce(
          (acc, item) => ({
            eur: acc.eur + toNumber(item.suma_eur),
            ron: acc.ron + toNumber(item.suma_ron),
          }),
          { eur: 0, ron: 0 }
        ),
    [automate]
  );

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
      let response;
      if (editId) {
        response = await api.put(`fonduri/miscare/${editId}/`, payload);
        setMsg("Miscare actualizata");
      } else {
        response = await api.post("fonduri/miscare/", payload);
        setMsg("Miscare salvata");
      }

      if (response?.data?.id) {
        applyLocalMiscari((current) => upsertById(current, response.data));
      }
      resetForm();
      notifyFinanceDataChanged();
      setActiveTab("istoric");
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

  const startAutoEdit = (item) => {
    setAutoEditId(item.id);
    setAutoDenumire(item.denumire || "");
    setAutoDay(getDayFromDate(item.data));
    setAutoRubrica(item.rubrica || categorii[0]?.value || "fond_urgenta");
    setAutoSumaEur(item.suma_eur ? String(Math.abs(Number(item.suma_eur))) : "");
    setAutoSumaRon(item.suma_ron ? String(Math.abs(Number(item.suma_ron))) : "");
    setAutoActiv(item.activ !== false);
    setEditId(null);
    setMsg(null);
    setActiveTab("automate");
  };

  const stergeMiscare = async (id) => {
    if (!window.confirm("Sigur stergi aceasta miscare?")) return;

    const previousMiscari = miscari;
    applyLocalMiscari((current) => current.filter((item) => item.id !== id));

    try {
      await api.delete(`fonduri/miscare/${id}/`);
      setMsg("Miscare stearsa");
      if (editId === id) resetForm();
      notifyFinanceDataChanged();
    } catch {
      const calculatedTotals = sumFonduri(previousMiscari);
      setMiscari(previousMiscari);
      setTotalEur(calculatedTotals.eur);
      setTotalRon(calculatedTotals.ron);
      setMsg("Eroare la stergere");
    }
  };

  const salveazaAutomatizare = async (event) => {
    event.preventDefault();
    setMsg(null);

    const payload = {
      denumire: autoDenumire,
      data: buildDateForCurrentMonthDay(autoDay),
      rubrica: selectedAutoRubrica,
      activ: autoActiv,
    };
    if (autoSumaEur) payload.suma_eur = Number(autoSumaEur);
    if (autoSumaRon) payload.suma_ron = Number(autoSumaRon);

    if (!payload.suma_eur && !payload.suma_ron) {
      setMsg("Introdu o suma automata in EUR sau RON");
      return;
    }

    try {
      if (autoEditId) {
        await api.put(`investitii-automate/${autoEditId}/`, payload);
      } else {
        await api.post("investitii-automate/", payload);
      }

      resetAutoForm();
      notifyFinanceDataChanged();
      setMsg("Automatizarea a fost salvata");
    } catch (error) {
      setMsg(
        getApiErrorMessage(error, "Nu am putut salva automatizarea de investitii.")
      );
    }
  };

  const stergeAutomatizare = async (item) => {
    if (!window.confirm("Sigur stergi aceasta automatizare?")) return;

    try {
      await api.delete(`investitii-automate/${item.id}/`);
      if (autoEditId === item.id) resetAutoForm();
      notifyFinanceDataChanged();
      setMsg("Automatizarea a fost stearsa");
    } catch (error) {
      setMsg(
        getApiErrorMessage(error, "Nu am putut sterge automatizarea de investitii.")
      );
    }
  };

  const creeazaCategorie = async (event) => {
    event.preventDefault();
    const label = newCategoryLabel.trim();
    setMsg(null);

    if (!label) {
      setMsg("Completeaza denumirea investitiei.");
      return;
    }

    try {
      const response = await api.post("investitii-categorii/", { label });
      const created = response.data || {};
      setNewCategoryLabel("");
      notifyFinanceDataChanged();
      if (created.value) {
        setRubrica(created.value);
        setAutoRubrica(created.value);
      }
      setMsg("Categoria de investitie a fost creata");
    } catch (error) {
      setMsg(getApiErrorMessage(error, "Nu am putut crea categoria de investitie."));
    }
  };

  const exportRows = [
    ["Data", "Utilizator", "Tip", "Rubrica", "Suma EUR", "Suma RON", "Observatii"],
    ...miscari.map((miscare) => [
      miscare.data,
      miscare.username || "-",
      miscare.tip || "-",
      getRubricaLabel(miscare.rubrica, categorii),
      formatAmount(miscare.suma_eur),
      formatAmount(miscare.suma_ron),
      miscare.observatii || "",
    ]),
  ];
  const exportTotalRows = [
    ["Rubrica", "Total EUR", "Total RON"],
    ["Total general", formatAmount(displayTotalEur), formatAmount(displayTotalRon)],
    ...totalRows.map((row) => [
      row.label,
      formatAmount(row.total.eur),
      formatAmount(row.total.ron),
    ]),
  ];
  const exportAutomateRows = [
    ["Denumire", "Zi", "Rubrica", "Suma EUR", "Suma RON", "Status"],
    ...automate.map((item) => [
      item.denumire || "-",
      getDayFromDate(item.data),
      getRubricaLabel(item.rubrica, categorii),
      formatAmount(item.suma_eur),
      formatAmount(item.suma_ron),
      item.activ !== false ? "Activ" : "Inactiv",
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
      h3 { font-size: 15px; margin: 22px 0 8px; }
    </style></head><body>
      <h1>Fonduri investitii</h1>
      <div class="meta">Total EUR: ${formatAmount(displayTotalEur)}. Total RON: ${formatAmount(displayTotalRon)}.</div>
      <h3>Totaluri pe rubrici</h3>
      ${makeTable(exportTotalRows)}
      <h3>Automatizari active</h3>
      ${makeTable(exportAutomateRows)}
      <h3>Miscari fonduri</h3>
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
          <tr>
            <td style={localStyles.totalTd}>Total general</td>
            <td style={localStyles.totalTd}>{formatAmount(displayTotalEur)}</td>
            <td style={localStyles.totalTd}>{formatAmount(displayTotalRon)}</td>
          </tr>
          {totalRows.map((item) => (
            <tr key={item.value}>
              <td style={localStyles.td}>{item.label}</td>
              <td style={localStyles.td}>{formatAmount(item.total.eur)}</td>
              <td style={localStyles.td}>{formatAmount(item.total.ron)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderAutomate = () => (
    <div style={styles.card}>
      <h3 style={styles.sectionTitle}>
        {autoEditId ? "Modifica automatizare" : "Date automate"}
      </h3>
      <form onSubmit={salveazaAutomatizare}>
        <input
          style={styles.input}
          placeholder="Denumire"
          value={autoDenumire}
          onChange={(event) => setAutoDenumire(event.target.value)}
        />
        <input
          style={styles.input}
          type="number"
          min="1"
          max="31"
          placeholder="Ziua lunii"
          value={autoDay}
          onChange={(event) => setAutoDay(event.target.value)}
        />
        <select
          style={styles.input}
          value={selectedAutoRubrica}
          onChange={(event) => setAutoRubrica(event.target.value)}
        >
          {categorii.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
        <input
          style={styles.input}
          type="number"
          placeholder="Suma EUR"
          value={autoSumaEur}
          onChange={(event) => {
            setAutoSumaEur(event.target.value);
            setAutoSumaRon("");
          }}
        />
        <input
          style={styles.input}
          type="number"
          placeholder="Suma RON"
          value={autoSumaRon}
          onChange={(event) => {
            setAutoSumaRon(event.target.value);
            setAutoSumaEur("");
          }}
        />
        <label style={localStyles.checkboxRow}>
          <input
            type="checkbox"
            checked={autoActiv}
            onChange={(event) => setAutoActiv(event.target.checked)}
          />
          Activ
        </label>
        <div style={localStyles.formActions}>
          <button type="submit" style={styles.blueButton}>
            {autoEditId ? "Salveaza modificarile" : "Salveaza automatizarea"}
          </button>
          {autoEditId && (
            <button
              type="button"
              style={localStyles.secondaryBtn}
              onClick={resetAutoForm}
            >
              Anuleaza editarea
            </button>
          )}
        </div>
      </form>

      <div style={localStyles.autoTotalRow}>
        <span>Total automatizari active</span>
        <strong>
          {formatAmount(totalAutomatizari.eur)} EUR /{" "}
          {formatAmount(totalAutomatizari.ron)} RON
        </strong>
      </div>
      <div style={localStyles.tableWrap}>
        <table style={localStyles.table}>
          <thead>
            <tr>
              <th style={localStyles.th}>Denumire</th>
              <th style={localStyles.th}>Ziua</th>
              <th style={localStyles.th}>Rubrica</th>
              <th style={localStyles.th}>EUR</th>
              <th style={localStyles.th}>RON</th>
              <th style={localStyles.th}>Status</th>
              <th style={localStyles.th}>Actiuni</th>
            </tr>
          </thead>
          <tbody>
            {automate.length === 0 && (
              <tr>
                <td colSpan="7" style={localStyles.td}>
                  Nu exista automatizari salvate.
                </td>
              </tr>
            )}
            {automate.map((item) => (
              <tr key={item.id}>
                <td style={localStyles.td}>{item.denumire || "-"}</td>
                <td style={localStyles.td}>{getDayFromDate(item.data)}</td>
                <td style={localStyles.td}>
                  {getRubricaLabel(item.rubrica, categorii)}
                </td>
                <td style={localStyles.td}>{formatAmount(item.suma_eur)}</td>
                <td style={localStyles.td}>{formatAmount(item.suma_ron)}</td>
                <td style={localStyles.td}>
                  <span style={localStyles.statusPill}>
                    {item.activ !== false ? "Activ" : "Inactiv"}
                  </span>
                </td>
                <td style={localStyles.td}>
                  <div style={localStyles.rowActions}>
                    <button
                      type="button"
                      style={localStyles.editBtn}
                      onClick={() => startAutoEdit(item)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      style={styles.deleteBtn}
                      onClick={() => stergeAutomatizare(item)}
                    >
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

  const renderCreareInvestitie = () => (
    <div style={styles.card}>
      <h3 style={styles.sectionTitle}>Creare investitie</h3>
      <form onSubmit={creeazaCategorie}>
        <input
          style={styles.input}
          placeholder="Denumire categorie"
          value={newCategoryLabel}
          onChange={(event) => setNewCategoryLabel(event.target.value)}
        />
        <button type="submit" style={styles.blueButton}>
          Creeaza investitie
        </button>
      </form>

      <div style={localStyles.categoryGrid}>
        {categorii.map((item) => (
          <div key={item.value} style={localStyles.categoryItem}>
            <strong>{item.label}</strong>
            <span>{item.default ? "Implicit" : "Creat"}</span>
          </div>
        ))}
      </div>
    </div>
  );

  const renderHistory = () => (
    <div style={styles.card}>
      <h3 style={styles.sectionTitle}>Fonduri investite</h3>
      <input
        type="month"
        style={styles.input}
        value={historyMonth}
        onChange={(event) => setHistoryMonth(event.target.value)}
      />
      <div style={localStyles.monthSummary}>
        <div>
          <span>Total EUR luna selectata</span>
          <strong>{formatAmount(selectedMonthTotals.eur)} EUR</strong>
        </div>
        <div>
          <span>Total RON luna selectata</span>
          <strong>{formatAmount(selectedMonthTotals.ron)} RON</strong>
        </div>
      </div>
      {filteredHistory.length === 0 && (
        <div style={styles.message}>
          Nu exista miscari de fonduri in luna selectata.
        </div>
      )}
      {filteredHistory.map((miscare) => (
        <div key={miscare.id} style={styles.row}>
          <div>
            <div style={localStyles.itemTitle}>
              {getRubricaLabel(miscare.rubrica, categorii)}
            </div>
            <div style={styles.date}>
              {miscare.data} - {miscare.username || "-"}
              {miscare.automatizare && (
                <span style={localStyles.inlinePill}>Automat</span>
              )}
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
            {!miscare.automatizare && (
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
            )}
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
          <div style={localStyles.heroLabel}>Total general EUR</div>
          <div style={localStyles.heroValue}>{formatAmount(displayTotalEur)} EUR</div>
          {loadingTotals && <div style={localStyles.heroHint}>Se incarca...</div>}
        </div>
        <div style={localStyles.heroBox}>
          <div style={localStyles.heroLabel}>Total general RON</div>
          <div style={localStyles.heroValue}>{formatAmount(displayTotalRon)} RON</div>
          {loadingTotals && <div style={localStyles.heroHint}>Se incarca...</div>}
        </div>
      </div>

      {msg && <div style={styles.message}>{msg}</div>}

      <div style={localStyles.tabWrap}>
        {[
          ["date", "Adauga fonduri"],
          ["automate", "Date automate"],
          ["creare", "Creare investitie"],
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

      {activeTab === "automate" && renderAutomate()}

      {activeTab === "creare" && renderCreareInvestitie()}

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
  heroLabel: {
    fontSize: 13,
    color: "var(--app-muted)",
    fontWeight: 800,
    marginBottom: 8,
  },
  heroValue: {
    display: "block",
    minHeight: 38,
    color: "var(--app-text)",
    fontSize: 32,
    fontWeight: 900,
    lineHeight: 1.15,
    whiteSpace: "nowrap",
  },
  heroHint: {
    marginTop: 6,
    fontSize: 12,
    color: "var(--app-muted)",
    fontWeight: 700,
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
  monthSummary: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
    gap: 10,
    marginBottom: 14,
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
  totalTd: {
    padding: "11px 12px",
    borderBottom: "1px solid var(--app-border)",
    fontSize: 14,
    fontWeight: 900,
    background: "var(--app-primary-soft)",
    color: "var(--app-primary-dark)",
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
  checkboxRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
    fontWeight: 800,
    color: "var(--app-text)",
  },
  autoTotalRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    margin: "16px 0 10px",
    padding: "10px 12px",
    border: "1px solid var(--app-border)",
    borderRadius: 4,
    background: "var(--app-panel-alt)",
    color: "var(--app-text)",
  },
  statusPill: {
    display: "inline-flex",
    alignItems: "center",
    border: "1px solid var(--app-border)",
    borderRadius: 4,
    padding: "3px 7px",
    fontSize: 12,
    fontWeight: 800,
    color: "var(--app-primary-dark)",
    background: "var(--app-primary-soft)",
  },
  inlinePill: {
    display: "inline-flex",
    alignItems: "center",
    marginLeft: 8,
    border: "1px solid var(--app-border)",
    borderRadius: 4,
    padding: "2px 6px",
    fontSize: 11,
    fontWeight: 800,
    color: "var(--app-primary-dark)",
    background: "var(--app-panel-alt)",
  },
  categoryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 10,
    marginTop: 16,
  },
  categoryItem: {
    display: "grid",
    gap: 4,
    border: "1px solid var(--app-border)",
    borderRadius: 4,
    padding: "10px 12px",
    background: "var(--app-panel-alt)",
  },
  exportActions: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 10,
  },
};
