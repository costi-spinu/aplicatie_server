import { useCallback, useEffect, useMemo, useState } from "react";
import AutomationsSection from "../components/cheltuieli/AutomationsSection";
import ExpenseExportSection from "../components/cheltuieli/ExpenseExportSection";
import ExpenseHistorySection from "../components/cheltuieli/ExpenseHistorySection";
import ExpenseRow from "../components/cheltuieli/ExpenseRow";
import ManualExpenseForm from "../components/cheltuieli/ManualExpenseForm";
import VariableStatusSection from "../components/cheltuieli/VariableStatusSection";
import { translateCurrentText } from "../contexts/AppSettingsContext";
import api from "../services/api";
import {
  areCachedApiEndpointsFresh,
  getCachedApiData,
  isCachedApiDataFresh,
} from "../services/apiConfig";
import { CHELTUIELI_DATA_ENDPOINTS } from "../services/preloadEndpoints";
import localStyles from "../styles/cheltuieliStyles";
import styles from "../styles/iosStyles";
import {
  buildCheltuieliExportModel,
  downloadCheltuieliExcel,
  downloadCheltuieliPdf,
} from "../utils/cheltuieliExport";
import {
  RON_TO_EUR_FALLBACK,
  applyExpenseRefreshOverrides,
  buildBudgetSummary,
  buildDailyVariableSpend,
  buildDateForMonthDay,
  categoryLabelMap,
  countFixedAutomationOccurrencesForCurrentMonth,
  emptyBudgetSummary,
  getApiErrorMessage,
  getBudgetCycleKey,
  getCurrentCycleRange,
  getCurrentMonthKey,
  getDayFromDate,
  getMonthFromDate,
  isManualFixedExpense,
  isRentAutomation,
  notifyFinanceDataChanged,
  requiresFixedAutomationStartMonth,
  round2,
  toApiCategory,
  toDateOnly,
  toUiCategory,
  upsertById,
} from "../utils/cheltuieliUtils";

