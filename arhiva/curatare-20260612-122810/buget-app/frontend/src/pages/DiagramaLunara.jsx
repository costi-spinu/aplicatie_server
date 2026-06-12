import { useEffect, useState } from "react";
import api from "../services/api";
import styles from "../styles/iosStyles";
import { Pie } from "react-chartjs-2";
import { ArcElement, Chart as ChartJS, Legend, Tooltip } from "chart.js";
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
        <div style={styles.card}>Se incarca...</div>
      </div>
    );
  }

  const totalCheltuieli = (data.cheltuieli || []).reduce(
    (s, c) => s + Number(c.total || 0),
    0
  );
  const sumaDisponibila = Number(data.venit || 0) - totalCheltuieli;
  const labels = [
    ...(data.cheltuieli || []).map((c) => c.categorie),
    "Disponibil",
  ];
  const values = [
    ...(data.cheltuieli || []).map((c) => Number(c.total || 0)),
    sumaDisponibila > 0 ? sumaDisponibila : 0,
  ];

  const chartData = {
    labels,
    datasets: [
      {
        data: values,
        backgroundColor: [
          "#b42318",
          "#b7791f",
          "#1f5f8b",
          "#146c43",
          "#5f6f66",
          "#8a4f7d",
          "#68758f",
        ].slice(0, values.length),
        borderWidth: 0,
      },
    ],
  };

  const options = {
    plugins: {
      legend: { position: "bottom" },
      tooltip: {
        callbacks: {
          label: (context) => {
            const total = context.dataset.data.reduce((a, b) => a + b, 0);
            const value = context.parsed;
            const percentage =
              total > 0 ? ((value / total) * 100).toFixed(1) : 0;
            return `${context.label}: ${percentage}%`;
          },
        },
      },
      datalabels: {
        color: "#10201a",
        font: { weight: "bold", size: 12 },
        formatter: (value, context) => {
          const total = context.chart.data.datasets[0].data.reduce(
            (a, b) => a + b,
            0
          );
          if (!value) return "";
          return `${total > 0 ? ((value / total) * 100).toFixed(1) : 0}%`;
        },
      },
    },
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.title}>Diagrama lunara</h2>
        <div style={localStyles.monthLabel}>{data.luna}</div>
        <div style={localStyles.chartBox}>
          <Pie data={chartData} options={options} />
        </div>
        <div style={localStyles.summaryCard}>
          <div style={styles.row}>
            <span>Venit</span>
            <strong style={localStyles.greenText}>{data.venit} EUR</strong>
          </div>
          <div style={styles.row}>
            <span>Cheltuieli</span>
            <strong style={localStyles.redText}>{totalCheltuieli} EUR</strong>
          </div>
          <div style={styles.row}>
            <span>Disponibil ramas</span>
            <strong>{sumaDisponibila} EUR</strong>
          </div>
          <div style={{ ...styles.row, borderBottom: "none" }}>
            <span>Economii</span>
            <strong>{data.economii} EUR</strong>
          </div>
        </div>
      </div>
    </div>
  );
}

const localStyles = {
  monthLabel: {
    background: "#f8faf9",
    border: "1px solid #cfd8d3",
    borderRadius: 4,
    padding: 12,
    textAlign: "center",
    fontWeight: 800,
    marginBottom: 24,
  },
  chartBox: {
    width: "100%",
    maxWidth: 420,
    margin: "0 auto 32px auto",
  },
  summaryCard: {
    background: "#ffffff",
    border: "1px solid #cfd8d3",
    borderRadius: 6,
    overflow: "hidden",
    padding: "0 12px",
  },
  greenText: {
    color: "#146c43",
  },
  redText: {
    color: "#b42318",
  },
};
