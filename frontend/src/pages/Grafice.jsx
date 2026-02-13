import { useEffect, useState } from "react";
import api from "../services/api";
import styles from "../styles/iosStyles";

import {
    Chart as ChartJS,
    ArcElement,
    Tooltip,
    Legend,
    CategoryScale,
    LinearScale,
    BarElement,
} from "chart.js";
import { Pie, Bar } from "react-chartjs-2";

ChartJS.register(
    ArcElement,
    Tooltip,
    Legend,
    CategoryScale,
    LinearScale,
    BarElement
);

// =========================
// LUNA FINANCIARĂ 26 → 25
// =========================
function getIntervalLunaFinanciara(dateStr) {
    const d = new Date(dateStr);
    let start, end;

    if (d.getDate() >= 26) {
        start = new Date(d.getFullYear(), d.getMonth(), 26);
        end = new Date(d.getFullYear(), d.getMonth() + 1, 25, 23, 59, 59);
    } else {
        start = new Date(d.getFullYear(), d.getMonth() - 1, 26);
        end = new Date(d.getFullYear(), d.getMonth(), 25, 23, 59, 59);
    }

    return { start, end };
}

function inInterval(data, interval) {
    const d = new Date(data);
    return d >= interval.start && d <= interval.end;
}

function getLunaFinanciara(dateStr) {
    const d = new Date(dateStr + "T12:00:00");
    const zi = d.getDate();
    let luna = d.getMonth();
    let an = d.getFullYear();

    if (zi >= 26) luna += 1;
    if (luna === 12) {
        luna = 0;
        an += 1;
    }

    return `${an}-${String(luna + 1).padStart(2, "0")}`;
}

