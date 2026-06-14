import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../services/api";
import { getCachedApiData } from "../services/apiConfig";
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
const fixedAutomationMonthIntervals = {
  lunar: 1,
  de_doua_ori_luna: 1,
  de_trei_ori_luna: 1,
  la_2_luni: 2,
  la_3_luni: 3,
  la_6_luni: 6,
  anual: 12,
};
const fixedAutomationDayOffsets = {
  lunar: [0],
  de_doua_ori_luna: [0, 15],
  de_trei_ori_luna: [0, 10, 20],
  la_2_luni: [0],
  la_3_luni: [0],
  la_6_luni: [0],
  anual: [0],
};

const TARGET_STORAGE_KEY = "realizari_targets_v2";
const TARGET_SNAPSHOT_STORAGE_KEY = "realizari_target_snapshots_by_month_v1";
const LEGACY_TARGET_STORAGE_KEY = "realizari_targets_by_month_v1";
const emptyBudgetSummary = {
  venitBrut: 0,
  deduceriCredite: 0,
  deduceriAutomate: 0,
  deduceriTotal: 0,
  venitNet: 0,
};

const buildBudgetSummary = (data) => ({
  venitBrut: Number(data?.venit_brut || 0),
  deduceriCredite: Number(data?.deduceri_credite || 0),
  deduceriAutomate: Number(data?.deduceri_automate || 0),
  deduceriTotal: Number(data?.deduceri_total || 0),
  venitNet: Number(data?.venit || 0),
});

const getCurrentMonthKey = () => new Date().toISOString().slice(0, 7);
const round2 = (value) => Math.round(Number(value || 0) * 100) / 100;
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
const parseIsoDate = (value) => {
  const [year, month, day] = String(value || "")
    .split("-")
    .map((part) => Number(part));
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};
const formatIsoDate = (value) =>
  `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(
    value.getDate()
  ).padStart(2, "0")}`;
const getMonthRange = (monthKey) => {
  const [year, month] = String(monthKey || getCurrentMonthKey())
    .split("-")
    .map((part) => Number(part));
  const safeYear = year || new Date().getFullYear();
  const safeMonthIndex = month ? month - 1 : new Date().getMonth();
  return {
    start: new Date(safeYear, safeMonthIndex, 1),
    end: new Date(safeYear, safeMonthIndex + 1, 0),
  };
};
const addMonths = (baseDate, monthCount) => {
  const next = new Date(baseDate);
  const targetMonth = baseDate.getMonth() + monthCount;
  next.setMonth(targetMonth, 1);
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(baseDate.getDate(), lastDay));
  return next;
};
const iterFixedAutomationDates = (schedule, start, end) => {
  const scheduleDate = parseIsoDate(schedule?.data);
  if (!scheduleDate || scheduleDate > end) return [];

  const interval = fixedAutomationMonthIntervals[schedule.cursivitate] || 1;
  const monthDelta =
    (start.getFullYear() - scheduleDate.getFullYear()) * 12 +
    start.getMonth() -
    scheduleDate.getMonth();
  let step = Math.max(0, Math.floor(monthDelta / interval) - 1);
  const dates = [];
  const seenDates = new Set();

  while (true) {
    const monthAnchor = addMonths(scheduleDate, step * interval);
    if (monthAnchor > end) break;

    if (monthAnchor >= scheduleDate) {
      const lastDay = new Date(
        monthAnchor.getFullYear(),
        monthAnchor.getMonth() + 1,
        0
      ).getDate();
      const offsets = fixedAutomationDayOffsets[schedule.cursivitate] || [0];

      offsets.forEach((offset) => {
        const occurrence = new Date(
          monthAnchor.getFullYear(),
          monthAnchor.getMonth(),
          Math.min(scheduleDate.getDate() + offset, lastDay)
        );
        const key = formatIsoDate(occurrence);
        if (
          occurrence >= start &&
          occurrence <= end &&
          occurrence >= scheduleDate &&
          !seenDates.has(key)
        ) {
          seenDates.add(key);
          dates.push(key);
        }
      });
    }

    step += 1;
  }

  return dates.sort();
};

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

