import { useEffect, useMemo, useState } from "react";
import api from "../services/api";
import styles from "../styles/iosStyles";

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

const categoryLabelMap = {
    alimente: "🍎 Alimente",
    sanatate: "🏥 Sănătate",
    transport: "🚗 Transport",
    cultura: "🎭 Cultură",
    shopping: "🛍 Shopping",
    neprevazute: "⚠️ Neprevăzute",
    animalute: "🐾 Animăluțe",
    vacanta: "✈️ Vacanță",
    divertisment: "🍽 Iesiri/Restaurante/Diverse",
    investitii: "📈 Investiții",
};

export default function Cheltuieli() {
    const [mainTab, setMainTab] = useState("gestionare"); // gestionare | status-variabile | istoric-cheltuieli
    const [tab, setTab] = useState("variabile"); // fixe | variabile
    const [categorie, setCategorie] = useState("alimente");

    const [totalCheltuit, setTotalCheltuit] = useState(0);
    const [totalFixe, setTotalFixe] = useState(0);
    const [totalVariabile, setTotalVariabile] = useState(0);
    const [venitTotal, setVenitTotal] = useState(0);
    const [baniRamasi, setBaniRamasi] = useState(0);

    const [descriere, setDescriere] = useState("");
    const [suma, setSuma] = useState("");
    const [moneda, setMoneda] = useState("EUR");
    const [data, setData] = useState(new Date().toISOString().split("T")[0]);

    const [fixe, setFixe] = useState([]);
    const [variabile, setVariabile] = useState([]);
    const [editId, setEditId] = useState(null);

    const [lastDeleted, setLastDeleted] = useState(null);
    const [undoTab, setUndoTab] = useState(null);

    const cycleRange = useMemo(() => getCurrentCycleRange(), []);

    const inCurrentCycle = (itemDate) => {
        const current = toDateOnly(itemDate);
        return current >= cycleRange.start && current <= cycleRange.end;
    };

    const sortDescByNewest = (a, b) => {
        const dateA = new Date(a.created_at || a.data);
        const dateB = new Date(b.created_at || b.data);

        if (dateB.getTime() !== dateA.getTime()) {
            return dateB.getTime() - dateA.getTime();
        }

        return Number(b.id || 0) - Number(a.id || 0);
    };

    const loadData = async () => {
        const [f, v, buget] = await Promise.all([
            api.get("cheltuieli-fixe/"),
            api.get("cheltuieli-variabile/"),
            api.get("buget/lunar/"),
        ]);

        setFixe(f.data);
        setVariabile(v.data);

        // setTotalCheltuit(buget.data.cheltuieli);
        setVenitTotal(buget.data.venit);
        // setBaniRamasi(buget.data.economii);
        // setTotalFixe(buget.data.fixe);
        // setTotalVariabile(buget.data.variabile);
    };

    useEffect(() => {
        loadData();
    }, []);

    const startEdit = (item) => {
        setEditId(item.id);
        setSuma(item.suma);
        setMoneda(item.moneda);
        setData(item.data);

        if (tab === "fixe") {
            setDescriere(item.descriere);
        } else {
            setCategorie(toUiCategory(item.categorie));
        }
    };

    const resetForm = () => {
        setEditId(null);
        setDescriere("");
        setCategorie("alimente");
        setSuma("");
        setMoneda("EUR");
        setData(new Date().toISOString().split("T")[0]);
    };

    const adauga = async () => {
        if (!suma) return;

        const payload =
            tab === "fixe"
                ? { descriere, suma, moneda, data }
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

    const sterge = async (item) => {
        if (!window.confirm("Sigur ștergi?")) return;

        setLastDeleted(item);
        setUndoTab(tab);

        await api.delete(
            `${tab === "fixe" ? "cheltuieli-fixe" : "cheltuieli-variabile"}/${item.id}/`
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

    const procent = venitTotal > 0 ? Math.round((totalCheltuit / venitTotal) * 100) : 0;

    // const list = (tab === "fixe" ? fixe : variabile)
    //     .filter((item) => inCurrentCycle(item.data))
    //     .sort(sortDescByNewest);

    useEffect(() => {
        const fixeCurente = fixe
            .filter((item) => inCurrentCycle(item.data))
            .reduce((acc, item) => acc + Number(item.suma || 0), 0);

        const variabileCurente = variabile
            .filter((item) => inCurrentCycle(item.data) && item.categorie !== "vacanta_cheltuita")
            .reduce((acc, item) => acc + Number(item.suma || 0), 0);

        const cheltuitCurent = fixeCurente + variabileCurente;

        setTotalFixe(fixeCurente);
        setTotalVariabile(variabileCurente);
        setTotalCheltuit(cheltuitCurent);
        setBaniRamasi(venitTotal - cheltuitCurent);
    }, [fixe, variabile, venitTotal, cycleRange]);

    const list = (tab === "fixe" ? fixe : variabile.filter((item) => item.categorie !== "vacanta_cheltuita"))

    const variableStatus = variabile
        // .filter((item) => inCurrentCycle(item.data))
        .filter((item) => inCurrentCycle(item.data) && item.categorie !== "vacanta_cheltuita")
        .reduce((acc, item) => {
            const key = toUiCategory(item.categorie || "neprevazute");
            acc[key] = (acc[key] || 0) + Number(item.suma || 0);
            return acc;
        }, {});

    const variableStatusRows = Object.entries(variableStatus)
        .sort(([, a], [, b]) => b - a)
        .map(([key, sum]) => ({
            key,
            label: categoryLabelMap[key] || key,
            sum,
        }));

    const totalVariabileCurente = variableStatusRows.reduce((acc, row) => acc + row.sum, 0);




    // const combinedHistory = [...fixe, ...variabile]
    const combinedHistory = [...fixe, ...variabile.filter((item) => item.categorie !== "vacanta_cheltuita")]
        .filter((item) => inCurrentCycle(item.data))
        .sort(sortDescByNewest);

    return (
        <div style={styles.container}>
            <div style={styles.card}>
                <h2 style={styles.title}>💸 Gestionare Cheltuieli</h2>

                <div style={localStyles.mainTabsWrapper}>
                    <button
                        onClick={() => setMainTab("gestionare")}
                        style={{ ...localStyles.mainTabBtn, ...(mainTab === "gestionare" ? localStyles.mainTabBtnActive : {}) }}
                    >
                        Gestionare
                    </button>
                    <button
                        onClick={() => setMainTab("status-variabile")}
                        style={{ ...localStyles.mainTabBtn, ...(mainTab === "status-variabile" ? localStyles.mainTabBtnActive : {}) }}
                    >
                        Status cheltuieli variabile
                    </button>
                    <button
                        onClick={() => setMainTab("istoric-cheltuieli")}
                        style={{ ...localStyles.mainTabBtn, ...(mainTab === "istoric-cheltuieli" ? localStyles.mainTabBtnActive : {}) }}
                    >
                        Istoric cheltuieli
                    </button>
                </div>

                {mainTab === "gestionare" && (
                    <>
                        <div style={styles.heroCard}>
                            <div style={styles.heroLabel}>💰 Bani rămași</div>
                            <div style={{ ...styles.heroValue, color: baniRamasi >= 0 ? "#ffffff" : "#ff0000" }}>
                                {/* {baniRamasi} EUR */}
                                {Number(baniRamasi || 0).toFixed(2)} EUR
                            </div>
                        </div>

                        <div style={localStyles.segmentWrapper}>
                            <div
                                style={{
                                    ...localStyles.segmentSlider,
                                    left: tab === "fixe" ? "4px" : "50%",
                                }}
                            />
                            <button onClick={() => setTab("fixe")} style={localStyles.segmentBtn}>Fixe</button>
                            <button onClick={() => setTab("variabile")} style={localStyles.segmentBtn}>Variabile</button>
                        </div>

                        <div style={localStyles.totalCard}>
                            <div style={localStyles.totalRow}>
                                <span>💸 Total cheltuit</span>
                                <strong>{totalCheltuit} EUR</strong>
                            </div>

                            <div style={localStyles.progressBarWrapper}>
                                <div
                                    style={{
                                        ...localStyles.progressBar,
                                        width: `${procent}%`,
                                        background: procent > 80 ? "#FF3B30" : "#34C759",
                                    }}
                                />
                            </div>

                            <div style={localStyles.percentText}>{procent}% din venit</div>
                        </div>

                        <div style={localStyles.breakdownRow}><span>🏠 Fixe</span><strong>{totalFixe} EUR</strong></div>
                        <div style={localStyles.breakdownRow}><span>🛍 Variabile</span><strong>{totalVariabile} EUR</strong></div>

                        <div style={styles.card}>
                            <h3 style={styles.sectionTitle}>{editId ? "✏️ Modifică" : "➕ Adaugă"}</h3>

                            {tab === "fixe" ? (
                                <input
                                    style={styles.input}
                                    placeholder="Descriere"
                                    value={descriere}
                                    onChange={(e) => setDescriere(e.target.value)}
                                />
                            ) : (
                                <select style={styles.input} value={categorie} onChange={(e) => setCategorie(e.target.value)}>
                                    <option value="alimente">🍎 Alimente</option>
                                    <option value="sanatate">🏥 Sănătate</option>
                                    <option value="transport">🚗 Transport</option>
                                    <option value="cultura">🎭 Cultură</option>
                                    <option value="shopping">🛍 Shopping</option>
                                    <option value="neprevazute">⚠️ Neprevăzute</option>
                                    <option value="animalute">🐾 Animăluțe</option>
                                    <option value="vacanta">✈️ Vacanță/Investitii</option>
                                    <option value="divertisment">🍽 Iesiri/Restaurante/Diverse</option>
                                    <option value="investitii">📈 Investiții</option>
                                </select>
                            )}

                            <input style={styles.input} type="number" placeholder="Sumă" value={suma} onChange={(e) => setSuma(e.target.value)} />

                            <select style={styles.input} value={moneda} onChange={(e) => setMoneda(e.target.value)}>
                                <option value="EUR">EUR €</option>
                                <option value="RON">RON lei</option>
                            </select>

                            <input style={styles.input} type="date" value={data} onChange={(e) => setData(e.target.value)} />

                            <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
                                <button style={styles.blueButton} onClick={adauga}>{editId ? "💾 Salvează" : "➕ Adaugă"}</button>

                                {editId && (
                                    <button style={localStyles.cancelBtn} onClick={resetForm}>Anulează</button>
                                )}
                            </div>
                        </div>

                        {lastDeleted && (
                            <div style={localStyles.undoCard}>
                                <span>🗑 Cheltuială ștearsă</span>
                                <button onClick={undoDelete} style={localStyles.undoBtn}>Undo</button>
                            </div>
                        )}

                        <h3 style={{ marginTop: 30, fontWeight: 600 }}>
                            📋 Istoric ({cycleRange.start.toLocaleDateString("ro-RO")} - {cycleRange.end.toLocaleDateString("ro-RO")})
                        </h3>

                        <div>
                            {list.map((c) => (
                                <div key={c.id} style={styles.row}>
                                    <div>
                                        <div style={{ fontWeight: 600 }}>
                                            {tab === "variabile"
                                                ? (categoryLabelMap[toUiCategory(c.categorie)] || toUiCategory(c.categorie))
                                                : c.descriere}
                                        </div>
                                        <div style={styles.date}>{new Date(c.data).toLocaleDateString("ro-RO")}</div>
                                    </div>

                                    <div style={{ textAlign: "right" }}>
                                        <div style={styles.amount}>{c.suma} {c.moneda}</div>

                                        <div style={{ marginTop: 6, display: "flex", gap: 12, alignItems: "center" }}>
                                            <span style={localStyles.userBadge}>{c.username}</span>
                                            <button onClick={() => startEdit(c)} style={localStyles.editBtn}>Edit</button>
                                            <button onClick={() => sterge(c)} style={styles.deleteBtn}>Șterge</button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}

                {mainTab === "status-variabile" && (
                    <div style={styles.card}>
                        <h3 style={styles.sectionTitle}>📊 Status cheltuieli variabile</h3>
                        <div style={styles.date}>
                            Interval curent: {cycleRange.start.toLocaleDateString("ro-RO")} - {cycleRange.end.toLocaleDateString("ro-RO")}
                        </div>

                        <div style={{ marginTop: 16 }}>
                            {variableStatusRows.length === 0 && <div style={styles.message}>Nu există cheltuieli variabile în interval.</div>}

                            {variableStatusRows.map((row) => (
                                <div key={row.key} style={styles.row}>
                                    <span>{row.label}</span>
                                    <strong>{row.sum.toLocaleString("ro-RO")} EUR</strong>
                                </div>
                            ))}

                            {variableStatusRows.length > 0 && (
                                <div style={{ ...styles.row, background: "#F6FFF8", borderRadius: 12, marginTop: 8, paddingInline: 10 }}>
                                    <strong>Total variabile</strong>
                                    <strong style={{ color: "#34C759" }}>{totalVariabileCurente.toLocaleString("ro-RO")} EUR</strong>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {mainTab === "istoric-cheltuieli" && (
                    <div style={styles.card}>
                        <h3 style={styles.sectionTitle}>🧾 Istoric cheltuieli </h3>
                        <div style={styles.date}>
                            Interval curent: {cycleRange.start.toLocaleDateString("ro-RO")} - {cycleRange.end.toLocaleDateString("ro-RO")}
                        </div>

                        <div style={{ marginTop: 14 }}>
                            {combinedHistory.length === 0 && (
                                <div style={styles.message}>Nu există cheltuieli în interval.</div>
                            )}

                            {combinedHistory.map((item) => (
                                <div key={`${item.id}-${item.data}`} style={styles.row}>
                                    <div>
                                        <div style={{ fontWeight: 600 }}>
                                            {item.descriere
                                                ? `🏠 ${item.descriere}`
                                                : (categoryLabelMap[toUiCategory(item.categorie)] || toUiCategory(item.categorie))}
                                        </div>
                                        <div style={styles.date}>{new Date(item.data).toLocaleDateString("ro-RO")}</div>
                                    </div>
                                    <strong>{item.suma} {item.moneda}</strong>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

const localStyles = {
    mainTabsWrapper: {
        display: "grid",
        gridTemplateColumns: "1fr",
        gap: 8,
        marginBottom: 16,
    },
    mainTabBtn: {
        border: "1px solid #E5E5EA",
        background: "#fff",
        borderRadius: 12,
        padding: "10px 12px",
        fontWeight: 600,
        cursor: "pointer",
        textAlign: "left",
    },
    mainTabBtnActive: {
        background: "#E5F0FF",
        color: "#0A84FF",
        borderColor: "#C7DDFF",
    },
    segmentWrapper: {
        position: "relative",
        display: "flex",
        background: "#E5E5EA",
        borderRadius: "999px",
        padding: "4px",
    },
    segmentSlider: {
        position: "absolute",
        top: "4px",
        bottom: "4px",
        width: "50%",
        background: "white",
        borderRadius: "999px",
        transition: "all 0.3s ease",
        boxShadow: "0 3px 10px rgba(0,0,0,0.1)",
    },
    segmentBtn: {
        flex: 1,
        border: "none",
        background: "transparent",
        padding: "8px 0",
        fontWeight: "600",
        cursor: "pointer",
        zIndex: 1,
    },
    cancelBtn: {
        background: "transparent",
        border: "none",
        color: "#8E8E93",
        fontWeight: "500",
        cursor: "pointer",
    },
    undoCard: {
        marginTop: 20,
        padding: 15,
        background: "#FFF4CC",
        borderRadius: "14px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
    },
    undoBtn: {
        background: "none",
        border: "none",
        color: "#0A84FF",
        fontWeight: "600",
        cursor: "pointer",
    },
    editBtn: {
        background: "none",
        border: "none",
        color: "#0A84FF",
        cursor: "pointer",
    },
    userBadge: {
        background: "#0A84FF",
        color: "white",
        padding: "3px 8px",
        borderRadius: "12px",
        fontSize: "12px",
        fontWeight: 500,
    },
    totalCard: {
        marginTop: 20,
        padding: 16,
        background: "#F2F2F7",
        borderRadius: 16,
    },
    totalRow: {
        display: "flex",
        justifyContent: "space-between",
        fontWeight: 600,
        marginBottom: 10,
    },
    progressBarWrapper: {
        height: 8,
        background: "#E5E5EA",
        borderRadius: 10,
        overflow: "hidden",
    },
    progressBar: {
        height: "90%",
        transition: "all 0.3s ease",
    },
    percentText: {
        marginTop: 8,
        fontSize: 13,
        opacity: 0.7,
    },
    breakdownRow: {
        display: "flex",
        justifyContent: "space-between",
        marginTop: 10,
        fontSize: 14,
        fontWeight: 500,
    },
};
