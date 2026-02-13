import { useEffect, useState } from "react";
import api from "../services/api";
import styles from "../styles/iosStyles";

import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Tooltip,
    Legend,
} from "chart.js";

import { Line } from "react-chartjs-2";

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Tooltip,
    Legend
);

const COLORS = {
    EUR: "#0A84FF",
    RON: "#34C759",
};

export default function GraficeFonduri() {
    const [totalData, setTotalData] = useState(null);
    const [perUserData, setPerUserData] = useState({});
    const [soldFinal, setSoldFinal] = useState({ EUR: 0, RON: 0 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get("fonduri/grafic/timeline/extended/")
            .then((res) => {

                const buildDatasets = (data) =>
                    data.datasets.map((d) => ({
                        ...d,
                        borderColor: COLORS[d.label],
                        backgroundColor: COLORS[d.label],
                        borderWidth: 3,
                        tension: 0.4,
                        pointRadius: 4,
                        fill: false,
                    }));

                // TOTAL
                const total = {
                    labels: res.data.total.labels,
                    datasets: buildDatasets(res.data.total),
                };

                setTotalData(total);

                // Sold final total
                const finalSold = {};
                res.data.total.datasets.forEach((d) => {
                    finalSold[d.label] =
                        d.data[d.data.length - 1] ?? 0;
                });
                setSoldFinal(finalSold);

                // PER USER
                const users = {};
                Object.entries(res.data.per_user).forEach(([username, data]) => {
                    users[username] = {
                        labels: data.labels,
                        datasets: buildDatasets(data),
                    };
                });

                setPerUserData(users);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    const lineOptions = {
        responsive: true,
        interaction: {
            mode: "index",
            intersect: false,
        },
        plugins: {
            legend: {
                position: "bottom",
                labels: {
                    usePointStyle: true,
                    padding: 20,
                    font: {
                        size: 13,
                        weight: "600",
                    },
                },
            },
            tooltip: {
                backgroundColor: "#1C1C1E",
                padding: 12,
                cornerRadius: 12,
                callbacks: {
                    label: (ctx) => {
                        const value = ctx.parsed.y;
                        const moneda = ctx.dataset.label;
                        const sign = value >= 0 ? "+" : "−";
                        return `${moneda}: ${sign}${Math.abs(value).toLocaleString()}`;
                    },
                },
            },
        },
        scales: {
            x: {
                grid: { display: false },
            },
            y: {
                grid: { color: "rgba(0,0,0,0.05)" },
                ticks: {
                    callback: (v) => v.toLocaleString(),
                },
            },
        },
    };

    return (
        <div style={styles.container}>
            <div style={styles.card}>
                <h2 style={styles.title}>
                    📈 Evoluție investiții
                </h2>

                {loading && (
                    <div style={localStyles.loading}>
                        ⏳ Se încarcă graficele…
                    </div>
                )}

                {!loading && (
                    <>
                        {/* TOTAL */}
                        <h3 style={{ marginTop: 30 }}>
                            💼 Total investiții
                        </h3>

                        {totalData && (
                            <Line data={totalData} options={lineOptions} />
                        )}

                        {/* HERO SOLD FINAL TOTAL */}
                        <div style={localStyles.heroGrid}>
                            <div style={localStyles.heroBlue}>
                                <div style={localStyles.heroLabel}>
                                    Sold total EUR
                                </div>
                                <div style={localStyles.heroValue}>
                                    {soldFinal.EUR?.toLocaleString()}
                                </div>
                            </div>

                            <div style={localStyles.heroGreen}>
                                <div style={localStyles.heroLabel}>
                                    Sold total RON
                                </div>
                                <div style={localStyles.heroValue}>
                                    {soldFinal.RON?.toLocaleString()}
                                </div>
                            </div>
                        </div>

                        {/* PER USER */}
                        {Object.entries(perUserData).map(([username, data]) => (
                            <div key={username} style={{ marginTop: 60 }}>
                                <h3>👤 {username}</h3>
                                <Line data={data} options={lineOptions} />
                            </div>
                        ))}
                    </>
                )}
            </div>
        </div>
    );
}

//////////////////////////////////////////////////////
// STILURI LOCALE
//////////////////////////////////////////////////////

const localStyles = {
    heroGrid: {
        marginTop: "40px",
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "20px",
    },
    heroBlue: {
        background: "linear-gradient(135deg, #0A84FF, #5E5CE6)",
        color: "white",
        borderRadius: "20px",
        padding: "20px",
        textAlign: "center",
    },
    heroGreen: {
        background: "linear-gradient(135deg, #34C759, #30D158)",
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
    loading: {
        textAlign: "center",
        padding: "40px",
        fontSize: "18px",
    },
};
