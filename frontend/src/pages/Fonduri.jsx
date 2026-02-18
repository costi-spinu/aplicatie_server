import { useEffect, useMemo, useState } from "react";
import api from "../services/api";
import styles from "../styles/iosStyles";

const RUBRICI = [
    { value: "fond_urgenta", label: "Fond de urgență" },
    { value: "trading212", label: "Investiții - Trading212" },
    { value: "xtb", label: "Investiții - XTB" },
    { value: "revolut", label: "Investiții - Revolut" },
    { value: "tradeville", label: "Investiții - Tradeville" },
    { value: "cont_economii", label: "Cont de economii" },
    { value: "alte_investitii", label: "Alte investiții" },
];

const getRubricaLabel = (value) => RUBRICI.find((r) => r.value === value)?.label || value;
const formatAmount = (value) => Number(value || 0).toFixed(2);

export default function Fonduri() {
    const [tip, setTip] = useState("adauga");
    const [rubrica, setRubrica] = useState("fond_urgenta");
    const [sumaEur, setSumaEur] = useState("");
    const [sumaRon, setSumaRon] = useState("");
    const [observatii, setObservatii] = useState("");
    const [msg, setMsg] = useState(null);
    const [editId, setEditId] = useState(null);

    const [miscari, setMiscari] = useState([]);
    const [totalEur, setTotalEur] = useState(0);
    const [totalRon, setTotalRon] = useState(0);

    const loadMiscari = async () => {
        try {
            const res = await api.get("fonduri/");
            setMiscari(res.data.miscari);
            setTotalEur(res.data.total_eur);
            setTotalRon(res.data.total_ron);
        } catch (err) {
            console.error("Eroare la încărcare fonduri:", err);
        }
    };

    useEffect(() => {
        loadMiscari();
    }, []);

    const resetForm = () => {
        setEditId(null);
        setTip("adauga");
        setRubrica("fond_urgenta");
        setSumaEur("");
        setSumaRon("");
        setObservatii("");
    };

    const submit = async (e) => {
        e.preventDefault();
        setMsg(null);

        const payload = { tip, rubrica };
        if (sumaEur) payload.suma_eur = Number(sumaEur);
        if (sumaRon) payload.suma_ron = Number(sumaRon);
        if (observatii) payload.observatii = observatii;

        if (!payload.suma_eur && !payload.suma_ron) {
            setMsg("Introdu o sumă în EUR sau RON");
            return;
        }

        try {
            if (editId) {
                await api.put(`fonduri/miscare/${editId}/`, payload);
                setMsg("✔ Mișcare actualizată");
            } else {
                await api.post("fonduri/miscare/", payload);
                setMsg("✔ Mișcare salvată");
            }

            resetForm();
            await loadMiscari();
        } catch (err) {
            setMsg("❌ Eroare la salvare");
        }
    };

    const startEdit = (miscare) => {
        setEditId(miscare.id);
        setTip(miscare.tip || "adauga");
        setRubrica(miscare.rubrica || "fond_urgenta");
        setSumaEur(miscare.suma_eur ? String(Math.abs(Number(miscare.suma_eur))) : "");
        setSumaRon(miscare.suma_ron ? String(Math.abs(Number(miscare.suma_ron))) : "");
        setObservatii(miscare.observatii || "");
        setMsg(null);
    };

    const stergeMiscare = async (id) => {
        if (!window.confirm("Sigur ștergi această mișcare?")) return;

        try {
            await api.delete(`fonduri/miscare/${id}/`);
            setMsg("✔ Mișcare ștearsă");
            if (editId === id) {
                resetForm();
            }
            await loadMiscari();
        } catch {
            setMsg("❌ Eroare la ștergere");
        }
    };

    const totaluriPeRubrica = useMemo(() => {
        const initial = RUBRICI.reduce((acc, rub) => {
            acc[rub.value] = { eur: 0, ron: 0 };
            return acc;
        }, {});

        miscari.forEach((m) => {
            const key = m.rubrica || "alte_investitii";
            if (!initial[key]) {
                initial[key] = { eur: 0, ron: 0 };
            }
            initial[key].eur += Number(m.suma_eur || 0);
            initial[key].ron += Number(m.suma_ron || 0);
        });

        return initial;
    }, [miscari]);

    const rubriciRetragere = RUBRICI.filter((r) => {
        const total = totaluriPeRubrica[r.value];
        return (total?.eur || 0) > 0 || (total?.ron || 0) > 0;
    });

    useEffect(() => {
        if (tip !== "retrage") return;

        if (!rubriciRetragere.some((r) => r.value === rubrica)) {
            setRubrica(rubriciRetragere[0]?.value || "fond_urgenta");
        }
    }, [tip, rubrica, rubriciRetragere]);

    return (
        <div style={styles.container}>
            <div style={styles.card}>
                <h2 style={styles.title}>💼 Fonduri</h2>

                <div style={localStyles.heroGrid}>
                    <div style={localStyles.heroGreen}>
                        <div style={localStyles.heroLabel}>Total EUR</div>
                        <div style={localStyles.heroValue}>{formatAmount(totalEur)}</div>
                    </div>

                    <div style={localStyles.heroBlue}>
                        <div style={localStyles.heroLabel}>Total RON</div>
                        <div style={localStyles.heroValue}>{formatAmount(totalRon)}</div>
                    </div>
                </div>

                {msg && <div style={styles.message}>{msg}</div>}

                <form onSubmit={submit} style={{ marginTop: 30 }}>
                    <select
                        style={styles.input}
                        value={tip}
                        onChange={(e) => setTip(e.target.value)}
                    >
                        <option value="adauga">Adaugă</option>
                        <option value="retrage">Retrage</option>
                    </select>

                    <select
                        style={styles.input}
                        value={rubrica}
                        onChange={(e) => setRubrica(e.target.value)}
                    >
                        {(tip === "retrage" ? rubriciRetragere : RUBRICI).map((r) => (
                            <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                    </select>

                    {tip === "retrage" && rubriciRetragere.length === 0 && (
                        <div style={styles.message}>Nu ai fonduri disponibile pentru retragere.</div>
                    )}

                    <input
                        style={styles.input}
                        type="number"
                        placeholder="Sumă EUR"
                        value={sumaEur}
                        onChange={(e) => {
                            setSumaEur(e.target.value);
                            setSumaRon("");
                        }}
                    />

                    <input
                        style={styles.input}
                        type="number"
                        placeholder="Sumă RON"
                        value={sumaRon}
                        onChange={(e) => {
                            setSumaRon(e.target.value);
                            setSumaEur("");
                        }}
                    />

                    <textarea
                        style={styles.input}
                        placeholder="Observații"
                        value={observatii}
                        onChange={(e) => setObservatii(e.target.value)}
                    />

                    <div style={{ display: "flex", gap: 10 }}>
                        <button style={styles.blueButton}>
                            {editId ? "💾 Salvează modificările" : "💾 Salvează"}
                        </button>
                        {editId && (
                            <button
                                type="button"
                                style={localStyles.cancelBtn}
                                onClick={resetForm}
                            >
                                Anulează editarea
                            </button>
                        )}
                    </div>
                </form>

                <h3 style={localStyles.subtitle}>📊 Total pe rubrici</h3>
                <div style={localStyles.tableWrap}>
                    <table style={localStyles.table}>
                        <thead>
                            <tr>
                                <th style={localStyles.th}>Rubrică</th>
                                <th style={localStyles.th}>Total EUR</th>
                                <th style={localStyles.th}>Total RON</th>
                            </tr>
                        </thead>
                        <tbody>
                            {RUBRICI.map((r) => {
                                const total = totaluriPeRubrica[r.value] || { eur: 0, ron: 0 };
                                return (
                                    <tr key={r.value}>
                                        <td style={localStyles.td}>{r.label}</td>
                                        <td style={localStyles.td}>{formatAmount(total.eur)}</td>
                                        <td style={localStyles.td}>{formatAmount(total.ron)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                <h3 style={localStyles.subtitle}>💰 Fonduri investite</h3>

                {miscari.length === 0 && (
                    <div style={localStyles.empty}>
                        Nu există încă mișcări de fonduri
                    </div>
                )}

                {miscari.length > 0 && (
                    <div style={localStyles.list}>
                        {miscari.map((m, index) => (
                            <div
                                key={m.id}
                                style={{
                                    ...styles.row,
                                    borderBottom:
                                        index !== miscari.length - 1
                                            ? "1px solid #F0F0F5"
                                            : "none",
                                }}
                            >
                                <div>
                                    <div style={localStyles.itemTitle}>
                                        👤 {m.username}
                                    </div>
                                    <div style={localStyles.itemDate}>{m.data}</div>
                                    <div style={localStyles.itemObs}>Rubrică: {getRubricaLabel(m.rubrica)}</div>
                                    {m.observatii && (
                                        <div style={localStyles.itemObs}>{m.observatii}</div>
                                    )}
                                </div>

                                <div style={{ textAlign: "right" }}>
                                    <div style={localStyles.amountGreen}>
                                        {formatAmount(m.suma_eur)} EUR
                                    </div>
                                    <div style={localStyles.amountBlue}>
                                        {formatAmount(m.suma_ron)} RON
                                    </div>
                                    <div style={{ marginTop: 6, display: "flex", gap: 10, justifyContent: "flex-end" }}>
                                        <button type="button" style={localStyles.editBtn} onClick={() => startEdit(m)}>Edit</button>
                                        <button type="button" style={styles.deleteBtn} onClick={() => stergeMiscare(m.id)}>Șterge</button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

const localStyles = {
    heroGrid: {
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "20px",
        marginBottom: "20px",
    },
    heroGreen: {
        background: "linear-gradient(135deg, #34C759, #30D158)",
        color: "white",
        borderRadius: "20px",
        padding: "20px",
        textAlign: "center",
    },
    heroBlue: {
        background: "linear-gradient(135deg, #0A84FF, #5E5CE6)",
        color: "white",
        borderRadius: "20px",
        padding: "20px",
        textAlign: "center",
    },
    heroLabel: {
        fontSize: "14px",
        opacity: 0.9,
    },
    heroValue: {
        fontSize: "28px",
        fontWeight: "700",
        marginTop: "8px",
    },
    subtitle: {
        marginTop: "40px",
        marginBottom: "20px",
        fontWeight: "600",
        fontSize: "18px",
    },
    tableWrap: {
        overflowX: "auto",
        border: "1px solid #E5E5EA",
        borderRadius: 12,
        background: "#fff",
    },
    table: {
        width: "100%",
        borderCollapse: "collapse",
    },
    th: {
        textAlign: "left",
        padding: "10px 12px",
        borderBottom: "1px solid #E5E5EA",
        fontSize: 13,
        color: "#636366",
    },
    td: {
        padding: "10px 12px",
        borderBottom: "1px solid #F2F2F7",
        fontSize: 14,
    },
    list: {
        background: "#FFFFFF",
        borderRadius: "20px",
        overflow: "hidden",
    },
    itemTitle: {
        fontWeight: "600",
        fontSize: "15px",
    },
    itemDate: {
        fontSize: "13px",
        color: "#8E8E93",
    },
    itemObs: {
        fontSize: "13px",
        color: "#636366",
        marginTop: "4px",
    },
    amountGreen: {
        fontWeight: "600",
        color: "#34C759",
    },
    amountBlue: {
        fontWeight: "600",
        color: "#0A84FF",
        marginTop: "4px",
    },
    empty: {
        textAlign: "center",
        color: "#8E8E93",
        padding: "20px",
    },
    editBtn: {
        background: "none",
        border: "none",
        color: "#0A84FF",
        cursor: "pointer",
    },
    cancelBtn: {
        background: "transparent",
        border: "none",
        color: "#8E8E93",
        fontWeight: "500",
        cursor: "pointer",
    },
};