export default function Grafice() {
    const [venituri, setVenituri] = useState([]);
    const [fixe, setFixe] = useState([]);
    const [variabile, setVariabile] = useState([]);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const v = await api.get("venituri/");
        const f = await api.get("cheltuieli-fixe/");
        const va = await api.get("cheltuieli-variabile/");
        setVenituri(v.data);
        setFixe(f.data);
        setVariabile(va.data);
    };

    const lunaCurenta = getLunaFinanciara(
        new Date().toISOString().split("T")[0]
    );

    const intervalCurent = getIntervalLunaFinanciara(
        new Date().toISOString().split("T")[0]
    );

    const cheltuieliLunaCurenta = [...fixe, ...variabile].filter(c =>
        inInterval(c.data, intervalCurent)
    );

    const investitiiLunaCurenta = cheltuieliLunaCurenta
        .filter(c => c.categorie === "investitii")
        .reduce((s, c) => s + Number(c.suma), 0);

    const cheltuieliFaraInvestitii = cheltuieliLunaCurenta
        .filter(c => c.categorie !== "investitii")
        .reduce((s, c) => s + Number(c.suma), 0);

    const venitTotal = venituri
        .filter(v => inInterval(v.data, intervalCurent))
        .reduce((s, v) => s + Number(v.suma), 0);

    const economii =
        venitTotal - cheltuieliFaraInvestitii - investitiiLunaCurenta;

    // =========================
    // ISTORIC
    // =========================

    const istoric = {};

    [...venituri, ...fixe, ...variabile].forEach(item => {
        const luna = getLunaFinanciara(item.data);
        if (!istoric[luna]) {
            istoric[luna] = {
                venit: 0,
                fixe: 0,
                variabile: 0,
                investitii: 0,
                economii: 0,
                procente: {},
            };
        }
    });

    venituri.forEach(v => {
        const luna = getLunaFinanciara(v.data);
        istoric[luna].venit += Number(v.suma);
    });

    fixe.forEach(c => {
        const luna = getLunaFinanciara(c.data);
        istoric[luna].fixe += Number(c.suma);
    });

    variabile.forEach(c => {
        const luna = getLunaFinanciara(c.data);
        if (c.categorie === "investitii") {
            istoric[luna].investitii += Number(c.suma);
        } else {
            istoric[luna].variabile += Number(c.suma);
        }
    });

    Object.values(istoric).forEach(l => {
        const total = l.fixe + l.variabile + l.investitii;
        l.economii = l.venit - total;

        l.procente = {
            fixe: (l.fixe / l.venit) * 100 || 0,
            variabile: (l.variabile / l.venit) * 100 || 0,
            investitii: (l.investitii / l.venit) * 100 || 0,
            economii: (l.economii / l.venit) * 100 || 0,
        };
    });

    const pieData = {
        labels: ["Cheltuieli", "Investiții", "Economii"],
        datasets: [
            {
                data: [
                    cheltuieliFaraInvestitii,
                    investitiiLunaCurenta,
                    economii
                ],
                backgroundColor: [
                    "#FF3B30",
                    "#AF52DE",
                    "#34C759",
                ],
            },
        ],
    };

    const barData = {
        labels: ["Venit", "Cheltuieli", "Investiții", "Economii"],
        datasets: [
            {
                data: [
                    venitTotal,
                    cheltuieliFaraInvestitii,
                    investitiiLunaCurenta,
                    economii
                ],
                backgroundColor: [
                    "#34C759",
                    "#FF3B30",
                    "#AF52DE",
                    economii >= 0 ? "#0A84FF" : "#991B1B",
                ],
            },
        ],
    };

    return (
        <div style={styles.container}>
            <div style={styles.card}>
                <h2 style={styles.title}>
                    📊 Buget – luna {lunaCurenta}
                </h2>

                <h3 style={{ marginTop: 30, fontWeight: 600 }}>
                    📈 Grafice – luna curentă
                </h3>

                <div style={localStyles.graphRow}>
                    <div style={localStyles.pieBox}>
                        <Pie data={pieData} />
                    </div>
                </div>

                <div style={localStyles.barBox}>
                    <Bar data={barData} />
                </div>

                <h3 style={{ marginTop: 40, fontWeight: 600 }}>
                    📅 Istoric lunar
                </h3>

                {Object.entries(istoric)
                    .sort(([a], [b]) => b.localeCompare(a))
                    .map(([luna, l]) => (
                        <div key={luna} style={localStyles.monthCard}>
                            <div style={{ fontWeight: 700, marginBottom: 15 }}>
                                {luna}
                            </div>

                            <div style={styles.row}>
                                <span>💰 Venit</span>
                                <strong>{l.venit} €</strong>
                            </div>

                            <div style={styles.row}>
                                <span>🏠 Fixe</span>
                                <span>{l.fixe} € ({l.procente.fixe.toFixed(1)}%)</span>
                            </div>

                            <div style={styles.row}>
                                <span>🛍 Variabile</span>
                                <span>{l.variabile} € ({l.procente.variabile.toFixed(1)}%)</span>
                            </div>

                            <div style={styles.row}>
                                <span>📈 Investiții</span>
                                <span>{l.investitii} € ({l.procente.investitii.toFixed(1)}%)</span>
                            </div>

                            <div style={localStyles.separator} />

                            <div style={styles.row}>
                                <span>💾 Economii</span>
                                <strong style={{
                                    color: l.economii >= 0
                                        ? "#34C759"
                                        : "#FF3B30"
                                }}>
                                    {l.economii} € ({l.procente.economii.toFixed(1)}%)
                                </strong>
                            </div>
                        </div>
                    ))}
            </div>
        </div>
    );
}

//////////////////////////////////////////////////////
// STILURI LOCALE (doar pentru grafice)
//////////////////////////////////////////////////////

const localStyles = {
    monthCard: {
        background: "#F9F9FB",
        borderRadius: "20px",
        padding: "20px",
        marginBottom: "20px",
    },
    separator: {
        height: "1px",
        background: "#E5E5EA",
        margin: "12px 0",
    },
    graphRow: {
        display: "flex",
        justifyContent: "center",
        marginBottom: "40px",
    },
    pieBox: {
        width: "320px",
        height: "320px",
    },
    barBox: {
        width: "100%",
        height: "260px",
    },
};
