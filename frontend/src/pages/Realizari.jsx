import { useEffect, useMemo, useState } from "react";
import api from "../services/api";
import styles from "../styles/iosStyles";

const STORAGE_KEY = "realizari_targets_by_month_v1";

const categoryLabelMap = {
    alimente: "🍎 Alimente",
    sanatate: "🏥 Sănătate",
    transport: "🚗 Transport",
    cultura: "🎭 Cultură",
    shopping: "🛍 Shopping",
    neprevazute: "⚠️ Neprevăzute",
    animalute: "🐾 Animăluțe",
    vacanta: "✈️ Vacanță",
    divertisment: "🍽 Ieșiri / Restaurante / Diverse",
    investitii: "📈 Investiții",
};

const categoryKeys = Object.keys(categoryLabelMap);

const getMonthKey = (value) => {
    const date = value ? new Date(value) : new Date();
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
};

const toUiCategory = (cat) => (cat === "auto" ? "transport" : cat);

const buildEmptyCategoryTargets = () =>
    categoryKeys.reduce((acc, key) => {
        acc[key] = "";
        return acc;
    }, {});

const normalizeCategoryTargets = (values = {}) =>
    categoryKeys.reduce((acc, key) => {
        const raw = Number(values[key] || 0);
        acc[key] = Number.isFinite(raw) ? raw : 0;
        return acc;
    }, {});

const sumValues = (obj) => Object.values(obj || {}).reduce((acc, value) => acc + Number(value || 0), 0);

const computeProgress = (actual, target) => {
    if (!target || target <= 0) {
        return 0;
    }

    return Math.round((actual / target) * 100);
};

