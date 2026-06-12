import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../services/api";
import styles from "../styles/iosStyles";

const categoryLabelMap = {
  alimente: "Alimente",
  sanatate: "Sanatate",
  transport: "Transport",
  cultura: "Cultura",
  shopping: "Shopping",
  neprevazute: "Neprevazute",
  animalute: "Animalute",
  vacanta: "Vacanta",
  divertisment: "Iesiri / Restaurante / Diverse",
  investitii: "Investitii",
};

const categoryKeys = Object.keys(categoryLabelMap);
const RON_TO_EUR_FALLBACK = 0.2;

const fixedAutomationCadenceOptions = [
  { value: "lunar", label: "O data pe luna" },
  { value: "de_doua_ori_luna", label: "De 2 ori pe luna" },
  { value: "de_trei_ori_luna", label: "De 3 ori pe luna" },
  { value: "la_2_luni", label: "O data la 2 luni" },
  { value: "la_3_luni", label: "O data la 3 luni" },
  { value: "la_6_luni", label: "O data la 6 luni" },
  { value: "anual", label: "O data pe an" },
];

const fixedAutomationCadenceLabelMap = fixedAutomationCadenceOptions.reduce(
  (acc, option) => {
    acc[option.value] = option.label;
    return acc;
  },
  {}
);

const TARGET_STORAGE_KEY = "realizari_targets_v2";
const TARGET_SNAPSHOT_STORAGE_KEY = "realizari_target_snapshots_by_month_v1";
const LEGACY_TARGET_STORAGE_KEY = "realizari_targets_by_month_v1";

const getCurrentMonthKey = () => new Date().toISOString().slice(0, 7);
const round2 = (value) => Math.round(Number(value || 0) * 100) / 100;

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
  const d = new Date(value);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
};

const toUiCategory = (cat) => (cat === "auto" ? "transport" : cat);
const toApiCategory = (cat) => (cat === "transport" ? "auto" : cat);
const getExpenseMonthKey = (item) => String(item.data || "").slice(0, 7);
const isManualFixedExpense = (item) => item.sursa !== "automat";
const getFixedAutomationCadenceLabel = (value) =>
  fixedAutomationCadenceLabelMap[value] || value || "-";

const formatExpenseTitle = (item) =>
  item.expenseType === "fixe"
    ? item.descriere || "Cheltuiala fixa"
    : categoryLabelMap[toUiCategory(item.categorie)] || toUiCategory(item.categorie);

const formatExpenseType = (type) => (type === "fixe" ? "Fixa" : "Variabila");

const normalizeTargetCategories = (values = {}) =>
  categoryKeys.reduce((acc, key) => {
    const raw = Number(values[key] || 0);
    acc[key] = Number.isFinite(raw) ? raw : 0;
    return acc;
  }, {});

const normalizeTargets = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return {
    fixedTarget: Number(value.fixedTarget || 0),
    categoryTargets: normalizeTargetCategories(value.categoryTargets),
    updatedAt: value.updatedAt || null,
  };
};

const normalizeApiTarget = (value) =>
  value
    ? {
        fixedTarget: Number(value.fixed_target || 0),
        categoryTargets: normalizeTargetCategories(value.category_targets || {}),
        updatedAt: value.updated_at || null,
      }
    : null;

const normalizeApiTargetsByMonth = (items = []) =>
  items.reduce((acc, item) => {
    acc[item.luna] = normalizeApiTarget(item);
    return acc;
  }, {});

const parseTargets = (raw) => {
  if (!raw) return null;
  try {
    return normalizeTargets(JSON.parse(raw));
  } catch {
    return null;
  }
};

const parseTargetSnapshots = (raw) => {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) || {};
    return Object.entries(parsed).reduce((acc, [monthKey, targets]) => {
      const normalized = normalizeTargets(targets);
      if (normalized) acc[monthKey] = normalized;
      return acc;
    }, {});
  } catch {
    return {};
  }
};

const loadTargetState = () => {
  const savedTargets = parseTargets(localStorage.getItem(TARGET_STORAGE_KEY));
  const snapshots = {
    ...parseTargetSnapshots(localStorage.getItem(LEGACY_TARGET_STORAGE_KEY)),
    ...parseTargetSnapshots(localStorage.getItem(TARGET_SNAPSHOT_STORAGE_KEY)),
  };

  return { savedTargets, snapshots };
};

const getLatestTargetsAtOrBefore = (snapshots, monthKey) => {
  const snapshotKey = Object.keys(snapshots)
    .filter((key) => key <= monthKey)
    .sort((a, b) => b.localeCompare(a))[0];

  return snapshotKey ? snapshots[snapshotKey] : null;
};

