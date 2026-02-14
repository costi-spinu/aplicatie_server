import { useState, useEffect } from "react";
import api from "../services/api";
import styles from "../styles/iosStyles";

export default function Fonduri() {
    const [tip, setTip] = useState("adauga");
    const [sumaEur, setSumaEur] = useState("");
    const [sumaRon, setSumaRon] = useState("");
    const [observatii, setObservatii] = useState("");
    const [msg, setMsg] = useState(null);

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

    const submit = async (e) => {
        e.preventDefault();
        setMsg(null);

        const payload = { tip };
        if (sumaEur) payload.suma_eur = Number(sumaEur);
        if (sumaRon) payload.suma_ron = Number(sumaRon);
        if (observatii) payload.observatii = observatii;

        if (!payload.suma_eur && !payload.suma_ron) {
            setMsg("Introdu o sumă în EUR sau RON");
            return;
        }

        try {
            await api.post("fonduri/miscare/", payload);

            setMsg("✔ Mișcare salvată");
            setSumaEur("");
            setSumaRon("");
            setObservatii("");

            await loadMiscari();
        } catch (err) {
            setMsg("❌ Eroare la salvare");
        }
    };

    return (
        <div style={styles.container}>
            <div style={styles.card}>
                <h2 style={styles.title}>💼 Fonduri</h2>

                {/* TOTALURI */}
                <div style={localStyles.heroGrid}>
                    <div style={localStyles.heroGreen}>
                        <div style={localStyles.heroLabel}>Total EUR</div>
                        <div style={localStyles.heroValue}>{totalEur}</div>
                    </div>

                    <div style={localStyles.heroBlue}>
                        <div style={localStyles.heroLabel}>Total RON</div>
                        <div style={localStyles.heroValue}>{totalRon}</div>
                    </div>
                </div>

                {msg && <div style={styles.message}>{msg}</div>}

                {/* FORM */}
                <form onSubmit={submit} style={{ marginTop: 30 }}>
                    <select
                        style={styles.input}
                        value={tip}
                        onChange={(e) => setTip(e.target.value)}
                    >
                        <option value="adauga">Adaugă</option>
                        <option value="retrage">Retrage</option>
                    </select>

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

                    <button style={styles.blueButton}>
                        💾 Salvează
                    </button>
                </form>

                {/* ISTORIC */}
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

                                    <div style={localStyles.itemDate}>
                                        {m.data}
                                    </div>

                                    {m.observatii && (
                                        <div style={localStyles.itemObs}>
                                            {m.observatii}
                                        </div>
                                    )}
                                </div>

                                <div style={{ textAlign: "right" }}>
                                    <div style={localStyles.amountGreen}>
                                        {m.suma_eur ?? "-"} EUR
                                    </div>
                                    <div style={localStyles.amountBlue}>
                                        {m.suma_ron ?? "-"} RON
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

//////////////////////////////////////////////////////
// STILURI LOCALE (doar ce nu există în global)
//////////////////////////////////////////////////////

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
};
