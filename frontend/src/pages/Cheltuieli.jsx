import { useEffect, useState } from "react";
import api from "../services/api";
import styles from "../styles/iosStyles";

export default function Cheltuieli() {
    const [tab, setTab] = useState("variabile");
    const [categorie, setCategorie] = useState("alimente");

    const [totalCheltuit, setTotalCheltuit] = useState(0);
    const [totalFixe, setTotalFixe] = useState(0);
    const [totalVariabile, setTotalVariabile] = useState(0);
    const [venitTotal, setVenitTotal] = useState(0);
    const [baniRamasi, setBaniRamasi] = useState(0);
    const [descriere, setDescriere] = useState("");
    const [suma, setSuma] = useState("");
    const [moneda, setMoneda] = useState("EUR");
    const [data, setData] = useState(
        new Date().toISOString().split("T")[0]
    );

    const [fixe, setFixe] = useState([]);
    const [variabile, setVariabile] = useState([]);
    const [editId, setEditId] = useState(null);

    const [lastDeleted, setLastDeleted] = useState(null);
    const [undoTab, setUndoTab] = useState(null);

    const loadData = async () => {
        const [f, v, buget] = await Promise.all([
            api.get("cheltuieli-fixe/"),
            api.get("cheltuieli-variabile/"),
            api.get("buget/lunar/")
        ]);

        setFixe(f.data);
        setVariabile(v.data);

        setTotalCheltuit(buget.data.cheltuieli);
        setVenitTotal(buget.data.venit);
        setBaniRamasi(buget.data.economii);
        setTotalFixe(buget.data.fixe);
        setTotalVariabile(buget.data.variabile);
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
            setCategorie(item.categorie);
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
                : { categorie, suma, moneda, data };

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
                    categorie: lastDeleted.categorie,
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

    const procent = venitTotal > 0
        ? Math.round((totalCheltuit / venitTotal) * 100)
        : 0;

    const list = tab === "fixe" ? fixe : variabile;

    return (
        <div style={styles.container}>
            <div style={styles.card}>
                <h2 style={styles.title}>💸 Gestionare Cheltuieli</h2>
                <div style={styles.heroCard}>
                    <div style={styles.heroLabel}>💰 Bani rămași</div>
                    <div style={{
                        ...styles.heroValue,
                        color: baniRamasi >= 0 ? "#ffffff" : "#ff0000"
                    }}>
                        {baniRamasi} EUR
                    </div>
                </div>

                {/* Segmented Control */}
                <div style={localStyles.segmentWrapper}>
                    <div
                        style={{
                            ...localStyles.segmentSlider,
                            left: tab === "fixe" ? "4px" : "50%",
                        }}
                    />
                    <button
                        onClick={() => setTab("fixe")}
                        style={localStyles.segmentBtn}
                    >
                        Fixe
                    </button>
                    <button
                        onClick={() => setTab("variabile")}
                        style={localStyles.segmentBtn}
                    >
                        Variabile
                    </button>
                </div>

                {/* Progress bar */}
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
                                background: procent > 80 ? "#FF3B30" : "#34C759"
                            }}
                        />
                    </div>


                    {/* Total cheltuieli fixe si variabile */}

                    <div style={localStyles.percentText}>
                        {procent}% din venit
                    </div>
                </div>

                <div style={localStyles.breakdownRow}>
                    <span>🏠 Fixe</span>
                    <strong>{totalFixe} EUR</strong>
                </div>

                <div style={localStyles.breakdownRow}>
                    <span>🛍 Variabile</span>
                    <strong>{totalVariabile} EUR</strong>
                </div>



                {/* FORM */}
                <div style={{ marginTop: 30 }}>
                    {tab === "fixe" && (
                        <input
                            style={styles.input}
                            placeholder="Descriere"
                            value={descriere}
                            onChange={(e) => setDescriere(e.target.value)}
                        />
                    )}

                    {tab === "variabile" && (
                        <select
                            style={styles.input}
                            value={categorie}
                            onChange={(e) => setCategorie(e.target.value)}
                        >
                            <option value="alimente">🍎 Alimente</option>
                            <option value="sanatate">🏥 Sănătate</option>
                            <option value="auto">🚗 Auto</option>
                            <option value="cultura">🎭 Cultură</option>
                            <option value="shopping">🛍 Shopping</option>
                            <option value="neprevazute">⚠️ Neprevăzute</option>
                            <option value="animalute">🐾 Animăluțe</option>
                            <option value="vacanta">✈️ Vacanță</option>
                            <option value="divertisment">🎮 Divertisment</option>
                            <option value="investitii">📈 Investiții</option>
                        </select>
                    )}

                    <input
                        style={styles.input}
                        type="number"
                        placeholder="Sumă"
                        value={suma}
                        onChange={(e) => setSuma(e.target.value)}
                    />

                    <div style={{ display: "flex", gap: 12 }}>
                        <select
                            style={styles.input}
                            value={moneda}
                            onChange={(e) => setMoneda(e.target.value)}
                        >
                            <option value="EUR">EUR €</option>
                            <option value="RON">RON lei</option>
                        </select>

                        <input
                            style={styles.input}
                            type="date"
                            value={data}
                            onChange={(e) => setData(e.target.value)}
                        />
                    </div>

                    <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
                        <button style={styles.blueButton} onClick={adauga}>
                            {editId ? "💾 Salvează" : "➕ Adaugă"}
                        </button>

                        {editId && (
                            <button
                                style={localStyles.cancelBtn}
                                onClick={resetForm}
                            >
                                Anulează
                            </button>
                        )}
                    </div>
                </div>

                {/* UNDO */}
                {lastDeleted && (
                    <div style={localStyles.undoCard}>
                        <span>🗑 Cheltuială ștearsă</span>
                        <button onClick={undoDelete} style={localStyles.undoBtn}>
                            Undo
                        </button>
                    </div>
                )}

                {/* LISTĂ */}
                <h3 style={{ marginTop: 40, fontWeight: 600 }}>
                    📋 Istoric
                </h3>

                <div>
                    {list.map((c) => (
                        <div key={c.id} style={styles.row}>
                            <div>
                                <div style={{ fontWeight: 600 }}>
                                    {c.categorie || c.descriere}
                                </div>
                                <div style={styles.date}>
                                    {new Date(c.data).toLocaleDateString("ro-RO")}
                                </div>
                            </div>

                            <div style={{ textAlign: "right" }}>
                                <div style={styles.amount}>
                                    {c.suma} {c.moneda}
                                </div>

                                <div style={{ marginTop: 6, display: "flex", gap: 12, alignItems: "center" }}>
                                    <span style={{
                                        background: "#0A84FF",
                                        color: "white",
                                        padding: "3px 8px",
                                        borderRadius: "12px",
                                        fontSize: "12px",
                                        fontWeight: 500
                                    }}>
                                        {c.username}
                                    </span>
                                    <button
                                        onClick={() => startEdit(c)}
                                        style={localStyles.editBtn}
                                    >
                                        Edit
                                    </button>

                                    <button
                                        onClick={() => sterge(c)}
                                        style={styles.deleteBtn}
                                    >
                                        Șterge
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

//////////////////////////////////////////////////////
// STILURI LOCALE (doar specifice paginii)
//////////////////////////////////////////////////////

const localStyles = {
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
        height: "100%",
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
    }



};