export default function Realizari() {
    const [activeTab, setActiveTab] = useState("curent");
    const [monthKey, setMonthKey] = useState(getMonthKey());
    const [fixedTargetInput, setFixedTargetInput] = useState("");
    const [categoryTargetInputs, setCategoryTargetInputs] = useState(buildEmptyCategoryTargets());

    const [targetsByMonth, setTargetsByMonth] = useState({});
    const [fixe, setFixe] = useState([]);
    const [variabile, setVariabile] = useState([]);

    const currentMonthKey = getMonthKey();

    const loadTargets = () => {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            setTargetsByMonth({});
            return;
        }

        try {
            const parsed = JSON.parse(raw);
            setTargetsByMonth(parsed || {});
        } catch {
            setTargetsByMonth({});
        }
    };

    const persistTargets = (next) => {
        setTargetsByMonth(next);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    };

    const loadExpenses = async () => {
        const [f, v] = await Promise.all([
            api.get("cheltuieli-fixe/"),
            api.get("cheltuieli-variabile/"),
        ]);

        setFixe(f.data || []);
        setVariabile(v.data || []);
    };

    useEffect(() => {
        loadTargets();
        loadExpenses();
    }, []);

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

                if (!variableByCategory[key]) {
                    variableByCategory[key] = {};
                }

                variableByCategory[key][category] =
                    (variableByCategory[key][category] || 0) + Number(item.suma || 0);
            });

        return { fixed, variableByCategory };
    }, [fixe, variabile]);

    const monthTarget = targetsByMonth[monthKey] || null;

    useEffect(() => {
        if (!monthTarget) {
            setFixedTargetInput("");
            setCategoryTargetInputs(buildEmptyCategoryTargets());
            return;
        }

        setFixedTargetInput(String(monthTarget.fixedTarget || ""));
        setCategoryTargetInputs(
            categoryKeys.reduce((acc, key) => {
                acc[key] = monthTarget.categoryTargets?.[key]
                    ? String(monthTarget.categoryTargets[key])
                    : "";
                return acc;
            }, {})
        );
    }, [monthKey, monthTarget]);

    const buildMonthSummary = (key) => {
        const target = targetsByMonth[key];
        if (!target) {
            return null;
        }

        const normalizedTargetCats = normalizeCategoryTargets(target.categoryTargets);
        const actualCats = normalizeCategoryTargets(actualByMonth.variableByCategory[key]);

        const fixedActual = Number(actualByMonth.fixed[key] || 0);
        const fixedTarget = Number(target.fixedTarget || 0);

        const totalVariableTarget = sumValues(normalizedTargetCats);
        const totalVariableActual = sumValues(actualCats);

        const totalTarget = fixedTarget + totalVariableTarget;
        const totalActual = fixedActual + totalVariableActual;

        return {
            key,
            fixedActual,
            fixedTarget,
            variableTargets: normalizedTargetCats,
            variableActuals: actualCats,
            totalVariableTarget,
            totalVariableActual,
            totalTarget,
            totalActual,
            totalProgress: computeProgress(totalActual, totalTarget),
            fixedProgress: computeProgress(fixedActual, fixedTarget),
        };
    };

    const currentSummary = buildMonthSummary(currentMonthKey);

    const historySummaries = Object.keys(targetsByMonth)
        .filter((key) => key !== currentMonthKey)
        .sort((a, b) => b.localeCompare(a))
        .map((key) => buildMonthSummary(key))
        .filter(Boolean);

    const saveMonthTarget = () => {
        const fixedTarget = Number(fixedTargetInput || 0);
        const categoryTargets = categoryKeys.reduce((acc, key) => {
            acc[key] = Number(categoryTargetInputs[key] || 0);
            return acc;
        }, {});

        const next = {
            ...targetsByMonth,
            [monthKey]: {
                fixedTarget,
                categoryTargets,
                updatedAt: new Date().toISOString(),
            },
        };

        persistTargets(next);
    };

    const deleteMonthTarget = (key) => {
        if (!window.confirm("Sigur vrei să ștergi această țintă lunară?")) {
            return;
        }

        const next = { ...targetsByMonth };
        delete next[key];
        persistTargets(next);

        if (key === monthKey) {
            setFixedTargetInput("");
            setCategoryTargetInputs(buildEmptyCategoryTargets());
        }
    };

    const renderProgressBar = (actual, target) => {
        const progress = computeProgress(actual, target);
        const width = Math.min(progress, 100);
        const overLimit = progress > 100;

        return (
            <div style={localStyles.progressWrapper}>
                <div
                    style={{
                        ...localStyles.progressFill,
                        width: `${width}%`,
                        background: overLimit ? "#FF3B30" : "#34C759",
                    }}
                />
            </div>
        );
    };

    const renderSummaryCard = (summary, showActions = false) => {
        const totalRemaining = summary.totalTarget - summary.totalActual;

        return (
            <div key={summary.key} style={styles.card}>
                <div style={localStyles.cardHeader}>
                    <h3 style={{ ...styles.sectionTitle, marginBottom: 0 }}>
                        📅 {summary.key}
                    </h3>

                    {showActions && (
                        <button
                            style={localStyles.deleteBtn}
                            onClick={() => deleteMonthTarget(summary.key)}
                        >
                            Șterge
                        </button>
                    )}
                </div>

                <div style={localStyles.rowBetween}>
                    <span>Țintă totală</span>
                    <strong>{summary.totalTarget.toFixed(2)} EUR</strong>
                </div>
                <div style={localStyles.rowBetween}>
                    <span>Cheltuit total</span>
                    <strong>{summary.totalActual.toFixed(2)} EUR</strong>
                </div>

                {renderProgressBar(summary.totalActual, summary.totalTarget)}
                <div style={localStyles.caption}>
                    {summary.totalProgress}% din țintă • {totalRemaining >= 0 ? "rămași" : "depășiți"}: {Math.abs(totalRemaining).toFixed(2)} EUR
                </div>

                <div style={localStyles.block}>
                    <div style={localStyles.rowBetween}>
                        <span>🏠 Fixe</span>
                        <strong>{summary.fixedActual.toFixed(2)} / {summary.fixedTarget.toFixed(2)} EUR</strong>
                    </div>
                    {renderProgressBar(summary.fixedActual, summary.fixedTarget)}
                </div>

                <div style={localStyles.block}>
                    <div style={{ ...styles.date, marginBottom: 8 }}>Cheltuieli variabile (subcategorii)</div>

                    {categoryKeys.map((category) => {
                        const actual = Number(summary.variableActuals[category] || 0);
                        const target = Number(summary.variableTargets[category] || 0);
                        const progress = computeProgress(actual, target);

                        return (
                            <div key={`${summary.key}-${category}`} style={localStyles.subRow}>
                                <div style={localStyles.rowBetween}>
                                    <span>{categoryLabelMap[category]}</span>
                                    <span style={localStyles.smallValue}>{actual.toFixed(2)} / {target.toFixed(2)} EUR</span>
                                </div>
                                <div style={localStyles.subProgressTrack}>
                                    <div
                                        style={{
                                            ...localStyles.subProgressFill,
                                            width: `${Math.min(progress, 100)}%`,
                                            background: progress > 100 ? "#FF3B30" : "#0A84FF",
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

    return (
        <div style={styles.container}>
            <div style={styles.card}>
                <h2 style={styles.title}>🎯 Realizări</h2>

                <div style={localStyles.tabWrap}>
                    <button
                        onClick={() => {
                            setActiveTab("curent");
                            setMonthKey(currentMonthKey);
                        }}
                        style={{ ...localStyles.tabBtn, ...(activeTab === "curent" ? localStyles.tabBtnActive : {}) }}
                    >
                        Luna curentă
                    </button>
                    <button
                        onClick={() => setActiveTab("istoric")}
                        style={{ ...localStyles.tabBtn, ...(activeTab === "istoric" ? localStyles.tabBtnActive : {}) }}
                    >
                        Istoric
                    </button>
                </div>

                {activeTab === "curent" && (
                    <>
                        <div style={styles.card}>
                            <h3 style={styles.sectionTitle}>Setează țintele pentru {currentMonthKey}</h3>

                            <input
                                style={styles.input}
                                type="number"
                                min="0"
                                placeholder="Țintă totală cheltuieli fixe"
                                value={fixedTargetInput}
                                onChange={(e) => setFixedTargetInput(e.target.value)}
                            />

                            {categoryKeys.map((key) => (
                                <div key={`current-${key}`} style={localStyles.inputRow}>
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

                            <button style={styles.blueButton} onClick={saveMonthTarget}>
                                {targetsByMonth[currentMonthKey] ? "💾 Salvează modificările" : "➕ Salvează țintele lunii"}
                            </button>

                            {targetsByMonth[currentMonthKey] && (
                                <button
                                    style={localStyles.deleteMonthBtn}
                                    onClick={() => deleteMonthTarget(currentMonthKey)}
                                >
                                    🗑 Șterge țintele lunii curente
                                </button>
                            )}
                        </div>

                        {!currentSummary && (
                            <div style={styles.message}>
                                Nu există încă ținte salvate pentru luna curentă.
                            </div>
                        )}

                        {currentSummary && renderSummaryCard(currentSummary, false)}
                    </>
                )}

                {activeTab === "istoric" && (
                    <>
                        <div style={styles.card}>
                            <h3 style={styles.sectionTitle}>Administrare ținte lunare (edit / delete)</h3>
                            <input
                                type="month"
                                style={styles.input}
                                value={monthKey}
                                onChange={(e) => setMonthKey(e.target.value)}
                            />

                            <input
                                style={styles.input}
                                type="number"
                                min="0"
                                placeholder="Țintă totală cheltuieli fixe"
                                value={fixedTargetInput}
                                onChange={(e) => setFixedTargetInput(e.target.value)}
                            />

                            {categoryKeys.map((key) => (
                                <div key={`history-${key}`} style={localStyles.inputRow}>
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

                            <button style={styles.blueButton} onClick={saveMonthTarget}>
                                {targetsByMonth[monthKey] ? "💾 Salvează modificările" : "➕ Salvează lună în istoric"}
                            </button>

                            {targetsByMonth[monthKey] && monthKey !== currentMonthKey && (
                                <button style={localStyles.deleteMonthBtn} onClick={() => deleteMonthTarget(monthKey)}>
                                    🗑 Șterge luna selectată
                                </button>
                            )}
                        </div>

                        {historySummaries.length === 0 && (
                            <div style={styles.message}>Nu există încă luni în istoric.</div>
                        )}

                        {historySummaries.map((summary) => renderSummaryCard(summary, true))}
                    </>
                )}
            </div>
        </div>
    );
}

const localStyles = {
    tabWrap: {
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 10,
        marginBottom: 16,
    },
    tabBtn: {
        border: "1px solid #E5E5EA",
        borderRadius: 12,
        padding: "10px 12px",
        background: "#fff",
        fontWeight: 600,
        cursor: "pointer",
    },
    tabBtnActive: {
        background: "#E5F0FF",
        color: "#0A84FF",
        borderColor: "#C7DDFF",
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
        color: "#1C1C1E",
    },
    smallInput: {
        width: 130,
        padding: "8px 10px",
        borderRadius: 10,
        border: "1px solid #E5E5EA",
        background: "#F9F9FB",
    },
    progressWrapper: {
        width: "100%",
        height: 10,
        background: "#E5E5EA",
        borderRadius: 999,
        overflow: "hidden",
        marginTop: 8,
        marginBottom: 8,
    },
    progressFill: {
        height: "100%",
        borderRadius: 999,
    },
    caption: {
        fontSize: 13,
        color: "#636366",
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
        borderTop: "1px solid #F0F0F5",
    },
    subRow: {
        marginBottom: 8,
    },
    smallValue: {
        fontSize: 12,
        color: "#636366",
    },
    subProgressTrack: {
        marginTop: 4,
        width: "100%",
        height: 6,
        background: "#E5E5EA",
        borderRadius: 999,
        overflow: "hidden",
    },
    subProgressFill: {
        height: "100%",
        borderRadius: 999,
    },
    deleteMonthBtn: {
        width: "95%",
        marginTop: 10,
        padding: "10px 14px",
        borderRadius: 12,
        border: "none",
        background: "#FFE5E5",
        color: "#FF3B30",
        fontWeight: 600,
        cursor: "pointer",
    },
    cardHeader: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 10,
    },
    deleteBtn: {
        border: "none",
        background: "transparent",
        color: "#FF3B30",
        fontWeight: 600,
        cursor: "pointer",
    },
};