const getTargetsForMonth = ({ savedTargets, snapshots }, monthKey) => {
  if (monthKey === getCurrentMonthKey() && savedTargets) {
    return savedTargets;
  }

  return (
    snapshots[monthKey] ||
    getLatestTargetsAtOrBefore(snapshots, monthKey) ||
    savedTargets
  );
};

export default function Cheltuieli() {
  const [mainTab, setMainTab] = useState("gestionare");
  const [tab, setTab] = useState("variabile");
  const [fixedSubTab, setFixedSubTab] = useState("manuale");
  const [categorie, setCategorie] = useState("alimente");
  const [venitTotal, setVenitTotal] = useState(0);
  const [venituri, setVenituri] = useState([]);
  const [descriere, setDescriere] = useState("");
  const [suma, setSuma] = useState("");
  const [moneda, setMoneda] = useState("EUR");
  const [data, setData] = useState(new Date().toISOString().split("T")[0]);
  const [fixe, setFixe] = useState([]);
  const [fixeAutomate, setFixeAutomate] = useState([]);
  const [variabile, setVariabile] = useState([]);
  const [editId, setEditId] = useState(null);
  const [autoEditId, setAutoEditId] = useState(null);
  const [autoDenumire, setAutoDenumire] = useState("");
  const [autoData, setAutoData] = useState(new Date().toISOString().split("T")[0]);
  const [autoCursivitate, setAutoCursivitate] = useState("lunar");
  const [autoSuma, setAutoSuma] = useState("");
  const [autoMoneda, setAutoMoneda] = useState("EUR");
  const [autoActiv, setAutoActiv] = useState(true);
  const [lastDeleted, setLastDeleted] = useState(null);
  const [undoTab, setUndoTab] = useState(null);
  const [historyMonth, setHistoryMonth] = useState(getCurrentMonthKey());
  const [exportMonth, setExportMonth] = useState(getCurrentMonthKey());
  const [targetsByMonth, setTargetsByMonth] = useState({});
  const [globalTargets, setGlobalTargets] = useState(null);
  const [ronToEurRate, setRonToEurRate] = useState(RON_TO_EUR_FALLBACK);
  const [eurRonRate, setEurRonRate] = useState(null);
  const [rateDate, setRateDate] = useState("");
  const [rateSource, setRateSource] = useState("fallback");

  const cycleRange = useMemo(() => getCurrentCycleRange(), []);
  const targetState = useMemo(() => loadTargetState(), []);

  const inCurrentCycle = useCallback(
    (itemDate) => {
      const current = toDateOnly(itemDate);
      return current >= cycleRange.start && current <= cycleRange.end;
    },
    [cycleRange]
  );

  const sortDescByNewest = useCallback((a, b) => {
    const dateA = new Date(a.created_at || a.data);
    const dateB = new Date(b.created_at || b.data);
    if (dateB.getTime() !== dateA.getTime()) {
      return dateB.getTime() - dateA.getTime();
    }
    return Number(b.id || 0) - Number(a.id || 0);
  }, []);

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
      console.warn("Curs BNR indisponibil pentru cheltuieli:", error);
      setRonToEurRate(RON_TO_EUR_FALLBACK);
      setEurRonRate(null);
      setRateDate("");
      setRateSource("fallback");
    }
  }, []);

  const convertFixedAmountToEur = useCallback(
    (amount, currency) => {
      if (currency === "RON") return round2(Number(amount || 0) * ronToEurRate);
      return round2(Number(amount || 0));
    },
    [ronToEurRate]
  );

  const loadData = useCallback(async () => {
    const [f, v, automate, buget, venituriRes, targetsRes, globalTargetsRes] =
      await Promise.all([
        api.get("cheltuieli-fixe/"),
        api.get("cheltuieli-variabile/"),
        api.get("cheltuieli-fixe-automate/"),
        api.get("buget/lunar/"),
        api.get("venituri/"),
        api.get("realizari-targets/"),
        api.get("obiective-cheltuieli-global/"),
      ]);

    setFixe(f.data || []);
    setFixeAutomate(automate.data || []);
    setVariabile(v.data || []);
    setVenituri(venituriRes.data || []);
    setVenitTotal(Number(buget.data?.venit || 0));
    setTargetsByMonth(normalizeApiTargetsByMonth(targetsRes.data || []));
    setGlobalTargets(normalizeApiTarget(globalTargetsRes.data));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 0);

    return () => clearTimeout(timer);
  }, [loadData]);

  useEffect(() => {
    fetchExchangeRate();
  }, [fetchExchangeRate]);

  const resetForm = () => {
    setEditId(null);
    setDescriere("");
    setCategorie("alimente");
    setSuma("");
    setMoneda("EUR");
    setData(new Date().toISOString().split("T")[0]);
  };

  const resetAutoForm = () => {
    setAutoEditId(null);
    setAutoDenumire("");
    setAutoData(new Date().toISOString().split("T")[0]);
    setAutoCursivitate("lunar");
    setAutoSuma("");
    setAutoMoneda("EUR");
    setAutoActiv(true);
  };

  const startEdit = (item, forcedTab = tab) => {
    setTab(forcedTab);
    setEditId(item.id);
    setSuma(item.suma);
    setMoneda(item.moneda);
    setData(item.data);

    if (forcedTab === "fixe") {
      setFixedSubTab("manuale");
      setDescriere(item.descriere);
    } else {
      setCategorie(toUiCategory(item.categorie));
    }

    setMainTab("gestionare");
  };

  const startAutoEdit = (item) => {
    setFixedSubTab("automate");
    setAutoEditId(item.id);
    setAutoDenumire(item.denumire || "");
    setAutoData(item.data || new Date().toISOString().split("T")[0]);
    setAutoCursivitate(item.cursivitate || "lunar");
    setAutoSuma(item.suma || "");
    setAutoMoneda(item.moneda || "EUR");
    setAutoActiv(item.activ !== false);
    setEditId(null);
    setMainTab("gestionare");
  };

  const adauga = async () => {
    if (!suma) return;

    const payload =
      tab === "fixe"
        ? {
            descriere,
            suma: convertFixedAmountToEur(suma, moneda),
            moneda: "EUR",
            data,
          }
        : { categorie: toApiCategory(categorie), suma, moneda, data };

    if (editId) {
      await api.put(
        `${tab === "fixe" ? "cheltuieli-fixe" : "cheltuieli-variabile"}/${editId}/`,
        payload
      );
    } else {
      await api.post(
        tab === "fixe" ? "cheltuieli-fixe/" : "cheltuieli-variabile/",
        payload
      );
    }

    resetForm();
    loadData();
  };

  const salveazaAutomat = async () => {
    if (!autoDenumire || !autoSuma || !autoData) return;

    const payload = {
      denumire: autoDenumire,
      data: autoData,
      cursivitate: autoCursivitate,
      suma: convertFixedAmountToEur(autoSuma, autoMoneda),
      moneda: "EUR",
      activ: autoActiv,
    };

    if (autoEditId) {
      await api.put(`cheltuieli-fixe-automate/${autoEditId}/`, payload);
    } else {
      await api.post("cheltuieli-fixe-automate/", payload);
    }

    resetAutoForm();
    loadData();
  };

  const stergeAutomat = async (item) => {
    if (!window.confirm("Sigur stergi aceasta automatizare?")) return;

    await api.delete(`cheltuieli-fixe-automate/${item.id}/`);
    if (autoEditId === item.id) {
      resetAutoForm();
    }
    loadData();
  };

  const sterge = async (item, forcedTab = tab) => {
    if (!window.confirm("Sigur stergi?")) return;

    setLastDeleted(item);
    setUndoTab(forcedTab);
    await api.delete(
      `${forcedTab === "fixe" ? "cheltuieli-fixe" : "cheltuieli-variabile"}/${item.id}/`
    );
    loadData();

    setTimeout(() => {
      setLastDeleted(null);
      setUndoTab(null);
    }, 5000);
  };

  const undoDelete = async () => {
    if (!lastDeleted) return;

    const payload =
      undoTab === "fixe"
        ? {
            descriere: lastDeleted.descriere,
            suma: lastDeleted.suma,
            moneda: lastDeleted.moneda,
            data: lastDeleted.data,
          }
        : {
            categorie: toApiCategory(toUiCategory(lastDeleted.categorie)),
            suma: lastDeleted.suma,
            moneda: lastDeleted.moneda,
            data: lastDeleted.data,
          };

    await api.post(
      undoTab === "fixe" ? "cheltuieli-fixe/" : "cheltuieli-variabile/",
      payload
    );
    setLastDeleted(null);
    setUndoTab(null);
    loadData();
  };

  const fixedRows = useMemo(
    () => fixe.map((item) => ({ ...item, expenseType: "fixe" })),
    [fixe]
  );
  const manualFixedRows = useMemo(
    () => fixedRows.filter(isManualFixedExpense),
    [fixedRows]
  );
  const variableRows = useMemo(
    () =>
      variabile
        .filter((item) => item.categorie !== "vacanta_cheltuita")
        .map((item) => ({ ...item, expenseType: "variabile" })),
    [variabile]
  );
  const allExpenseRows = useMemo(
    () => [...fixedRows, ...variableRows].sort(sortDescByNewest),
    [fixedRows, sortDescByNewest, variableRows]
  );

  const list = useMemo(
    () =>
      (tab === "fixe" ? manualFixedRows : variableRows)
        .slice()
        .sort(sortDescByNewest)
        .slice(0, 10),
    [manualFixedRows, sortDescByNewest, tab, variableRows]
  );

  const totalFixe = useMemo(
    () =>
      fixe
        .filter((item) => inCurrentCycle(item.data))
        .reduce((acc, item) => acc + Number(item.suma || 0), 0),
    [fixe, inCurrentCycle]
  );

  const totalVariabile = useMemo(
    () =>
      variabile
        .filter(
          (item) => inCurrentCycle(item.data) && item.categorie !== "vacanta_cheltuita"
        )
        .reduce((acc, item) => acc + Number(item.suma || 0), 0),
    [inCurrentCycle, variabile]
  );

  const totalCheltuit = totalFixe + totalVariabile;
  const baniRamasi = venitTotal - totalCheltuit;
  const procent =
    venitTotal > 0 ? Math.round((totalCheltuit / venitTotal) * 100) : 0;
  const showManualExpenseEntry = tab !== "fixe" || fixedSubTab === "manuale";
  const manualFixedPreview =
    tab === "fixe" && moneda === "RON" && suma
      ? convertFixedAmountToEur(suma, moneda)
      : null;
  const autoFixedPreview =
    autoMoneda === "RON" && autoSuma
      ? convertFixedAmountToEur(autoSuma, autoMoneda)
      : null;
  const rateLabel =
    rateSource === "BNR" && eurRonRate
      ? `Curs BNR: 1 EUR = ${eurRonRate} RON${rateDate ? ` (${rateDate})` : ""}`
      : "Curs BNR indisponibil, folosesc curs fallback.";

  const variableStatusRows = useMemo(() => {
    const variableStatus = variabile
      .filter(
        (item) => inCurrentCycle(item.data) && item.categorie !== "vacanta_cheltuita"
      )
      .reduce((acc, item) => {
        const key = toUiCategory(item.categorie || "neprevazute");
        acc[key] = (acc[key] || 0) + Number(item.suma || 0);
        return acc;
      }, {});

    return Object.entries(variableStatus)
      .sort(([, a], [, b]) => b - a)
      .map(([key, sum]) => ({
        key,
        label: categoryLabelMap[key] || key,
        sum,
      }));
  }, [inCurrentCycle, variabile]);

  const totalVariabileCurente = variableStatusRows.reduce(
    (acc, row) => acc + row.sum,
    0
  );

  const combinedHistory = useMemo(
    () =>
      allExpenseRows
        .filter((item) => getExpenseMonthKey(item) === historyMonth)
        .sort(sortDescByNewest),
    [allExpenseRows, historyMonth, sortDescByNewest]
  );

  const exportRows = useMemo(
    () =>
      allExpenseRows
        .filter((item) => getExpenseMonthKey(item) === exportMonth)
        .sort(sortDescByNewest),
    [allExpenseRows, exportMonth, sortDescByNewest]
  );

  const exportVenitTotal = venituri
    .filter((item) => getExpenseMonthKey(item) === exportMonth)
    .reduce((acc, item) => acc + Number(item.suma || 0), 0);
  const exportFixedTotal = exportRows
    .filter((item) => item.expenseType === "fixe")
    .reduce((acc, item) => acc + Number(item.suma || 0), 0);
  const exportCategoryTotals = exportRows
    .filter((item) => item.expenseType === "variabile")
    .reduce((acc, item) => {
      const key = toUiCategory(item.categorie || "neprevazute");
      acc[key] = (acc[key] || 0) + Number(item.suma || 0);
      return acc;
    }, {});
  const exportTotalCheltuit = exportRows.reduce(
    (acc, item) => acc + Number(item.suma || 0),
    0
  );
  const exportRamas = exportVenitTotal - exportTotalCheltuit;
  const exportTargets =
    targetsByMonth[exportMonth] ||
    (exportMonth >= getCurrentMonthKey() ? globalTargets : null) ||
    getTargetsForMonth(targetState, exportMonth);
  const exportAchievements = [
    {
      key: "fixe",
      label: "Cheltuieli fixe",
      actual: exportFixedTotal,
      target: Number(exportTargets?.fixedTarget || 0),
    },
    ...categoryKeys.map((key) => ({
      key,
      label: categoryLabelMap[key],
      actual: Number(exportCategoryTotals[key] || 0),
      target: Number(exportTargets?.categoryTargets?.[key] || 0),
    })),
  ];

  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const escapeHtml = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const makeExportTable = (rows, heading) =>
    `<h3>${escapeHtml(heading)}</h3><table><tbody>${rows
      .map(
        (row, rowIndex) =>
          `<tr>${row
            .map((value) =>
              rowIndex === 0
                ? `<th>${escapeHtml(value)}</th>`
                : `<td>${escapeHtml(value)}</td>`
            )
            .join("")}</tr>`
      )
      .join("")}</tbody></table>`;

  const buildExportTables = () => {
    const summaryRows = [
      ["Indicator", "Valoare"],
      ["Luna", exportMonth],
      ["Venit total", `${exportVenitTotal.toFixed(2)} EUR`],
      ["Total cheltuit", `${exportTotalCheltuit.toFixed(2)} EUR`],
      ["Suma economisita sau ramasa", `${exportRamas.toFixed(2)} EUR`],
    ];
    const categoryRows = [
      ["Categorie", "Total"],
      ["Cheltuieli fixe", `${exportFixedTotal.toFixed(2)} EUR`],
      ...Object.entries(exportCategoryTotals).map(([key, value]) => [
        categoryLabelMap[key] || key,
        `${Number(value).toFixed(2)} EUR`,
      ]),
    ];
    const objectiveRows = [
      ["Obiectiv", "Cheltuit", "Tinta", "% din tinta", "% din venit"],
      ...exportAchievements.map((row) => {
        const targetPercent =
          row.target > 0 ? Math.round((row.actual / row.target) * 100) : 0;
        const incomePercent =
          exportVenitTotal > 0
            ? Math.round((row.actual / exportVenitTotal) * 100)
            : 0;
        return [
          row.label,
          `${row.actual.toFixed(2)} EUR`,
          `${row.target.toFixed(2)} EUR`,
          `${targetPercent}%`,
          `${incomePercent}%`,
        ];
      }),
    ];
    const detailRows = [
      ["Data", "Tip", "Descriere/Categorie", "Suma", "Moneda", "User"],
      ...exportRows.map((row) => [
        row.data,
        formatExpenseType(row.expenseType),
        formatExpenseTitle(row),
        row.suma,
        row.moneda,
        row.username || "-",
      ]),
    ];

    return { summaryRows, categoryRows, objectiveRows, detailRows };
  };

  const buildExportHtml = () => {
    const tables = buildExportTables();
    return `<!doctype html><html><head><meta charset="UTF-8" /><title>Desfasurator cheltuieli ${escapeHtml(exportMonth)}</title><style>
      body { font-family: Segoe UI, Arial, sans-serif; color: #10201a; margin: 28px; }
      h1 { font-size: 22px; margin: 0 0 6px; }
      h3 { font-size: 15px; margin: 22px 0 8px; }
      .meta { color: #5f6f66; font-size: 12px; margin-bottom: 16px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 14px; page-break-inside: auto; }
      th, td { border: 1px solid #cfd8d3; padding: 7px 8px; text-align: left; font-size: 12px; }
      th { background: #eef2f1; font-weight: 700; }
      tr { page-break-inside: avoid; page-break-after: auto; }
      @media print { body { margin: 14mm; } }
    </style></head><body>
      <h1>Desfasurator cheltuieli</h1>
      <div class="meta">Luna ${escapeHtml(exportMonth)}. Generat la ${escapeHtml(new Date().toLocaleString("ro-RO"))}</div>
      ${makeExportTable(tables.summaryRows, "Sumar")}
      ${makeExportTable(tables.categoryRows, "Totaluri pe categorie")}
      ${makeExportTable(tables.objectiveRows, "Obiective cheltuieli")}
      ${makeExportTable(tables.detailRows, "Detalii cheltuieli")}
    </body></html>`;
  };

  const downloadExcel = () => {
    const excelHtml = buildExportHtml();

    downloadBlob(
      new Blob([excelHtml], { type: "application/vnd.ms-excel;charset=utf-8" }),
      `desfasurator-cheltuieli-${exportMonth}.xls`
    );
  };

  const downloadPdf = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(buildExportHtml());
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Gestionare cheltuieli</h2>

      <div style={localStyles.mainTabsWrapper}>
        {[
          ["gestionare", "Gestionare"],
          ["status-variabile", "Status variabile"],
          ["istoric-cheltuieli", "Istoric cheltuieli"],
          ["desfasurator-cheltuieli", "Desfasurator"],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setMainTab(key)}
            style={{
              ...localStyles.mainTabBtn,
              ...(mainTab === key ? localStyles.mainTabBtnActive : {}),
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {mainTab === "gestionare" && (
        <>
          <div style={styles.heroCard}>
            <div style={styles.heroLabel}>Sold disponibil</div>
            <div
              style={{
                ...styles.heroValue,
                color: baniRamasi >= 0 ? "#10201a" : "#b42318",
              }}
            >
              {Number(baniRamasi || 0).toFixed(2)} EUR
            </div>
          </div>

          <div style={localStyles.segmentWrapper}>
            <button
              onClick={() => setTab("fixe")}
              style={{
                ...localStyles.segmentBtn,
                ...(tab === "fixe" ? localStyles.segmentBtnActive : {}),
              }}
            >
              Fixe
            </button>
            <button
              onClick={() => setTab("variabile")}
              style={{
                ...localStyles.segmentBtn,
                ...(tab === "variabile" ? localStyles.segmentBtnActive : {}),
                borderRight: "none",
              }}
            >
              Variabile
            </button>
          </div>

          <div style={localStyles.totalCard}>
            <div style={localStyles.totalRow}>
              <span>Total cheltuit</span>
              <strong>{totalCheltuit.toFixed(2)} EUR</strong>
            </div>
            <div style={localStyles.progressBarWrapper}>
              <div
                style={{
                  ...localStyles.progressBar,
                  width: `${Math.min(procent, 100)}%`,
                  background: procent > 80 ? "#b42318" : "#146c43",
                }}
              />
            </div>
            <div style={localStyles.percentText}>{procent}% din venit</div>
            <div style={localStyles.breakdownRow}>
              <span>Fixe</span>
              <strong>{totalFixe.toFixed(2)} EUR</strong>
            </div>
            <div style={localStyles.breakdownRow}>
              <span>Variabile</span>
              <strong>{totalVariabile.toFixed(2)} EUR</strong>
            </div>
          </div>

          {tab === "fixe" && (
            <div style={localStyles.subTabsWrapper}>
              <button
                onClick={() => {
                  setFixedSubTab("manuale");
                  resetAutoForm();
                }}
                style={{
                  ...localStyles.subTabBtn,
                  ...(fixedSubTab === "manuale" ? localStyles.subTabBtnActive : {}),
                }}
              >
                Date manuale
              </button>
              <button
                onClick={() => {
                  setFixedSubTab("automate");
                  resetForm();
                }}
                style={{
                  ...localStyles.subTabBtn,
                  ...(fixedSubTab === "automate" ? localStyles.subTabBtnActive : {}),
                }}
              >
                Date automate
              </button>
            </div>
          )}

          {showManualExpenseEntry && (
            <div style={styles.card}>
              <h3 style={styles.sectionTitle}>
                {editId ? "Modifica inregistrare" : "Adauga inregistrare"}
              </h3>
              {tab === "fixe" ? (
                <input
                  style={styles.input}
                  placeholder="Descriere"
                  value={descriere}
                  onChange={(e) => setDescriere(e.target.value)}
                />
              ) : (
                <select
                  style={styles.input}
                  value={categorie}
                  onChange={(e) => setCategorie(e.target.value)}
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
                <option value="RON">RON / lei</option>
              </select>
              {manualFixedPreview !== null && (
                <div style={localStyles.previewText}>
                  Conversie automata: {manualFixedPreview.toFixed(2)} EUR.{" "}
                  {rateLabel}
                </div>
              )}
              <input
                style={styles.input}
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
              />
              <div style={localStyles.formActions}>
                <button style={styles.blueButton} onClick={adauga}>
                  {editId ? "Salveaza" : "Adauga"}
                </button>
                {editId && (
                  <button style={localStyles.cancelBtn} onClick={resetForm}>
                    Anuleaza
                  </button>
                )}
              </div>
            </div>
          )}

          {tab === "fixe" && fixedSubTab === "automate" && (
            <div style={styles.card}>
              <h3 style={styles.sectionTitle}>
                {autoEditId ? "Modifica automatizare" : "Adauga automatizare"}
              </h3>
              <input
                style={styles.input}
                placeholder="Denumire"
                value={autoDenumire}
                onChange={(e) => setAutoDenumire(e.target.value)}
              />
              <input
                style={styles.input}
                type="date"
                value={autoData}
                onChange={(e) => setAutoData(e.target.value)}
              />
              <select
                style={styles.input}
                value={autoCursivitate}
                onChange={(e) => setAutoCursivitate(e.target.value)}
              >
                {fixedAutomationCadenceOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <input
                style={styles.input}
                type="number"
                placeholder="Suma"
                value={autoSuma}
                onChange={(e) => setAutoSuma(e.target.value)}
              />
              <select
                style={styles.input}
                value={autoMoneda}
                onChange={(e) => setAutoMoneda(e.target.value)}
              >
                <option value="EUR">EUR</option>
                <option value="RON">RON / lei</option>
              </select>
              {autoFixedPreview !== null && (
                <div style={localStyles.previewText}>
                  Conversie automata: {autoFixedPreview.toFixed(2)} EUR.{" "}
                  {rateLabel}
                </div>
              )}
              <label style={localStyles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={autoActiv}
                  onChange={(e) => setAutoActiv(e.target.checked)}
                />
                Activ
              </label>
              <div style={localStyles.formActions}>
                <button style={styles.blueButton} onClick={salveazaAutomat}>
                  {autoEditId ? "Salveaza" : "Adauga"}
                </button>
                {autoEditId && (
                  <button style={localStyles.cancelBtn} onClick={resetAutoForm}>
                    Anuleaza
                  </button>
                )}
              </div>

              <div style={localStyles.autoTableWrap}>
                <table style={localStyles.autoTable}>
                  <thead>
                    <tr>
                      <th style={localStyles.tableHeaderCell}>Denumire</th>
                      <th style={localStyles.tableHeaderCell}>Data</th>
                      <th style={localStyles.tableHeaderCell}>Cursivitate</th>
                      <th style={localStyles.tableHeaderCell}>Suma</th>
                      <th style={localStyles.tableHeaderCell}>Status</th>
                      <th style={localStyles.tableHeaderCell}>Actiuni</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fixeAutomate.length === 0 && (
                      <tr>
                        <td colSpan="6" style={localStyles.emptyTableCell}>
                          Nu exista automatizari salvate.
                        </td>
                      </tr>
                    )}
                    {fixeAutomate.map((item) => (
                      <tr key={item.id}>
                        <td style={localStyles.tableCell}>{item.denumire}</td>
                        <td style={localStyles.tableCell}>
                          {new Date(item.data).toLocaleDateString("ro-RO")}
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
                            <button
                              onClick={() => startAutoEdit(item)}
                              style={localStyles.editBtn}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => stergeAutomat(item)}
                              style={styles.deleteBtn}
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
          )}

          {showManualExpenseEntry && lastDeleted && (
            <div style={localStyles.undoCard}>
              <span>Cheltuiala stearsa</span>
              <button onClick={undoDelete} style={localStyles.undoBtn}>
                Undo
              </button>
            </div>
          )}

          {showManualExpenseEntry && (
            <div style={styles.card}>
              <h3 style={styles.sectionTitle}>Ultimele 10 cheltuieli introduse</h3>
              {list.map((c) => (
                <ExpenseRow
                  key={`${c.expenseType}-${c.id}`}
                  item={c}
                  onEdit={() => startEdit(c, c.expenseType)}
                  onDelete={() => sterge(c, c.expenseType)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {mainTab === "status-variabile" && (
        <div style={styles.card}>
          <h3 style={styles.sectionTitle}>Status cheltuieli variabile</h3>
          <div style={styles.date}>
            Interval curent: {cycleRange.start.toLocaleDateString("ro-RO")} -{" "}
            {cycleRange.end.toLocaleDateString("ro-RO")}
          </div>
          <div style={{ marginTop: 16 }}>
            {variableStatusRows.length === 0 && (
              <div style={styles.message}>
                Nu exista cheltuieli variabile in interval.
              </div>
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
      )}

      {mainTab === "istoric-cheltuieli" && (
        <div style={styles.card}>
          <h3 style={styles.sectionTitle}>Istoric cheltuieli</h3>
          <div style={styles.date}>
            Selecteaza luna pentru care vrei sa vezi si sa modifici cheltuielile.
          </div>
          <input
            type="month"
            style={styles.input}
            value={historyMonth}
            onChange={(e) => setHistoryMonth(e.target.value)}
          />
          <div style={{ marginTop: 14 }}>
            {combinedHistory.length === 0 && (
              <div style={styles.message}>
                Nu exista cheltuieli in luna selectata.
              </div>
            )}
            {combinedHistory.map((item) => (
              <ExpenseRow
                key={`${item.expenseType}-${item.id}-${item.data}`}
                item={item}
                showType
                onEdit={() => startEdit(item, item.expenseType)}
                onDelete={() => sterge(item, item.expenseType)}
              />
            ))}
          </div>
        </div>
      )}

      {mainTab === "desfasurator-cheltuieli" && (
        <div style={styles.card}>
          <h3 style={styles.sectionTitle}>Desfasurator cheltuieli</h3>
          <div style={styles.date}>
            Alege luna pentru export. Fisierele includ sumar si detalii.
          </div>
          <input
            type="month"
            style={styles.input}
            value={exportMonth}
            onChange={(e) => setExportMonth(e.target.value)}
          />
          <div style={localStyles.exportActions}>
            <button style={styles.blueButton} onClick={downloadExcel}>
              Descarca Excel
            </button>
            <button style={localStyles.secondaryButton} onClick={downloadPdf}>
              Descarca PDF
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ExpenseRow({ item, onEdit, onDelete, showType = false }) {
  return (
    <div style={styles.row}>
      <div>
        <div style={{ fontWeight: 700 }}>{formatExpenseTitle(item)}</div>
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

const localStyles = {
  mainTabsWrapper: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
    gap: 8,
    marginBottom: 16,
  },
  mainTabBtn: {
    border: "1px solid #cfd8d3",
    background: "#ffffff",
    borderRadius: 4,
    padding: "10px 12px",
    fontWeight: 700,
    cursor: "pointer",
    textAlign: "left",
  },
  mainTabBtnActive: {
    background: "#eef7fb",
    color: "#174a6b",
    borderColor: "#1f5f8b",
  },
  segmentWrapper: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    border: "1px solid #cfd8d3",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 16,
  },
  segmentBtn: {
    border: "none",
    borderRight: "1px solid #cfd8d3",
    background: "#ffffff",
    padding: "10px 12px",
    fontWeight: 700,
    cursor: "pointer",
  },
  segmentBtnActive: {
    background: "#eef7fb",
    color: "#174a6b",
  },
  subTabsWrapper: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 8,
    marginTop: 18,
    marginBottom: 14,
  },
  subTabBtn: {
    border: "1px solid #cfd8d3",
    background: "#ffffff",
    borderRadius: 4,
    padding: "10px 12px",
    fontWeight: 700,
    cursor: "pointer",
  },
  subTabBtnActive: {
    background: "#eef7fb",
    borderColor: "#1f5f8b",
    color: "#174a6b",
  },
  formActions: {
    marginTop: 20,
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: 10,
    alignItems: "center",
  },
  cancelBtn: {
    background: "#ffffff",
    border: "1px solid #cfd8d3",
    borderRadius: 4,
    color: "#5f6f66",
    fontWeight: 700,
    cursor: "pointer",
    padding: "10px 14px",
  },
  undoCard: {
    marginTop: 20,
    padding: 14,
    background: "#fff8e5",
    border: "1px solid #ead08a",
    borderRadius: 4,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  undoBtn: {
    background: "none",
    border: "none",
    color: "#174a6b",
    fontWeight: 800,
    cursor: "pointer",
  },
  editBtn: {
    background: "#ffffff",
    border: "1px solid #cfd8d3",
    borderRadius: 4,
    color: "#174a6b",
    fontWeight: 700,
    fontSize: 12,
    cursor: "pointer",
    padding: "4px 7px",
  },
  previewText: {
    marginTop: -4,
    marginBottom: 12,
    fontSize: 12,
    color: "#5f6f66",
  },
  rowActions: {
    marginTop: 6,
    display: "flex",
    gap: 10,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  userBadge: {
    background: "#f8faf9",
    color: "#5f6f66",
    border: "1px solid #cfd8d3",
    padding: "2px 6px",
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 700,
  },
  totalCard: {
    marginTop: 20,
    padding: 16,
    background: "#ffffff",
    border: "1px solid #cfd8d3",
    borderRadius: 6,
    marginBottom: 18,
  },
  totalRow: {
    display: "flex",
    justifyContent: "space-between",
    fontWeight: 800,
    marginBottom: 10,
  },
  progressBarWrapper: {
    height: 8,
    background: "#e4ebe7",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    transition: "width 0.2s ease",
  },
  percentText: {
    marginTop: 8,
    fontSize: 13,
    color: "#5f6f66",
  },
  breakdownRow: {
    display: "flex",
    justifyContent: "space-between",
    marginTop: 10,
    fontSize: 14,
    fontWeight: 700,
  },
  checkboxRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
    color: "#10201a",
    fontWeight: 700,
  },
  autoTableWrap: {
    marginTop: 22,
    overflowX: "auto",
    border: "1px solid #cfd8d3",
    borderRadius: 4,
  },
  autoTable: {
    width: "100%",
    minWidth: 720,
    borderCollapse: "collapse",
    fontSize: 14,
  },
  emptyTableCell: {
    padding: 18,
    textAlign: "center",
    color: "#5f6f66",
  },
  tableHeaderCell: {
    padding: "11px 10px",
    textAlign: "left",
    background: "#f8faf9",
    borderBottom: "1px solid #cfd8d3",
    color: "#10201a",
    fontWeight: 800,
    whiteSpace: "nowrap",
  },
  tableCell: {
    padding: "11px 10px",
    borderBottom: "1px solid #e4ebe7",
    verticalAlign: "middle",
  },
  tableActionGroup: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  summaryRow: {
    display: "flex",
    justifyContent: "space-between",
    background: "#f8faf9",
    borderRadius: 4,
    marginTop: 8,
    padding: "12px 10px",
  },
  exportActions: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
    marginTop: 16,
  },
  secondaryButton: {
    background: "#ffffff",
    color: "#174a6b",
    border: "1px solid #cfd8d3",
    borderRadius: 4,
    padding: "10px 14px",
    fontWeight: 700,
    cursor: "pointer",
  },
};
