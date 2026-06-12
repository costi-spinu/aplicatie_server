import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../services/api";
import styles from "../styles/iosStyles";

const STORAGE_KEY = "realizari_targets_by_month_v1";

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

const getMonthKey = (value) => {
  const date = value ? new Date(value) : new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

const toUiCategory = (cat) => (cat === "auto" ? "transport" : cat);
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
  const [activeTab, setActiveTab] = useState("curent");
  const [selectedHistoryMonth, setSelectedHistoryMonth] = useState("");
  const [fixedTargetInput, setFixedTargetInput] = useState("");
  const [categoryTargetInputs, setCategoryTargetInputs] = useState(
    buildEmptyCategoryTargets()
  );
  const [targetsByMonth, setTargetsByMonth] = useState({});
  const [globalTarget, setGlobalTarget] = useState(null);
  const [fixe, setFixe] = useState([]);
  const [variabile, setVariabile] = useState([]);
  const [msg, setMsg] = useState("");

  const currentMonthKey = getMonthKey();

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
    const [targetsRes, globalRes] = await Promise.all([
      api.get("realizari-targets/"),
      api.get("obiective-cheltuieli-global/"),
    ]);
    const remoteTargets = await migrateLocalTargets(
      normalizeApiTargets(targetsRes.data || [])
    );
    const normalizedGlobal = normalizeApiTarget(globalRes.data);
    const formTarget = hasTargetValues(normalizedGlobal)
      ? normalizedGlobal
      : remoteTargets[currentMonthKey] || normalizedGlobal;

    setTargetsByMonth(remoteTargets);
    setGlobalTarget(normalizedGlobal);
    applyTargetToInputs(formTarget);
  }, [applyTargetToInputs, currentMonthKey, migrateLocalTargets]);

  const loadExpenses = useCallback(async () => {
    const [f, v] = await Promise.all([
      api.get("cheltuieli-fixe/"),
      api.get("cheltuieli-variabile/"),
    ]);
    setFixe(f.data || []);
    setVariabile(v.data || []);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      Promise.all([loadTargets(), loadExpenses()]).catch(() =>
        setMsg("Eroare la incarcarea datelor")
      );
    }, 0);

    return () => clearTimeout(timer);
  }, [loadExpenses, loadTargets]);

  const actualByMonth = useMemo(() => {
    const fixed = {};
    const variableByCategory = {};

    fixe.forEach((item) => {
      const key = getMonthKey(item.data);
      fixed[key] = (fixed[key] || 0) + Number(item.suma || 0);
    });

    variabile
      .filter((item) => item.categorie !== "vacanta_cheltuita")
      .forEach((item) => {
        const key = getMonthKey(item.data);
        const category = toUiCategory(item.categorie || "neprevazute");
        variableByCategory[key] = variableByCategory[key] || {};
        variableByCategory[key][category] =
          (variableByCategory[key][category] || 0) + Number(item.suma || 0);
      });

    return { fixed, variableByCategory };
  }, [fixe, variabile]);

  const getEffectiveTarget = useCallback(
    (key) =>
      targetsByMonth[key] ||
      (key >= currentMonthKey && hasTargetValues(globalTarget) ? globalTarget : null),
    [currentMonthKey, globalTarget, targetsByMonth]
  );

  const buildMonthSummary = useCallback(
    (key) => {
      const target = getEffectiveTarget(key);
      if (!target) return null;

      const variableTargets = normalizeCategoryTargets(target.categoryTargets);
      const variableActuals = normalizeCategoryTargets(
        actualByMonth.variableByCategory[key]
      );
      const fixedActual = Number(actualByMonth.fixed[key] || 0);
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
    [actualByMonth, getEffectiveTarget]
  );

  const currentSummary = buildMonthSummary(currentMonthKey);
  const historyMonthKeys = Object.keys(targetsByMonth)
    .filter((key) => key < currentMonthKey)
    .sort((a, b) => b.localeCompare(a));
  const normalizedSelectedHistoryMonth = historyMonthKeys.includes(
    selectedHistoryMonth
  )
    ? selectedHistoryMonth
    : "";
  const selectedHistorySummary = normalizedSelectedHistoryMonth
    ? buildMonthSummary(normalizedSelectedHistoryMonth)
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
      setMsg("Obiectivele lunare au fost salvate.");
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
        <h3 style={styles.sectionTitle}>{summary.key}</h3>
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
      <h3 style={styles.sectionTitle}>Obiective lunare</h3>
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
          ["curent", "Luna curenta"],
          ["istoric", "Istoric"],
          ["obiective", "Obiective lunare"],
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
              Nu exista inca obiective salvate pentru luna curenta.
            </div>
          )}
          {currentSummary && renderSummaryCard(currentSummary)}
        </>
      )}

      {activeTab === "istoric" && (
        <>
          {historyMonthKeys.length === 0 && (
            <div style={styles.message}>Nu exista inca luni in istoric.</div>
          )}
          {historyMonthKeys.length > 0 && (
            <div style={styles.card}>
              <h3 style={styles.sectionTitle}>Selecteaza luna</h3>
              <select
                style={styles.input}
                value={normalizedSelectedHistoryMonth}
                onChange={(event) => setSelectedHistoryMonth(event.target.value)}
              >
                <option value="">Selecteaza luna</option>
                {historyMonthKeys.map((key) => (
                  <option key={key} value={key}>
                    {key}
                  </option>
                ))}
              </select>
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
