import { useEffect, useState } from "react";
import api from "../services/api";
import styles from "../styles/iosStyles";

import { Pie } from "react-chartjs-2";
import {
    Chart as ChartJS,
    ArcElement,
    Tooltip,
    Legend,
} from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";

ChartJS.register(ArcElement, Tooltip, Legend, ChartDataLabels);

export default function DiagramaLunara() {
    const [data, setData] = useState(null);

    useEffect(() => {
        api.get("grafice/luna/").then((res) => setData(res.data));
    }, []);

    if (!data) {
        return (
            <div style={styles.container}>
                <div style={styles.card}>
                    <div style={localStyles.loading}>
                        ⏳ Se încarcă...
                    </div>
                </div>
            </div>
        );
    }

    // =========================
    // CALCULE
    // =========================

    const totalCheltuieli = (data.cheltuieli || []).reduce(
        (s, c) => s + Number(c.total || 0),
        0
    );

    const sumaDisponibila =
        Number(data.venit || 0) - totalCheltuieli;

    const labels = [
        ...(data.cheltuieli || []).map((c) => c.categorie),
        "Disponibil",
    ];

    const values = [
        ...(data.cheltuieli || []).map((c) =>
            Number(c.total || 0)
        ),
        sumaDisponibila > 0 ? sumaDisponibila : 0,
    ];

    const colors = [
        "#FF3B30",
        "#FF9F0A",
        "#FFD60A",
        "#34C759",
        "#AF52DE",
        "#64D2FF",
        "#8E8E93",
    ];

    const chartData = {
        labels,
        datasets: [
            {
                data: values,
                backgroundColor: colors.slice(0, values.length),
                borderWidth: 0,
            },
        ],
    };

    const options = {
        plugins: {
            legend: { position: "bottom" },
            tooltip: {
                callbacks: {
                    label: function (context) {
                        const total =
                            context.dataset.data.reduce(
                                (a, b) => a + b,
                                0
                            );

                        const value = context.parsed;
                        const percentage =
                            total > 0
                                ? ((value / total) * 100).toFixed(1)
                                : 0;

                        return `${context.label}: ${percentage}%`;
                    },
                },
            },
            datalabels: {
                color: "#000",
                font: { weight: "bold", size: 14 },
                formatter: (value, context) => {
                    const total =
                        context.chart.data.datasets[0].data.reduce(
                            (a, b) => a + b,
                            0
                        );

                    if (!value) return "";

                    const percentage =
                        total > 0
                            ? ((value / total) * 100).toFixed(1)
                            : 0;

                    return percentage + "%";
                },
            },
        },
    };

    return (
        <div style={styles.container}>
            <div style={styles.card}>
                <h2 style={styles.title}>
                    📅 Diagrama lunară
                </h2>

                <div style={localStyles.hero}>
                    {data.luna}
                </div>

                <div style={localStyles.chartBox}>
                    <Pie data={chartData} options={options} />
                </div>

                {/* SUMMARY */}
                <div style={localStyles.summaryCard}>
                    <div style={styles.row}>
                        <span>💰 Venit</span>
                        <span style={localStyles.greenText}>
                            {data.venit} EUR
                        </span>
                    </div>

                    <div style={styles.row}>
                        <span>💸 Cheltuieli</span>
                        <span style={localStyles.redText}>
                            {totalCheltuieli} EUR
                        </span>
                    </div>

                    <div style={styles.row}>
                        <span>💵 Disponibil rămas</span>
                        <span
                            style={{
                                fontWeight: "600",
                                color:
                                    sumaDisponibila >= 0
                                        ? "#343434"
                                        : "#FF3B30",
                            }}
                        >
                            {sumaDisponibila} EUR
                        </span>
                    </div>

                    <div
                        style={{
                            ...styles.row,
                            borderBottom: "none",
                        }}
                    >
                        <span>💾 Economii</span>
                        <span
                            style={{
                                fontWeight: "700",
                                color:
                                    data.economii >= 0
                                        ? "#34C759"
                                        : "#FF3B30",
                            }}
                        >
                            {data.economii} EUR
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}

//////////////////////////////////////////////////////
// STILURI LOCALE (doar pentru diagramă)
//////////////////////////////////////////////////////

const localStyles = {
    hero: {
        background: "linear-gradient(135deg, #0A84FF, #5E5CE6)",
        color: "white",
        borderRadius: "18px",
        padding: "16px",
        textAlign: "center",
        fontWeight: "600",
        marginBottom: "30px",
    },
    chartBox: {
        width: "100%",
        maxWidth: "420px",
        margin: "0 auto 40px auto",
    },
    summaryCard: {
        background: "#F9F9FB",
        borderRadius: "20px",
        overflow: "hidden",
    },
    greenText: {
        color: "#34C759",
        fontWeight: "600",
    },
    redText: {
        color: "#FF3B30",
        fontWeight: "600",
    },
    loading: {
        textAlign: "center",
        padding: "40px",
        fontSize: "18px",
    },
};


// export function DiagramaLunaraVechi() {
//     const [data, setData] = useState(null);

//     useEffect(() => {
//         api.get("grafice/luna/").then((res) => setData(res.data));
//     }, []);

//     if (!data) {
//         return (
//             <div style={styles.container}>
//                 <div style={localStyles.card}>
//                     <div style={localStyles.loading}>
//                         ⏳ Se încarcă...
//                     </div>
//                 </div>
//             </div>
//         );
//     }

//     const timelineData = {
//         labels: data.timeline.map((t) => t.luna),
//         datasets: [
//             {
//                 label: "Venit",
//                 data: data.timeline.map((t) => t.venit),
//                 backgroundColor: "#34C759",
//             },
//             {
//                 label: "Cheltuieli",
//                 data: data.timeline.map((t) => t.cheltuieli),
//                 backgroundColor: "#FF3B30",
//             },
//         ],
//     };

//     const lineOptions = {
//         responsive: true,
//         plugins: {
//             legend: { position: "bottom" },
//         },
//     };

//     const lunaCurenta = data.timeline.length > 0 ? data.timeline[data.timeline.length - 1].luna : "";

//     const venitTotal = data.timeline.reduce(
//         (s, t) => s + Number(t.venit || 0),
//         0
//     );
//     const cheltuieliFaraInvestitii = data.timeline.reduce(
//         (s, t) =>
//             s + Number(t.cheltuieli || 0) - Number(t.investitii || 0),
//         0
//     );
//     const investitiiLunaCurenta = data.timeline.length > 0 ? Number(data.timeline[data.timeline.length - 1].investitii || 0) : 0;
//     const economii = data.timeline.length > 0 ? Number(data.timeline[data.timeline.length - 1].economii || 0) : 0;

//     return (
//         <div style={styles.container}>
//             <div style={localStyles.card}>
//                 <h2 style={styles.title}>
//                     📅 Diagrama lunară
//                 </h2>
//                 <div style={localStyles.hero}>
//                     {lunaCurenta}
//                 </div>
//                 <div style={localStyles.chartBox}>
//                     <Pie data={timelineData} options={lineOptions} />
//                 </div>
//                 <div style={localStyles.summaryCard}>
//                     <div style={styles.row}>
//                         <span>💰 Venit total</span
//                         <span style={localStyles.greenText}>
//                             {venitTotal} EUR
//                         </span>
//                     </div>
//                     <div style={styles.row}>
//                         <span>💸 Cheltuieli totale</span>
//                         <span style={localStyles.redText}>
//                             {cheltuieliFaraInvestitii} EUR
//                         </span>
//                     </div>
//                     <div style={styles.row}>
//                         <span>📈 Investiții luna curentă</span>
//                         <span style={localStyles.greenText}>
//                             {investitiiLunaCurenta} EUR
//                         </span>
//                     </div>
//                     <div style={styles.row}>
//                         <span>💾 Economii luna curentă</span>
//                         <span style={{
//                             fontWeight: "600",
//                             color: economii >= 0 ? "#34C759" : "#FF3B30",
//                         }}>
//                             {economii} EUR
//                         </span>
//                     </div>
//                 </div>
//             </div>
//         </div>
//     );
// }
