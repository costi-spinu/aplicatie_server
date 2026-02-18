import { useEffect, useMemo, useState } from "react";
import api from "../services/api";
import styles from "../styles/iosStyles";

const RON_TO_EUR_FALLBACK = 0.2;

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
    const date = new Date(value);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

const round2 = (value) => Math.round(value * 100) / 100;

export default function Venit() {
    const [activeTab, setActiveTab] = useState("form");

    const [suma, setSuma] = useState("");
    const [currentUser, setCurrentUser] = useState(null);
    const [moneda, setMoneda] = useState("EUR");
    const [data, setData] = useState(new Date().toISOString().split("T")[0]);

    const [venituri, setVenituri] = useState([]);
    const [total, setTotal] = useState(0);

    const [editId, setEditId] = useState(null);
    const [msg, setMsg] = useState(null);

    const [ronToEurRate, setRonToEurRate] = useState(RON_TO_EUR_FALLBACK);
    const [rateSource, setRateSource] = useState("fallback");

    const [statusRows, setStatusRows] = useState([]);

    const cycleRange = useMemo(() => getCurrentCycleRange(), []);

    const formatDateTime = (dt) => new Date(dt).toLocaleString("ro-RO");
    const formatDate = (dateObj) => dateObj.toLocaleDateString("ro-RO");

    const fetchExchangeRate = async () => {
        try {
            const response = await fetch("https://api.frankfurter.app/latest?from=RON&to=EUR");
            if (!response.ok) throw new Error("Nu s-a putut prelua cursul valutar");

            const dataRes = await response.json();
            const rate = Number(dataRes?.rates?.EUR);
            if (!rate || Number.isNaN(rate)) throw new Error("Curs valutar invalid");

            setRonToEurRate(rate);
            setRateSource("live");
        } catch (error) {
            console.warn("Curs valutar indisponibil, folosesc fallback:", error);
            setRonToEurRate(RON_TO_EUR_FALLBACK);
            setRateSource("fallback");
        }
    };

    const convertToEur = (amount, currency) => {
        if (currency === "EUR") return Number(amount);
        return Number(amount) * ronToEurRate;
    };

    const calculateCurrentCycleTotal = (items) => {
        const totalCycle = items
            .filter((item) => {
                const incomeDate = toDateOnly(item.data);
                return incomeDate >= cycleRange.start && incomeDate <= cycleRange.end;
            })
            .reduce((sum, item) => sum + convertToEur(item.suma, item.moneda), 0);

        return round2(totalCycle);
    };

    const loadData = async () => {
        try {
            const [list, meRes] = await Promise.all([api.get("venituri/"), api.get("me/")]);
            setVenituri(list.data);
            setTotal(calculateCurrentCycleTotal(list.data));
            setCurrentUser(meRes.data);
        } catch (err) {
            console.error("Eroare venit:", err);
        }
    };

    const loadStatusData = async () => {
        try {
            const res = await api.get("venit/status/");
            const labels = [...res.data.labels].reverse();
            const dataValues = [...res.data.data].reverse();
            setStatusRows(labels.map((label, idx) => ({ label, value: Number(dataValues[idx]) })));
        } catch (error) {
            console.error("Eroare status venit:", error);
        }
    };

    useEffect(() => {
        fetchExchangeRate();
        loadStatusData();
    }, []);

    useEffect(() => {
        loadData();
    }, [ronToEurRate]);

    const resetForm = () => {
        setSuma("");
        setMoneda("EUR");
        setData(new Date().toISOString().split("T")[0]);
        setEditId(null);
    };

    const adaugaVenit = async () => {
        if (!suma) return;

        try {
            const sumaInEur = round2(convertToEur(suma, moneda));
            await api.post("venituri/", { suma: sumaInEur, moneda: "EUR", data });

            setMsg(moneda === "RON"
                ? `✔ Venit adăugat (${suma} RON ≈ ${sumaInEur} EUR)`
                : "✔ Venit adăugat");

            resetForm();
            loadData();
            loadStatusData();
        } catch {
            setMsg("❌ Eroare la adăugare");
        }
    };

    const salveazaEdit = async () => {
        if (!suma) return;

        try {
            const sumaInEur = round2(convertToEur(suma, moneda));
            await api.put(`venituri/${editId}/`, { suma: sumaInEur, moneda: "EUR", data });

            setMsg(moneda === "RON"
                ? `✔ Venit modificat (${suma} RON ≈ ${sumaInEur} EUR)`
                : "✔ Venit modificat");

            resetForm();
            loadData();
            loadStatusData();
        } catch {
            setMsg("❌ Eroare la modificare");
        }
    };

    const stergeVenit = async (id) => {
        if (!window.confirm("Sigur ștergi acest venit?")) return;

        try {
            await api.delete(`venituri/${id}/`);
            loadData();
            loadStatusData();
        } catch {
            setMsg("❌ Eroare la ștergere");
        }
    };

    const previewEur = suma && moneda === "RON"
        ? `≈ ${round2(Number(suma) * ronToEurRate)} EUR`
        : null;

    const totalGeneralStatus = statusRows.reduce((acc, row) => acc + row.value, 0);

    return (
        <div style={styles.container}>
            <h2 style={styles.title}>💰 Venit</h2>

            <div style={localStyles.segmentWrapper}>
                <div style={{ ...localStyles.segmentSlider, left: activeTab === "form" ? "4px" : "50%" }} />
                <button style={localStyles.segmentBtn} onClick={() => setActiveTab("form")}>Gestionare venit</button>
                <button style={localStyles.segmentBtn} onClick={() => setActiveTab("history")}>Istoric venit</button>
            </div>

            {activeTab === "form" && (
                <>
                    <div style={styles.heroCard}>
                        <div style={styles.heroLabel}>
                            Total pe interval curent ({formatDate(cycleRange.start)} - {formatDate(cycleRange.end)})
                        </div>
                        <div style={styles.heroValue}>{total} EUR</div>
                        <div style={{ marginTop: 8, fontSize: 12, opacity: 0.85 }}>
                            Curs RON→EUR: {ronToEurRate} ({rateSource === "live" ? "live" : "fallback"})
                        </div>
                    </div>

                    {msg && <div style={styles.message}>{msg}</div>}

                    <div style={styles.card}>
                        <h3 style={styles.sectionTitle}>{editId ? "✏️ Modifică venit" : "➕ Adaugă venit"}</h3>

                        <input style={styles.input} type="number" placeholder="Sumă" value={suma} onChange={(e) => setSuma(e.target.value)} />

                        <select style={styles.input} value={moneda} onChange={(e) => setMoneda(e.target.value)}>
                            <option value="EUR">EUR</option>
                            <option value="RON">RON</option>
                        </select>

                        {previewEur && <div style={{ marginBottom: 12, fontSize: 13, color: "#636366" }}>Conversie automată: {previewEur}</div>}

                        <input style={styles.input} type="date" value={data} onChange={(e) => setData(e.target.value)} />

                        {editId
                            ? <button style={styles.greenButton} onClick={salveazaEdit}>💾 Salvează modificarea</button>
                            : <button style={styles.blueButton} onClick={adaugaVenit}>➕ Adaugă venit</button>}
                    </div>

                    {editId && (
                        <div style={styles.selectedCard}>
                            <div style={styles.selectedLabel}>Venit selectat pentru modificare</div>
                            <div style={styles.selectedValue}>{suma} {moneda} – {data}</div>
                        </div>
                    )}

                    <div style={styles.card}>
                        <h3 style={styles.sectionTitle}>Istoric înregistrări</h3>
                        {venituri.map((v) => (
                            <div
                                key={v.id}
                                style={{ ...styles.row, ...(editId === v.id ? styles.activeRow : {}) }}
                                onClick={() => { setEditId(v.id); setSuma(v.suma); setMoneda(v.moneda); setData(v.data); }}
                            >
                                <div>
                                    <div style={styles.amount}>{v.suma} {v.moneda}</div>
                                    <div style={{ fontSize: 12, opacity: 0.7 }}>👤 {v.username || currentUser?.username}</div>
                                    <div style={styles.date}>{v.data}</div>
                                    {v.updated_at && <div style={styles.updated}>ultima modificare: {formatDateTime(v.updated_at)}</div>}
                                </div>
                                <button
                                    style={styles.deleteBtn}
                                    onClick={(e) => { e.stopPropagation(); stergeVenit(v.id); }}
                                >🗑</button>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {activeTab === "history" && (
                <div style={styles.card}>
                    <h3 style={styles.sectionTitle}>📋 Istoric venit</h3>

                    <div style={localStyles.tableWrapper}>
                        <table style={localStyles.table}>
                            <thead>
                                <tr>
                                    <th style={localStyles.th}>Luna</th>
                                    <th style={{ ...localStyles.th, textAlign: "right" }}>Venit (EUR)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {statusRows.map((row, idx) => (
                                    <tr key={row.label} style={idx % 2 === 0 ? localStyles.rowEven : localStyles.rowOdd}>
                                        <td style={localStyles.td}>{row.label}</td>
                                        <td style={{ ...localStyles.td, textAlign: "right", fontWeight: 600, color: "#1C1C1E" }}>
                                            {row.value.toLocaleString("ro-RO")} EUR
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td style={localStyles.totalCell}>TOTAL GENERAL</td>
                                    <td style={{ ...localStyles.totalCell, textAlign: "right", color: "#34C759" }}>
                                        {totalGeneralStatus.toLocaleString("ro-RO")} EUR
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}

const localStyles = {
    segmentWrapper: {
        position: "relative",
        width: "100%",
        maxWidth: "520px",
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        background: "#E9E9EE",
        borderRadius: "14px",
        padding: "4px",
        marginBottom: "18px",
    },
    segmentSlider: {
        position: "absolute",
        top: "4px",
        bottom: "4px",
        width: "calc(50% - 4px)",
        background: "white",
        borderRadius: "10px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        transition: "left 0.2s ease",
        zIndex: 0,
    },
    segmentBtn: {
        position: "relative",
        zIndex: 1,
        border: "none",
        background: "transparent",
        padding: "10px",
        borderRadius: "10px",
        fontWeight: "600",
        fontSize: "14px",
        color: "#1C1C1E",
        cursor: "pointer",
    },
    tableWrapper: {
        marginTop: "6px",
        border: "1px solid #E5E5EA",
        borderRadius: "14px",
        overflow: "hidden",
        background: "#fff",
    },
    table: {
        width: "100%",
        borderCollapse: "collapse",
        fontSize: "14px",
    },
    th: {
        background: "#F6F6FA",
        color: "#3A3A3C",
        fontWeight: "700",
        padding: "12px 14px",
        borderBottom: "1px solid #E5E5EA",
    },
    td: {
        padding: "11px 14px",
        borderBottom: "1px solid #F0F0F5",
    },
    rowEven: { background: "#FFFFFF" },
    rowOdd: { background: "#FAFAFD" },
    totalCell: {
        padding: "12px 14px",
        fontWeight: "700",
        background: "#F6FFF8",
    },
};
