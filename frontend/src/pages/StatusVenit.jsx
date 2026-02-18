import { useEffect, useState } from "react";
import api from "../services/api";
import { Line } from "react-chartjs-2";
import styles from "../styles/iosStyles";

import {
    Chart as ChartJS,
    LineElement,
    PointElement,
    CategoryScale,
    LinearScale,
    Tooltip,
    Legend,
} from "chart.js";

import ChartDataLabels from "chartjs-plugin-datalabels";

ChartJS.register(
    LineElement,
    PointElement,
    CategoryScale,
    LinearScale,
    Tooltip,
    Legend,
    ChartDataLabels
);

//////////////////////////////////////////////////////
// STATUS VENIT LUNAR
//////////////////////////////////////////////////////

export default function StatusVenit() {
    const [chartData, setChartData] = useState(null);

    useEffect(() => {
        api.get("venit/status/").then(res => {
            const labels = [...res.data.labels].reverse();
            const data = [...res.data.data].reverse();

            setChartData({
                labels,
                datasets: [
                    {
                        label: "Venit lunar (EUR)",
                        data,
                        borderWidth: 3,
                        tension: 0.4,
                        pointHoverRadius: 8,
                        fill: true,
                        borderColor: "#34C759",
                        backgroundColor: (context) => {
                            const ctx = context.chart.ctx;
                            const gradient = ctx.createLinearGradient(0, 0, 0, 300);
                            gradient.addColorStop(0, "rgba(52,199,89,0.35)");
                            gradient.addColorStop(1, "rgba(52,199,89,0.02)");
                            return gradient;
                        },
                        pointBackgroundColor: "#34C759",
                        pointRadius: 5,
                    },
                ],
            });
        });
    }, []);

    const options = {
        responsive: true,
        interaction: { mode: "index", intersect: false },
        animation: {
            duration: 1200,
            easing: "easeOutQuart",
        },
        plugins: {
            legend: {
                position: "bottom",
                labels: {
                    usePointStyle: true,
                    padding: 20,
                    font: { size: 13, weight: "600" },
                },
            },
            datalabels: {
                anchor: "end",
                align: "top",
                formatter: (value) =>
                    `${value.toLocaleString("ro-RO")} €`,
                font: { weight: "600" },
                color: "#34C759",
            },
            tooltip: {
                backgroundColor: "#1C1C1E",
                padding: 12,
                cornerRadius: 12,
                callbacks: {
                    label: (ctx) =>
                        `${ctx.parsed.y.toLocaleString("ro-RO")} EUR`,
                },
            },
        },
        scales: {
            x: { grid: { display: false } },
            y: {
                grid: { color: "rgba(0,0,0,0.05)" },
                ticks: {
                    callback: (v) => v.toLocaleString("ro-RO"),
                },
            },
        },
    };

    return (
        <div style={styles.container}>
            <div style={styles.card}>
                <h2 style={styles.title}>📈 Status Venit Lunar</h2>

                {!chartData ? (
                    <div style={styles.message}>⏳ Se încarcă...</div>
                ) : (
                    <>
                        <Line data={chartData} options={options} />

                        <div style={{ marginTop: 30 }}>
                            {chartData.labels.map((l, i) => (
                                <div key={l} style={styles.row}>
                                    <span>{l}</span>
                                    <span style={localStyles.greenText}>
                                        {chartData.datasets[0].data[i].toLocaleString("ro-RO")} EUR
                                    </span>
                                </div>
                            ))}

                            <div style={{ ...styles.row, marginTop: 10 }}>
                                <strong>TOTAL GENERAL</strong>
                                <strong style={localStyles.greenText}>
                                    {chartData.datasets[0].data
                                        .reduce((a, b) => a + b, 0)
                                        .toLocaleString("ro-RO")} EUR
                                </strong>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

//////////////////////////////////////////////////////
// TIMELINE EVOLUȚIE SOLD
//////////////////////////////////////////////////////

export function StatusVenitTimeline() {
    const [timelineData, setTimelineData] = useState(null);
    const [soldFinal, setSoldFinal] = useState({});

    useEffect(() => {
        api.get("venit/status/timeline/").then((res) => {
            const labels = [...res.data.labels].reverse();

            const datasets = res.data.datasets.map((d) => ({
                label: d.label,
                data: [...d.data].reverse(),
                borderWidth: 3,
                tension: 0.4,
                pointRadius: 4,
                fill: true,
                borderColor: "#0A84FF",
                backgroundColor: (context) => {
                    const ctx = context.chart.ctx;
                    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
                    gradient.addColorStop(0, "rgba(10,132,255,0.35)");
                    gradient.addColorStop(1, "rgba(10,132,255,0.02)");
                    return gradient;
                },
            }));

            setTimelineData({ labels, datasets });

            const sold = {};
            datasets.forEach((d) => {
                sold[d.label] = d.data[d.data.length - 1] ?? 0;
            });
            setSoldFinal(sold);
        });
    }, []);

    const lineOptions = {
        responsive: true,
        interaction: { mode: "index", intersect: false },
        animation: { duration: 1200, easing: "easeOutQuart" },
        plugins: {
            legend: { position: "bottom" },
            tooltip: {
                backgroundColor: "#1C1C1E",
                padding: 12,
                cornerRadius: 12,
                callbacks: {
                    label: (ctx) =>
                        `${ctx.parsed.y.toLocaleString("ro-RO")} ${ctx.dataset.label}`,
                },
            },
        },
        scales: {
            x: { grid: { display: false } },
            y: {
                grid: { color: "rgba(0,0,0,0.05)" },
                ticks: {
                    callback: (v) => v.toLocaleString("ro-RO"),
                },
            },
        },
    };

    return (
        <div style={styles.container}>
            <div style={styles.card}>
                <h2 style={styles.title}>📊 Evoluție Sold</h2>

                {!timelineData ? (
                    <div style={styles.message}>⏳ Se încarcă...</div>
                ) : (
                    <>
                        <Line data={timelineData} options={lineOptions} />

                        <div style={localStyles.grid}>
                            {timelineData.datasets.map((d) => (
                                <div key={d.label} style={localStyles.miniCard}>
                                    <div style={{ fontWeight: 600 }}>
                                        {d.label}
                                    </div>
                                    <div style={localStyles.blueText}>
                                        {soldFinal[d.label].toLocaleString("ro-RO")} {d.label}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

//////////////////////////////////////////////////////
// STILURI LOCALE (doar ce nu există în global)
//////////////////////////////////////////////////////

const localStyles = {
    greenText: {
        color: "#34C759",
        fontWeight: "600",
    },
    blueText: {
        color: "#0A84FF",
        fontWeight: "700",
        fontSize: "18px",
    },
    grid: {
        marginTop: "30px",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: "20px",
    },
    miniCard: {
        background: "#F9F9FB",
        borderRadius: "20px",
        padding: "20px",
        textAlign: "center",
    },
};
