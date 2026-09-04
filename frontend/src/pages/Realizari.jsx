import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../services/api";
import {
  areCachedApiEndpointsFresh,
  getCachedApiData,
} from "../services/apiConfig";
import { REALIZARI_ENDPOINTS } from "../services/preloadEndpoints";
import styles from "../styles/iosStyles";
import {
  categoryKeys,
  categoryLabelMap,
  formatBudgetCycleLabel,
  getBudgetCycleKey,
  toUiCategory,
} from "../utils/cheltuieliUtils";

const STORAGE_KEY = "realizari_targets_by_month_v1";
const buildEmptyCategoryTargets = () =>
  categoryKeys.reduce((acc, key) => ({ ...acc, [key]: "" }), {});
const normalizeCategoryTargets = (values = {}) =>
  categoryKeys.reduce(
    (acc, key) => ({ ...acc, [key]: Number(values[key] || 0) || 0 }),
    {}
  );
const sumValues = (obj) =>
  Object.values(obj || {}).reduce((acc, value) => acc + Number(value || 0), 0);
const computeProgress = (actual, target) =>
  !target || target <= 0 ? 0 : Math.round((actual / target) * 100);

const normalizeApiTarget = (item) =>
  item
    ? {
        id: item.id,
        fixedTarget: Number(item.fixed_target || 0),
        categoryTargets: normalizeCategoryTargets(item.category_targets || {}),
        updatedAt: item.updated_at,
      }
    : null;

const normalizeApiTargets = (items = []) =>
  items.reduce((acc, item) => {
    acc[item.luna] = normalizeApiTarget(item);
    return acc;
  }, {});

const hasTargetValues = (target) =>
  Boolean(
    target &&
      (Number(target.fixedTarget || 0) > 0 ||
        sumValues(target.categoryTargets || {}) > 0)
  );