export default function Cheltuieli({ user }) {
  const cachedFixe = getCachedApiData("cheltuieli-fixe/");
  const cachedVariabile = getCachedApiData("cheltuieli-variabile/");
  const cachedFixeAutomate = getCachedApiData("cheltuieli-fixe-automate/");
  const cachedBudget = getCachedApiData("buget/lunar/");
  const cachedPeriod =
    getCachedApiData("perioada-bugetara/") || cachedBudget || null;
  const initialBudgetStartDay = Number(cachedPeriod?.start_day || 26);
  const initialCycleKey =
    cachedPeriod?.cycle_key || getBudgetCycleKey(new Date(), initialBudgetStartDay);
  const cachedBudgetSummary = cachedBudget
    ? buildBudgetSummary(cachedBudget)
    : emptyBudgetSummary;
  const cachedRate = getCachedApiData("curs-bnr/");
  const cachedRonToEurRate =
    Number(cachedRate?.ron_eur || 0) || RON_TO_EUR_FALLBACK;
  const cachedEurRonRate = Number(cachedRate?.eur_ron || 0) || null;

  const [mainTab, setMainTab] = useState("gestionare");
  const [tab, setTab] = useState("variabile");
  const [fixedSubTab, setFixedSubTab] = useState("manuale");
  const [categorie, setCategorie] = useState("alimente");
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
  const [autoStartMonth, setAutoStartMonth] = useState(getCurrentMonthKey());
  const [autoCursivitate, setAutoCursivitate] = useState("lunar");
  const [autoSuma, setAutoSuma] = useState("");
  const [autoMoneda, setAutoMoneda] = useState("EUR");
  const [autoActiv, setAutoActiv] = useState(true);
  const [lastDeleted, setLastDeleted] = useState(null);
  const [undoTab, setUndoTab] = useState(null);
  const [historyMonth, setHistoryMonth] = useState(initialCycleKey);
  const [statusMonth, setStatusMonth] = useState(initialCycleKey);
  const [exportMonth, setExportMonth] = useState(initialCycleKey);
  const [exportReport, setExportReport] = useState(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [budgetSummary, setBudgetSummary] = useState(cachedBudgetSummary);
  const [ronToEurRate, setRonToEurRate] = useState(cachedRonToEurRate);
  const [eurRonRate, setEurRonRate] = useState(cachedEurRonRate);
  const [rateDate, setRateDate] = useState(cachedRate?.date || "");
  const [rateSource, setRateSource] = useState(cachedRate?.source || "fallback");
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState("info");
  const [budgetPeriod, setBudgetPeriod] = useState(cachedPeriod);

  const budgetStartDay = Number(budgetPeriod?.start_day || 26);
  const cycleRange = useMemo(
    () => getCurrentCycleRange(new Date(), budgetStartDay),
    [budgetStartDay]
  );
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

  const loadData = useCallback(async (refreshOptions = {}) => {
    setMsg("");

    try {
      const [f, v] = await Promise.all([
        api.get("cheltuieli-fixe/"),
        api.get("cheltuieli-variabile/"),
      ]);

      setFixe(
        applyExpenseRefreshOverrides(f.data, "fixe", refreshOptions)
      );
      setVariabile(
        applyExpenseRefreshOverrides(v.data, "variabile", refreshOptions)
      );

      const optionalResults = await Promise.allSettled([
        api.get("cheltuieli-fixe-automate/"),
        api.get("buget/lunar/"),
      ]);

      const [automate, buget] = optionalResults;

      if (automate.status === "fulfilled") setFixeAutomate(automate.value.data || []);
      if (buget.status === "fulfilled") {
        const data = buget.value.data || {};
        setBudgetSummary(buildBudgetSummary(data));
        setBudgetPeriod(data);
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
    if (areCachedApiEndpointsFresh(CHELTUIELI_DATA_ENDPOINTS)) return;
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (isCachedApiDataFresh("curs-bnr/")) return;
    fetchExchangeRate();
  }, [fetchExchangeRate]);

  useEffect(() => {
    if (mainTab !== "desfasurator-cheltuieli" || !exportMonth) return undefined;

    let cancelled = false;
    setExportLoading(true);
    setExportReport(null);

    api
      .get("raport/bugetar/", { params: { luna: exportMonth } })
      .then((response) => {
        if (!cancelled) setExportReport(response.data || null);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("Nu am putut incarca desfasuratorul:", error);
        setMsg(
          getApiErrorMessage(error, "Nu am putut calcula desfasuratorul selectat.")
        );
        setMsgType("error");
      })
      .finally(() => {
        if (!cancelled) setExportLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [exportMonth, mainTab]);

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
    setAutoStartMonth(getCurrentMonthKey());
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
      setDescriere(item.descriere || "");
    } else {
      setCategorie(toUiCategory(item.categorie));
      setDescriere(item.descriere || "");
    }

    setMainTab("gestionare");
  };

  const startAutoEdit = (item) => {
    setFixedSubTab("automate");
    setAutoEditId(item.id);
    setAutoDenumire(item.denumire || "");
    setAutoDay(getDayFromDate(item.data));
    setAutoStartMonth(getMonthFromDate(item.data));
    setAutoCursivitate(item.cursivitate || "lunar");
    setAutoSuma(item.suma || "");
    setAutoMoneda(item.moneda || "EUR");
    setAutoActiv(item.activ !== false);
    setEditId(null);
    setMainTab("gestionare");
  };

  const buildLocalExpenseItem = (payload, expenseType, id) => ({
    id,
    ...payload,
    expenseType,
    username: user?.username || "",
    created_at: new Date().toISOString(),
  });

  const adauga = async () => {
    if (!suma) {
      setMsg("Completeaza suma inainte de salvare.");
      setMsgType("error");
      return;
    }

    const payload =
      tab === "fixe"
        ? {
            descriere: descriere.trim(),
            suma: convertAmountToEur(suma, moneda),
            moneda: "EUR",
            data,
          }
        : {
            categorie: toApiCategory(categorie),
            descriere: descriere.trim(),
            suma: convertAmountToEur(suma, moneda),
            moneda: "EUR",
            data,
          };

    const previousFixe = fixe;
    const previousVariabile = variabile;

    try {
      const wasEditing = Boolean(editId);
      const currentTab = tab;
      const temporaryId = editId || -Date.now();
      const localItem = buildLocalExpenseItem(payload, currentTab, temporaryId);
      let response;

      if (currentTab === "fixe") {
        setFixe((current) => upsertById(current, localItem));
      } else {
        setVariabile((current) => upsertById(current, localItem));
      }

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

      const savedItem = { ...localItem, ...(response.data || {}) };
      if (currentTab === "fixe") {
        setFixe((current) =>
          upsertById(
            current.filter((item) => item.id !== temporaryId || item.id === savedItem.id),
            savedItem
          )
        );
      } else {
        setVariabile((current) =>
          upsertById(
            current.filter((item) => item.id !== temporaryId || item.id === savedItem.id),
            savedItem
          )
        );
      }

      resetForm();
      notifyFinanceDataChanged();
      await loadData({
        preserveExpense: { type: currentTab, item: savedItem },
      });
      setMsg(wasEditing ? "Cheltuiala a fost actualizata." : "Cheltuiala a fost salvata.");
      setMsgType("success");
    } catch (error) {
      setFixe(previousFixe);
      setVariabile(previousVariabile);
      console.error("Nu am putut salva cheltuiala:", error);
      setMsg(getApiErrorMessage(error, "Nu am putut salva cheltuiala in backend."));
      setMsgType("error");
    }
  };

  const salveazaAutomat = async () => {
    if (
      !autoDenumire ||
      !autoSuma ||
      !autoDay ||
      (requiresFixedAutomationStartMonth(autoCursivitate) && !autoStartMonth)
    ) {
      setMsg("Completeaza denumirea, suma si ziua lunii pentru automatizare.");
      setMsgType("error");
      return;
    }

    const payload = {
      denumire: autoDenumire,
      data: buildDateForMonthDay(autoStartMonth, autoDay),
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
    if (!window.confirm(translateCurrentText("Sigur stergi aceasta automatizare?"))) {
      return;
    }

    await api.delete(`cheltuieli-fixe-automate/${item.id}/`);
    if (autoEditId === item.id) {
      resetAutoForm();
    }
    await loadData();
  };

  const sterge = async (item, forcedTab = tab) => {
    if (!window.confirm(translateCurrentText("Sigur stergi?"))) return;

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
      await loadData({
        removeExpense: { type: forcedTab, id: item.id },
      });
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
            descriere: lastDeleted.descriere || "",
            suma: lastDeleted.suma,
            moneda: lastDeleted.moneda,
            data: lastDeleted.data,
          }
        : {
            categorie: toApiCategory(toUiCategory(lastDeleted.categorie)),
            descriere: lastDeleted.descriere || "",
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
    await loadData({
      preserveExpense: { type: undoTab, item: response.data },
    });
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

  const automationTotals = useMemo(() => {
    return fixeAutomate
      .filter((item) => item.activ !== false)
      .reduce(
        (totals, item) => {
          const amount = convertAmountToEur(item.suma, item.moneda);

          if (isRentAutomation(item)) {
            totals.rent += amount;
            return totals;
          }

          totals.generalWithoutRent += amount;
          totals.currentMonthWithoutRent +=
            amount * countFixedAutomationOccurrencesForCurrentMonth(
              item,
              new Date(),
              cycleRange
            );
          return totals;
        },
        {
          currentMonthWithoutRent: 0,
          generalWithoutRent: 0,
          rent: 0,
        }
      );
  }, [convertAmountToEur, cycleRange, fixeAutomate]);

  const totalVariabile = useMemo(
    () =>
      variabile
        .filter(
          (item) => inCurrentCycle(item.data) && item.categorie !== "vacanta_cheltuita"
        )
        .reduce((acc, item) => acc + convertAmountToEur(item.suma, item.moneda), 0),
    [convertAmountToEur, inCurrentCycle, variabile]
  );
  const dailyVariableSpend = useMemo(
    () =>
      buildDailyVariableSpend(
        variabile,
        convertAmountToEur,
        new Date(),
        budgetStartDay
      ),
    [budgetStartDay, convertAmountToEur, variabile]
  );

  const venitTotal = budgetSummary.venitNet;
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
          getBudgetCycleKey(item.data, budgetStartDay) === statusMonth &&
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
  }, [budgetStartDay, convertAmountToEur, statusMonth, variabile]);

  const totalVariabileCurente = variableStatusRows.reduce(
    (acc, row) => acc + row.sum,
    0
  );

  const combinedHistory = useMemo(
    () =>
      allExpenseRows
        .filter(
          (item) => getBudgetCycleKey(item.data, budgetStartDay) === historyMonth
        )
        .sort(sortDescByNewest),
    [allExpenseRows, budgetStartDay, historyMonth, sortDescByNewest]
  );

  const exportModel = useMemo(
    () => (exportReport ? buildCheltuieliExportModel(exportReport) : null),
    [exportReport]
  );

  const downloadExcel = useCallback(() => {
    if (!exportModel) return;
    downloadCheltuieliExcel(exportModel);
  }, [exportModel]);

  const downloadPdf = useCallback(() => {
    if (!exportModel) return;
    downloadCheltuieliPdf(exportModel);
  }, [exportModel]);

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
            <div style={localStyles.breakdownRow}>
              <span>Media pe zi variabile</span>
              <strong>{dailyVariableSpend.average.toFixed(2)} EUR/zi</strong>
            </div>
            <div style={localStyles.percentText}>
              {dailyVariableSpend.total.toFixed(2)} EUR /{" "}
              {dailyVariableSpend.daysElapsed} zile scurse din perioada
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
            <ManualExpenseForm
              categorie={categorie}
              data={data}
              descriere={descriere}
              editId={editId}
              manualFixedPreview={manualFixedPreview}
              manualVariablePreview={manualVariablePreview}
              moneda={moneda}
              rateLabel={rateLabel}
              suma={suma}
              tab={tab}
              onCancel={resetForm}
              onSave={adauga}
              onCategorieChange={setCategorie}
              onDataChange={setData}
              onDescriereChange={setDescriere}
              onMonedaChange={setMoneda}
              onSumaChange={setSuma}
            />
          )}

          {tab === "fixe" && fixedSubTab === "automate" && (
            <AutomationsSection
              autoActiv={autoActiv}
              autoCursivitate={autoCursivitate}
              autoDay={autoDay}
              autoDenumire={autoDenumire}
              autoEditId={autoEditId}
              autoFixedPreview={autoFixedPreview}
              autoMoneda={autoMoneda}
              autoStartMonth={autoStartMonth}
              autoSuma={autoSuma}
              automationTotals={automationTotals}
              fixeAutomate={fixeAutomate}
              rateLabel={rateLabel}
              onAutoActivChange={setAutoActiv}
              onAutoCursivitateChange={setAutoCursivitate}
              onAutoDayChange={setAutoDay}
              onAutoDenumireChange={setAutoDenumire}
              onAutoMonedaChange={setAutoMoneda}
              onAutoStartMonthChange={setAutoStartMonth}
              onAutoSumaChange={setAutoSuma}
              onCancel={resetAutoForm}
              onDelete={stergeAutomat}
              onEdit={startAutoEdit}
              onSave={salveazaAutomat}
            />
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
        <VariableStatusSection
          statusMonth={statusMonth}
          totalVariabileCurente={totalVariabileCurente}
          variableStatusRows={variableStatusRows}
          onStatusMonthChange={setStatusMonth}
        />
      )}

      {mainTab === "istoric-cheltuieli" && (
        <ExpenseHistorySection
          combinedHistory={combinedHistory}
          historyMonth={historyMonth}
          onDelete={sterge}
          onEdit={startEdit}
          onHistoryMonthChange={setHistoryMonth}
        />
      )}

      {mainTab === "desfasurator-cheltuieli" && (
        <ExpenseExportSection
          exportMonth={exportMonth}
          periodStartDay={budgetStartDay}
          exportLoading={exportLoading}
          exportReady={Boolean(exportModel)}
          onDownloadExcel={downloadExcel}
          onDownloadPdf={downloadPdf}
          onExportMonthChange={setExportMonth}
        />
      )}
    </div>
  );
}