const getApiErrorMessage = (error, fallback) => {
  if (error?.response?.status === 401) {
    return "Sesiunea a expirat sau nu esti autentificat. Delogheaza-te si intra din nou in cont.";
  }

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

const upsertById = (items, nextItem) => {
  const exists = items.some((item) => item.id === nextItem.id);
  if (!exists) return [nextItem, ...items];
  return items.map((item) => (item.id === nextItem.id ? nextItem : item));
};

const notifyFinanceDataChanged = () => {
  window.dispatchEvent(new Event("finance-data-updated"));
};

export default function Cheltuieli({ user }) {
  const cachedFixe = getCachedApiData("cheltuieli-fixe/");
  const cachedVariabile = getCachedApiData("cheltuieli-variabile/");
  const cachedFixeAutomate = getCachedApiData("cheltuieli-fixe-automate/");
  const cachedBudget = getCachedApiData("buget/lunar/");
  const cachedBudgetSummary = cachedBudget
    ? buildBudgetSummary(cachedBudget)
    : emptyBudgetSummary;
  const cachedVenituri = getCachedApiData("venituri/");
  const cachedCredits = getCachedApiData("credite/");
  const cachedTargets = getCachedApiData("realizari-targets/");
  const cachedGlobalTargets = getCachedApiData("obiective-cheltuieli-global/");
  const cachedRate = getCachedApiData("curs-bnr/");
  const cachedRonToEurRate =
    Number(cachedRate?.ron_eur || 0) || RON_TO_EUR_FALLBACK;
  const cachedEurRonRate = Number(cachedRate?.eur_ron || 0) || null;

  const [mainTab, setMainTab] = useState("gestionare");
  const [tab, setTab] = useState("variabile");
  const [fixedSubTab, setFixedSubTab] = useState("manuale");
  const [categorie, setCategorie] = useState("alimente");
  const [venitTotal, setVenitTotal] = useState(cachedBudgetSummary.venitNet);
  const [venituri, setVenituri] = useState(() =>
    Array.isArray(cachedVenituri) ? cachedVenituri : []
  );
  const [credits, setCredits] = useState(() =>
    Array.isArray(cachedCredits) ? cachedCredits : []
  );
  const [descriere, setDescriere] = useState("");
  const [suma, setSuma] = useState("");
  const [moneda, setMoneda] = useState("EUR");
  const [data, setData] = useState(new Date().toISOString().split("T")[0]);
  const [fixe, setFixe] = useState(() =>
    Array.isArray(cachedFixe) ? cachedFixe : []
  );
  const [fixeAutomate, setFixeAutomate] = useState(() =>
    Array.isArray(cachedFixeAutomate) ? cachedFixeAutomate : []
  );
  const [variabile, setVariabile] = useState(() =>
    Array.isArray(cachedVariabile) ? cachedVariabile : []
  );
  const [editId, setEditId] = useState(null);
  const [autoEditId, setAutoEditId] = useState(null);
  const [autoDenumire, setAutoDenumire] = useState("");
  const [autoDay, setAutoDay] = useState(String(new Date().getDate()));
  const [autoCursivitate, setAutoCursivitate] = useState("lunar");
  const [autoSuma, setAutoSuma] = useState("");
  const [autoMoneda, setAutoMoneda] = useState("EUR");
  const [autoActiv, setAutoActiv] = useState(true);
  const [lastDeleted, setLastDeleted] = useState(null);
  const [undoTab, setUndoTab] = useState(null);
  const [historyMonth, setHistoryMonth] = useState(getCurrentMonthKey());
  const [statusMonth, setStatusMonth] = useState(getCurrentMonthKey());
  const [exportMonth, setExportMonth] = useState(getCurrentMonthKey());
  const [targetsByMonth, setTargetsByMonth] = useState(() =>
    normalizeApiTargetsByMonth(Array.isArray(cachedTargets) ? cachedTargets : [])
  );
  const [globalTargets, setGlobalTargets] = useState(() =>
    normalizeApiTarget(cachedGlobalTargets)
  );
  const [budgetSummary, setBudgetSummary] = useState(cachedBudgetSummary);
  const [ronToEurRate, setRonToEurRate] = useState(cachedRonToEurRate);
  const [eurRonRate, setEurRonRate] = useState(cachedEurRonRate);
  const [rateDate, setRateDate] = useState(cachedRate?.date || "");
  const [rateSource, setRateSource] = useState(cachedRate?.source || "fallback");
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState("info");

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

  const convertAmountToEur = useCallback(
    (amount, currency) => {
      if (currency === "RON") return round2(Number(amount || 0) * ronToEurRate);
      return round2(Number(amount || 0));
    },
    [ronToEurRate]
  );

  const loadData = useCallback(async () => {
    setMsg("");

    try {
      const [f, v] = await Promise.all([
        api.get("cheltuieli-fixe/"),
        api.get("cheltuieli-variabile/"),
      ]);

      setFixe(f.data || []);
      setVariabile(v.data || []);

      const optionalResults = await Promise.allSettled([
        api.get("cheltuieli-fixe-automate/"),
        api.get("buget/lunar/"),
        api.get("venituri/"),
        api.get("credite/"),
        api.get("realizari-targets/"),
        api.get("obiective-cheltuieli-global/"),
      ]);

      const [automate, buget, venituriRes, creditsRes, targetsRes, globalTargetsRes] =
        optionalResults;

      if (automate.status === "fulfilled") setFixeAutomate(automate.value.data || []);
      if (buget.status === "fulfilled") {
        const data = buget.value.data || {};
        setVenitTotal(Number(data.venit || 0));
        setBudgetSummary(buildBudgetSummary(data));
      }
      if (venituriRes.status === "fulfilled") setVenituri(venituriRes.value.data || []);
      if (creditsRes.status === "fulfilled") setCredits(creditsRes.value.data || []);
      if (targetsRes.status === "fulfilled") {
        setTargetsByMonth(normalizeApiTargetsByMonth(targetsRes.value.data || []));
      }
      if (globalTargetsRes.status === "fulfilled") {
        setGlobalTargets(normalizeApiTarget(globalTargetsRes.value.data));
      }

      const optionalError = optionalResults.find(
        (result) => result.status === "rejected"
      );
      if (optionalError) {
        console.warn(
          "Unele date auxiliare de cheltuieli nu au putut fi incarcate.",
          optionalResults
        );
        setMsg(
          "Cheltuielile s-au incarcat, dar unele totaluri auxiliare nu sunt disponibile momentan."
        );
        setMsgType("warning");
      }
    } catch (error) {
      console.error("Nu am putut incarca cheltuielile:", error);
      setMsg(getApiErrorMessage(error, "Nu am putut incarca cheltuielile din backend."));
      setMsgType("error");
    }
  }, []);

  useEffect(() => {
    loadData();
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
    setAutoDay(String(new Date().getDate()));
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
    setAutoDay(getDayFromDate(item.data));
    setAutoCursivitate(item.cursivitate || "lunar");
    setAutoSuma(item.suma || "");
    setAutoMoneda(item.moneda || "EUR");
    setAutoActiv(item.activ !== false);
    setEditId(null);
    setMainTab("gestionare");
  };

  const adauga = async () => {
    if (!suma) {
      setMsg("Completeaza suma inainte de salvare.");
      setMsgType("error");
      return;
    }

    if (tab === "fixe" && !descriere.trim()) {
      setMsg("Completeaza descrierea pentru cheltuiala fixa.");
      setMsgType("error");
      return;
    }

    const payload =
      tab === "fixe"
        ? {
            descriere,
            suma: convertAmountToEur(suma, moneda),
            moneda: "EUR",
            data,
          }
        : {
            categorie: toApiCategory(categorie),
            suma: convertAmountToEur(suma, moneda),
            moneda: "EUR",
            data,
          };

    try {
      const wasEditing = Boolean(editId);
      const currentTab = tab;
      let response;

      if (editId) {
        response = await api.put(
          `${tab === "fixe" ? "cheltuieli-fixe" : "cheltuieli-variabile"}/${editId}/`,
          payload
        );
      } else {
        response = await api.post(
          tab === "fixe" ? "cheltuieli-fixe/" : "cheltuieli-variabile/",
          payload
        );
      }

      const savedItem = response.data;
      if (currentTab === "fixe") {
        setFixe((current) => upsertById(current, savedItem));
      } else {
        setVariabile((current) => upsertById(current, savedItem));
      }

      resetForm();
      notifyFinanceDataChanged();
      void loadData();
      setMsg(wasEditing ? "Cheltuiala a fost actualizata." : "Cheltuiala a fost salvata.");
      setMsgType("success");
    } catch (error) {
      console.error("Nu am putut salva cheltuiala:", error);
      setMsg(getApiErrorMessage(error, "Nu am putut salva cheltuiala in backend."));
      setMsgType("error");
    }
  };

  const salveazaAutomat = async () => {
    if (!autoDenumire || !autoSuma || !autoDay) {
      setMsg("Completeaza denumirea, suma si ziua lunii pentru automatizare.");
      setMsgType("error");
      return;
    }

    const payload = {
      denumire: autoDenumire,
      data: buildDateForCurrentMonthDay(autoDay),
      cursivitate: autoCursivitate,
      suma: convertAmountToEur(autoSuma, autoMoneda),
      moneda: "EUR",
      activ: autoActiv,
    };

    try {
      if (autoEditId) {
        await api.put(`cheltuieli-fixe-automate/${autoEditId}/`, payload);
      } else {
        await api.post("cheltuieli-fixe-automate/", payload);
      }

      resetAutoForm();
      await loadData();
      setMsg("Automatizarea a fost salvata.");
      setMsgType("success");
    } catch (error) {
      console.error("Nu am putut salva automatizarea:", error);
      setMsg(getApiErrorMessage(error, "Nu am putut salva automatizarea in backend."));
      setMsgType("error");
    }
  };

  const stergeAutomat = async (item) => {
    if (!window.confirm("Sigur stergi aceasta automatizare?")) return;

    await api.delete(`cheltuieli-fixe-automate/${item.id}/`);
    if (autoEditId === item.id) {
      resetAutoForm();
    }
    await loadData();
  };

  const sterge = async (item, forcedTab = tab) => {
    if (!window.confirm("Sigur stergi?")) return;

    const previousFixe = fixe;
    const previousVariabile = variabile;
    setLastDeleted(item);
    setUndoTab(forcedTab);
    if (forcedTab === "fixe") {
      setFixe((current) => current.filter((row) => row.id !== item.id));
    } else {
      setVariabile((current) => current.filter((row) => row.id !== item.id));
    }

    try {
      await api.delete(
        `${forcedTab === "fixe" ? "cheltuieli-fixe" : "cheltuieli-variabile"}/${item.id}/`
      );
      notifyFinanceDataChanged();
      void loadData();
    } catch (error) {
      setFixe(previousFixe);
      setVariabile(previousVariabile);
      setLastDeleted(null);
      setUndoTab(null);
      setMsg(getApiErrorMessage(error, "Nu am putut sterge cheltuiala."));
      setMsgType("error");
      return;
    }

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

    const response = await api.post(
      undoTab === "fixe" ? "cheltuieli-fixe/" : "cheltuieli-variabile/",
      payload
    );
    if (undoTab === "fixe") {
      setFixe((current) => upsertById(current, response.data));
    } else {
      setVariabile((current) => upsertById(current, response.data));
    }
    setLastDeleted(null);
    setUndoTab(null);
    notifyFinanceDataChanged();
    void loadData();
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
    () => [...manualFixedRows, ...variableRows].sort(sortDescByNewest),
    [manualFixedRows, sortDescByNewest, variableRows]
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
      manualFixedRows
        .filter((item) => inCurrentCycle(item.data))
        .reduce((acc, item) => acc + convertAmountToEur(item.suma, item.moneda), 0),
    [convertAmountToEur, inCurrentCycle, manualFixedRows]
  );

  const totalAutomatizariSalvate = useMemo(
    () =>
      fixeAutomate
        .filter((item) => item.activ !== false)
        .reduce((acc, item) => acc + convertAmountToEur(item.suma, item.moneda), 0),
    [convertAmountToEur, fixeAutomate]
  );

  const totalVariabile = useMemo(
    () =>
      variabile
        .filter(
          (item) => inCurrentCycle(item.data) && item.categorie !== "vacanta_cheltuita"
        )
        .reduce((acc, item) => acc + convertAmountToEur(item.suma, item.moneda), 0),
    [convertAmountToEur, inCurrentCycle, variabile]
  );

  const totalCheltuit = totalFixe + totalVariabile;
  const baniRamasi = venitTotal - totalCheltuit;
  const procent =
    venitTotal > 0 ? Math.round((totalCheltuit / venitTotal) * 100) : 0;
  const showManualExpenseEntry = tab !== "fixe" || fixedSubTab === "manuale";
  const manualFixedPreview =
    tab === "fixe" && moneda === "RON" && suma
      ? convertAmountToEur(suma, moneda)
      : null;
  const manualVariablePreview =
    tab === "variabile" && moneda === "RON" && suma
      ? convertAmountToEur(suma, moneda)
      : null;
  const autoFixedPreview =
    autoMoneda === "RON" && autoSuma
      ? convertAmountToEur(autoSuma, autoMoneda)
      : null;
  const rateLabel =
    rateSource === "BNR" && eurRonRate
      ? `Curs BNR: 1 EUR = ${eurRonRate} RON${rateDate ? ` (${rateDate})` : ""}`
      : "Curs BNR indisponibil, folosesc curs fallback.";

  const variableStatusRows = useMemo(() => {
    const variableStatus = variabile
      .filter(
        (item) =>
          getExpenseMonthKey(item) === statusMonth &&
          item.categorie !== "vacanta_cheltuita"
      )
      .reduce((acc, item) => {
        const key = toUiCategory(item.categorie || "neprevazute");
        acc[key] =
          (acc[key] || 0) + convertAmountToEur(item.suma, item.moneda);
        return acc;
      }, {});

    return Object.entries(variableStatus)
      .sort(([, a], [, b]) => b - a)
      .map(([key, sum]) => ({
        key,
        label: categoryLabelMap[key] || key,
        sum,
      }));
  }, [convertAmountToEur, statusMonth, variabile]);

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

  const exportRange = useMemo(() => getMonthRange(exportMonth), [exportMonth]);
  const exportCreditRows = useMemo(
    () =>
      credits
        .filter((item) => getExpenseMonthKey(item) === exportMonth)
        .slice()
        .sort(sortDescByNewest),
    [credits, exportMonth, sortDescByNewest]
  );
  const exportAutoDeductionRows = useMemo(
    () =>
      fixeAutomate
        .filter((item) => item.activ !== false)
        .flatMap((item) =>
          iterFixedAutomationDates(item, exportRange.start, exportRange.end).map(
            (occurrenceDate) => ({
              ...item,
              occurrenceDate,
            })
          )
        )
        .sort((a, b) => {
          const dateDiff = new Date(b.occurrenceDate) - new Date(a.occurrenceDate);
          if (dateDiff !== 0) return dateDiff;
          return Number(b.id || 0) - Number(a.id || 0);
        }),
    [exportRange.end, exportRange.start, fixeAutomate]
  );
  const exportVenitBrut = venituri
    .filter((item) => getExpenseMonthKey(item) === exportMonth)
    .reduce((acc, item) => acc + Number(item.suma || 0), 0);
  const exportCreditTotal = exportCreditRows.reduce(
    (acc, item) => acc + convertAmountToEur(item.suma, item.moneda),
    0
  );
  const exportAutoDeductionTotal = exportAutoDeductionRows.reduce(
    (acc, item) => acc + convertAmountToEur(item.suma, item.moneda),
    0
  );
  const exportDeduceriTotal = exportCreditTotal + exportAutoDeductionTotal;
  const exportVenitNet = exportVenitBrut - exportDeduceriTotal;
  const exportFixedTotal = exportRows
    .filter((item) => item.expenseType === "fixe")
    .reduce((acc, item) => acc + convertAmountToEur(item.suma, item.moneda), 0);
  const exportCategoryTotals = exportRows
    .filter((item) => item.expenseType === "variabile")
    .reduce((acc, item) => {
      const key = toUiCategory(item.categorie || "neprevazute");
      acc[key] =
        (acc[key] || 0) + convertAmountToEur(item.suma, item.moneda);
      return acc;
    }, {});
  const exportTotalCheltuit = exportRows.reduce(
    (acc, item) => acc + convertAmountToEur(item.suma, item.moneda),
    0
  );
  const exportRamas = exportVenitNet - exportTotalCheltuit;
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
      ["Venit brut", `${exportVenitBrut.toFixed(2)} EUR`],
      ["Credite scazute", `-${exportCreditTotal.toFixed(2)} EUR`],
      ["Automatizari scazute", `-${exportAutoDeductionTotal.toFixed(2)} EUR`],
      ["Deduceri totale", `-${exportDeduceriTotal.toFixed(2)} EUR`],
      ["Venit net", `${exportVenitNet.toFixed(2)} EUR`],
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
          exportVenitNet > 0
            ? Math.round((row.actual / exportVenitNet) * 100)
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
    const creditRows = [
      ["Data", "Denumire", "Suma", "Moneda", "User"],
      ...exportCreditRows.map((row) => [
        row.data,
        row.denumire || "Credit",
        row.suma,
        row.moneda,
        row.username || "-",
      ]),
    ];
    const autoDeductionRows = [
      ["Data", "Denumire", "Cursivitate", "Suma", "Moneda", "User"],
      ...exportAutoDeductionRows.map((row) => [
        row.occurrenceDate,
        row.denumire || "Automatizare",
        getFixedAutomationCadenceLabel(row.cursivitate),
        row.suma,
        row.moneda,
        row.username || "-",
      ]),
    ];

    return {
      summaryRows,
      categoryRows,
      objectiveRows,
      creditRows,
      autoDeductionRows,
      detailRows,
    };
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
      ${makeExportTable(tables.creditRows, "Credite scazute din venit")}
      ${makeExportTable(tables.autoDeductionRows, "Automatizari scazute din venit")}
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
      <div style={localStyles.titleRow}>
        <h2 style={styles.title}>Gestionare cheltuieli</h2>
        {user?.username && (
          <span style={localStyles.accountBadge}>Cont: {user.username}</span>
        )}
      </div>

      {msg && (
        <div
          style={{
            ...localStyles.alert,
            ...(msgType === "error" ? localStyles.alertError : {}),
            ...(msgType === "success" ? localStyles.alertSuccess : {}),
            ...(msgType === "warning" ? localStyles.alertWarning : {}),
          }}
        >
          {msg}
        </div>
      )}

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
            <div style={styles.heroLabel}>Venit disponibil</div>
            <div
              style={{
                ...styles.heroValue,
                color: baniRamasi >= 0 ? "#10201a" : "#b42318",
              }}
            >
              {Number(baniRamasi || 0).toFixed(2)} EUR
            </div>
            <div style={localStyles.deductionGrid}>
              <div>
                <span>Venit brut</span>
                <strong>{budgetSummary.venitBrut.toFixed(2)} EUR</strong>
              </div>
              <div>
                <span>Credite</span>
                <strong>-{budgetSummary.deduceriCredite.toFixed(2)} EUR</strong>
              </div>
              <div>
                <span>Automate pe 27</span>
                <strong>-{budgetSummary.deduceriAutomate.toFixed(2)} EUR</strong>
              </div>
              <div>
                <span>Venit net</span>
                <strong>{budgetSummary.venitNet.toFixed(2)} EUR</strong>
              </div>
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
              <span>Automatizari scazute din venit</span>
              <strong>{budgetSummary.deduceriAutomate.toFixed(2)} EUR</strong>
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
              {manualVariablePreview !== null && (
                <div style={localStyles.previewText}>
                  Conversie automata: {manualVariablePreview.toFixed(2)} EUR.{" "}
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
                type="number"
                min="1"
                max="31"
                placeholder="Ziua lunii"
                value={autoDay}
                onChange={(e) => setAutoDay(e.target.value)}
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
                <div style={localStyles.autoTotalRow}>
                  <span>Total automatizari active</span>
                  <strong>{totalAutomatizariSalvate.toFixed(2)} EUR</strong>
                </div>
                <table style={localStyles.autoTable}>
                  <thead>
                    <tr>
                      <th style={localStyles.tableHeaderCell}>Denumire</th>
                      <th style={localStyles.tableHeaderCell}>Ziua lunii</th>
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
                          {getDayFromDate(item.data)}
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
          <input
            type="month"
            style={styles.input}
            value={statusMonth}
            onChange={(e) => setStatusMonth(e.target.value)}
          />
          <div style={styles.date}>Luna selectata: {statusMonth}</div>
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
  titleRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 16,
  },
  accountBadge: {
    background: "#f8faf9",
    border: "1px solid #cfd8d3",
    borderRadius: 4,
    color: "#5f6f66",
    fontSize: 13,
    fontWeight: 800,
    padding: "6px 9px",
  },
  alert: {
    border: "1px solid #cfd8d3",
    background: "#f8faf9",
    borderRadius: 4,
    color: "#10201a",
    fontSize: 14,
    fontWeight: 700,
    marginBottom: 16,
    padding: "11px 12px",
  },
  alertError: {
    background: "#fdebea",
    borderColor: "#f2b8b5",
    color: "#b42318",
  },
  alertSuccess: {
    background: "#e6f4ed",
    borderColor: "#b7dfc4",
    color: "#146c43",
  },
  alertWarning: {
    background: "#fff8e5",
    borderColor: "#ead08a",
    color: "#735c0f",
  },
  deductionGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: 8,
    marginTop: 12,
    fontSize: 13,
  },
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
  autoTotalRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    padding: "10px 12px",
    borderBottom: "1px solid #cfd8d3",
    background: "#f8faf9",
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