export default function Realizari() {
  const cachedPeriod = getCachedApiData("perioada-bugetara/") || null;
  const initialBudgetStartDay = Number(cachedPeriod?.start_day || 26);
  const initialCurrentCycleKey =
    cachedPeriod?.cycle_key || getBudgetCycleKey(new Date(), initialBudgetStartDay);
  const cachedTargetsByMonth = normalizeApiTargets(
    getCachedApiData("realizari-targets/") || []
  );
  const cachedGlobalTarget = normalizeApiTarget(
    getCachedApiData("obiective-cheltuieli-global/")
  );
  const cachedFormTarget = hasTargetValues(cachedGlobalTarget)
    ? cachedGlobalTarget
    : cachedTargetsByMonth[initialCurrentCycleKey] || cachedGlobalTarget;
  const cachedFixe = getCachedApiData("cheltuieli-fixe/");
  const cachedVariabile = getCachedApiData("cheltuieli-variabile/");

  const [activeTab, setActiveTab] = useState("curent");
  const [selectedHistoryMonth, setSelectedHistoryMonth] = useState("");
  const [fixedTargetInput, setFixedTargetInput] = useState(
    cachedFormTarget?.fixedTarget ? String(cachedFormTarget.fixedTarget) : ""
  );
  const [categoryTargetInputs, setCategoryTargetInputs] = useState(
    () =>
      cachedFormTarget
        ? categoryKeys.reduce(
            (acc, key) => ({
              ...acc,
              [key]: cachedFormTarget.categoryTargets?.[key]
                ? String(cachedFormTarget.categoryTargets[key])
                : "",
            }),
            {}
          )
        : buildEmptyCategoryTargets()
  );
  const [targetsByMonth, setTargetsByMonth] = useState(cachedTargetsByMonth);
  const [globalTarget, setGlobalTarget] = useState(cachedGlobalTarget);
  const [fixe, setFixe] = useState(() =>
    Array.isArray(cachedFixe) ? cachedFixe : []
  );
  const [variabile, setVariabile] = useState(() =>
    Array.isArray(cachedVariabile) ? cachedVariabile : []
  );
  const [msg, setMsg] = useState("");
  const [budgetStartDay, setBudgetStartDay] = useState(initialBudgetStartDay);

  const currentCycleKey = getBudgetCycleKey(new Date(), budgetStartDay);

  const applyTargetToInputs = useCallback((target) => {
    if (!target) {
      setFixedTargetInput("");
      setCategoryTargetInputs(buildEmptyCategoryTargets());
      return;
    }

    setFixedTargetInput(target.fixedTarget ? String(target.fixedTarget) : "");
    setCategoryTargetInputs(
      categoryKeys.reduce(
        (acc, key) => ({
          ...acc,
          [key]: target.categoryTargets?.[key]
            ? String(target.categoryTargets[key])
            : "",
        }),
        {}
      )
    );
  }, []);

  const migrateLocalTargets = useCallback(async (remoteTargets) => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return remoteTargets;

    try {
      const localTargets = JSON.parse(raw) || {};
      const missingEntries = Object.entries(localTargets).filter(
        ([key]) => !remoteTargets[key]
      );
      if (missingEntries.length === 0) return remoteTargets;

      await Promise.all(
        missingEntries.map(([luna, target]) =>
          api.post("realizari-targets/", {
            luna,
            fixed_target: Number(target.fixedTarget || 0),
            category_targets: target.categoryTargets || {},
          })
        )
      );

      localStorage.removeItem(STORAGE_KEY);
      const res = await api.get("realizari-targets/");
      return normalizeApiTargets(res.data || []);
    } catch (error) {
      console.warn("Migrarea tintelor locale a esuat:", error);
      return remoteTargets;
    }
  }, []);

  const loadTargets = useCallback(async () => {
    const [targetsRes, globalRes, periodRes] = await Promise.all([
      api.get("realizari-targets/"),
      api.get("obiective-cheltuieli-global/"),
      api.get("perioada-bugetara/"),
    ]);
    const remoteTargets = await migrateLocalTargets(
      normalizeApiTargets(targetsRes.data || [])
    );
    const normalizedGlobal = normalizeApiTarget(globalRes.data);
    const formTarget = hasTargetValues(normalizedGlobal)
      ? normalizedGlobal
      : remoteTargets[currentCycleKey] || normalizedGlobal;

    setTargetsByMonth(remoteTargets);
    setGlobalTarget(normalizedGlobal);
    setBudgetStartDay(Number(periodRes.data?.start_day || 26));
    applyTargetToInputs(formTarget);
  }, [applyTargetToInputs, currentCycleKey, migrateLocalTargets]);

  const loadExpenses = useCallback(async () => {
    const [f, v] = await Promise.all([
      api.get("cheltuieli-fixe/"),
      api.get("cheltuieli-variabile/"),
    ]);
    setFixe(f.data || []);
    setVariabile(v.data || []);
  }, []);

  useEffect(() => {
    if (
      !localStorage.getItem(STORAGE_KEY) &&
      areCachedApiEndpointsFresh(REALIZARI_ENDPOINTS)
    ) {
      return;
    }

    void Promise.resolve().then(() =>
      Promise.all([loadTargets(), loadExpenses()]).catch(() =>
        setMsg("Eroare la incarcarea datelor")
      )
    );
  }, [loadExpenses, loadTargets]);

  const actualByCycle = useMemo(() => {
    const fixed = {};
    const variableByCategory = {};

    fixe
      .filter((item) => item.sursa !== "automat")
      .forEach((item) => {
        const key = getBudgetCycleKey(item.data, budgetStartDay);
        fixed[key] = (fixed[key] || 0) + Number(item.suma || 0);
      });

    variabile
      .filter((item) => item.categorie !== "vacanta_cheltuita")
      .forEach((item) => {
        const key = getBudgetCycleKey(item.data, budgetStartDay);
        const category = toUiCategory(item.categorie || "neprevazute");
        variableByCategory[key] = variableByCategory[key] || {};
        variableByCategory[key][category] =
          (variableByCategory[key][category] || 0) + Number(item.suma || 0);
      });

    return { fixed, variableByCategory };
  }, [budgetStartDay, fixe, variabile]);

  const getEffectiveTarget = useCallback(
    (key) =>
      targetsByMonth[key] ||
      (hasTargetValues(globalTarget) ? globalTarget : null),
    [globalTarget, targetsByMonth]
  );

  const buildCycleSummary = useCallback(
    (key) => {
      const target = getEffectiveTarget(key);
      if (!target) return null;

      const variableTargets = normalizeCategoryTargets(target.categoryTargets);
      const variableActuals = normalizeCategoryTargets(
        actualByCycle.variableByCategory[key]
      );
      const fixedActual = Number(actualByCycle.fixed[key] || 0);
      const fixedTarget = Number(target.fixedTarget || 0);
      const totalVariableTarget = sumValues(variableTargets);
      const totalVariableActual = sumValues(variableActuals);
      const totalTarget = fixedTarget + totalVariableTarget;
      const totalActual = fixedActual + totalVariableActual;

      return {
        key,
        fixedActual,
        fixedTarget,
        variableTargets,
        variableActuals,
        totalTarget,
        totalActual,
        totalProgress: computeProgress(totalActual, totalTarget),
      };
    },
    [actualByCycle, getEffectiveTarget]
  );

  const currentSummary = buildCycleSummary(currentCycleKey);
  const historyMonthKeys = useMemo(
    () =>
      Array.from(
        new Set([
          ...Object.keys(targetsByMonth),
          ...Object.keys(actualByCycle.fixed),
          ...Object.keys(actualByCycle.variableByCategory),
          currentCycleKey,
        ])
      ).sort((a, b) => b.localeCompare(a)),
    [actualByCycle, currentCycleKey, targetsByMonth]
  );
  const normalizedSelectedHistoryMonth =
    selectedHistoryMonth || historyMonthKeys[0] || currentCycleKey;
  const selectedHistorySummary = normalizedSelectedHistoryMonth
    ? buildCycleSummary(normalizedSelectedHistoryMonth)
    : null;

  const saveGlobalTarget = async () => {
    const categoryTargets = categoryKeys.reduce(
      (acc, key) => ({ ...acc, [key]: Number(categoryTargetInputs[key] || 0) }),
      {}
    );

    try {
      await api.post("obiective-cheltuieli-global/", {
        fixed_target: Number(fixedTargetInput || 0),
        category_targets: categoryTargets,
      });
      await loadTargets();
      setMsg("Obiectivele pe ciclu au fost salvate.");
    } catch {
      setMsg("Eroare la salvarea obiectivelor");
    }
  };

  const renderProgressBar = (actual, target) => {
    const progress = computeProgress(actual, target);
    return (
      <div style={localStyles.progressWrapper}>
        <div
          style={{
            ...localStyles.progressFill,
            width: `${Math.min(progress, 100)}%`,
            background: progress > 100 ? "#b42318" : "#146c43",
          }}
        />
      </div>
    );
  };

  const renderSummaryCard = (summary) => {
    const totalRemaining = summary.totalTarget - summary.totalActual;

    return (
      <div key={summary.key} style={styles.card}>
        <h3 style={styles.sectionTitle}>
          {formatBudgetCycleLabel(summary.key, budgetStartDay)}
        </h3>
        <div style={localStyles.rowBetween}>
          <span>Tinta totala</span>
          <strong>{summary.totalTarget.toFixed(2)} EUR</strong>
        </div>
        <div style={localStyles.rowBetween}>
          <span>Cheltuit total</span>
          <strong>{summary.totalActual.toFixed(2)} EUR</strong>
        </div>
        {renderProgressBar(summary.totalActual, summary.totalTarget)}
        <div style={localStyles.caption}>
          {summary.totalProgress}% din tinta,{" "}
          {totalRemaining >= 0 ? "ramasi" : "depasiti"}:{" "}
          {Math.abs(totalRemaining).toFixed(2)} EUR
        </div>
        <div style={localStyles.block}>
          <div style={localStyles.rowBetween}>
            <span>Fixe</span>
            <strong>
              {summary.fixedActual.toFixed(2)} /{" "}
              {summary.fixedTarget.toFixed(2)} EUR
            </strong>
          </div>
          {renderProgressBar(summary.fixedActual, summary.fixedTarget)}
        </div>
        <div style={localStyles.block}>
          <div style={{ ...styles.date, marginBottom: 8 }}>
            Cheltuieli variabile pe subcategorii
          </div>
          {categoryKeys.map((category) => {
            const actual = Number(summary.variableActuals[category] || 0);
            const target = Number(summary.variableTargets[category] || 0);
            const progress = computeProgress(actual, target);
            return (
              <div key={`${summary.key}-${category}`} style={localStyles.subRow}>
                <div style={localStyles.rowBetween}>
                  <span>{categoryLabelMap[category]}</span>
                  <span style={localStyles.smallValue}>
                    {actual.toFixed(2)} / {target.toFixed(2)} EUR
                  </span>
                </div>
                <div style={localStyles.subProgressTrack}>
                  <div
                    style={{
                      ...localStyles.subProgressFill,
                      width: `${Math.min(progress, 100)}%`,
                      background: progress > 100 ? "#b42318" : "#1f5f8b",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderTargetForm = () => (
    <div style={styles.card}>
      <h3 style={styles.sectionTitle}>Obiective pe ciclu</h3>
      <input
        style={styles.input}
        type="number"
        min="0"
        placeholder="Tinta lunara cheltuieli fixe"
        value={fixedTargetInput}
        onChange={(e) => setFixedTargetInput(e.target.value)}
      />
      {categoryKeys.map((key) => (
        <div key={key} style={localStyles.inputRow}>
          <label style={localStyles.inputLabel}>{categoryLabelMap[key]}</label>
          <input
            style={localStyles.smallInput}
            type="number"
            min="0"
            placeholder="0"
            value={categoryTargetInputs[key]}
            onChange={(e) =>
              setCategoryTargetInputs((prev) => ({
                ...prev,
                [key]: e.target.value,
              }))
            }
          />
        </div>
      ))}
      <button style={styles.blueButton} onClick={saveGlobalTarget}>
        Salveaza obiective
      </button>
    </div>
  );

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Obiective cheltuieli</h2>
      {msg && <div style={styles.message}>{msg}</div>}

      <div style={localStyles.tabWrap}>
        {[
          ["curent", "Ciclul curent"],
          ["istoric", "Istoric"],
          ["obiective", "Obiective pe ciclu"],
        ].map(([key, label]) => (
          <button
            key={key}
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

      {activeTab === "curent" && (
        <>
          {!currentSummary && (
            <div style={styles.message}>
              Nu exista inca obiective salvate pentru ciclul curent.
            </div>
          )}
          {currentSummary && renderSummaryCard(currentSummary)}
        </>
      )}

      {activeTab === "istoric" && (
        <>
          <div style={styles.card}>
            <h3 style={styles.sectionTitle}>Selecteaza ciclul</h3>
            <input
              type="month"
              style={styles.input}
              value={normalizedSelectedHistoryMonth}
              onChange={(event) => setSelectedHistoryMonth(event.target.value)}
            />
          </div>
          {!selectedHistorySummary && (
            <div style={styles.message}>
              Nu exista obiective pentru luna selectata.
            </div>
          )}
          {selectedHistorySummary && renderSummaryCard(selectedHistorySummary)}
        </>
      )}

      {activeTab === "obiective" && renderTargetForm()}
    </div>
  );
}

const localStyles = {
  tabWrap: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: 10,
    marginBottom: 16,
  },
  tabBtn: {
    border: "1px solid var(--app-border)",
    borderRadius: 4,
    padding: "10px 12px",
    background: "var(--app-panel)",
    color: "var(--app-text)",
    fontWeight: 700,
    cursor: "pointer",
  },
  tabBtnActive: {
    background: "var(--app-primary-soft)",
    color: "var(--app-primary-dark)",
    borderColor: "var(--app-primary)",
  },
  inputRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 14,
    color: "var(--app-text)",
  },
  smallInput: {
    width: 130,
    padding: "8px 10px",
    borderRadius: 4,
    border: "1px solid var(--app-border)",
    background: "var(--app-panel)",
    color: "var(--app-text)",
  },
  progressWrapper: {
    width: "100%",
    height: 10,
    background: "var(--app-border-soft)",
    borderRadius: 4,
    overflow: "hidden",
    marginTop: 8,
    marginBottom: 8,
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
  },
  caption: {
    fontSize: 13,
    color: "var(--app-muted)",
    marginBottom: 12,
  },
  rowBetween: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    fontSize: 14,
    marginBottom: 6,
  },
  block: {
    marginTop: 12,
    paddingTop: 10,
    borderTop: "1px solid var(--app-border-soft)",
  },
  subRow: {
    marginBottom: 8,
  },
  smallValue: {
    fontSize: 12,
    color: "var(--app-muted)",
  },
  subProgressTrack: {
    marginTop: 4,
    width: "100%",
    height: 6,
    background: "var(--app-border-soft)",
    borderRadius: 4,
    overflow: "hidden",
  },
  subProgressFill: {
    height: "100%",
    borderRadius: 4,
  },
};
