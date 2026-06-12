import { useEffect, useState } from "react";
import api from "../services/api";
import { Line } from "react-chartjs-2";
import styles from "../styles/iosStyles";
import {
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
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

export default function StatusVenit() {
  const [chartData, setChartData] = useState(null);

  useEffect(() => {
    api.get("venit/status/").then((res) => {
      const labels = [...res.data.labels].reverse();
      const data = [...res.data.data].reverse();
      setChartData({
        labels,
        datasets: [
          {
            label: "Venit lunar (EUR)",
            data,
            borderWidth: 3,
            tension: 0.3,
            pointHoverRadius: 8,
            fill: false,
            borderColor: "#146c43",
            pointBackgroundColor: "#146c43",
            pointRadius: 5,
          },
        ],
      });
    });
  }, []);

  const options = {
    responsive: true,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { position: "bottom" },
      datalabels: {
        anchor: "end",
        align: "top",
        formatter: (value) => `${value.toLocaleString("ro-RO")} EUR`,
        font: { weight: "bold" },
        color: "#146c43",
      },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.parsed.y.toLocaleString("ro-RO")} EUR`,
        },
      },
    },
    scales: {
      x: { grid: { display: false } },
      y: {
        grid: { color: "rgba(16,32,26,0.08)" },
        ticks: { callback: (v) => v.toLocaleString("ro-RO") },
      },
    },
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.title}>Status venit lunar</h2>
        {!chartData ? (
          <div style={styles.message}>Se incarca...</div>
        ) : (
          <>
            <Line data={chartData} options={options} />
            <div style={{ marginTop: 30 }}>
              {chartData.labels.map((label, index) => (
                <div key={label} style={styles.row}>
                  <span>{label}</span>
                  <strong style={localStyles.greenText}>
                    {chartData.datasets[0].data[index].toLocaleString("ro-RO")} EUR
                  </strong>
                </div>
              ))}
              <div style={{ ...styles.row, marginTop: 10 }}>
                <strong>Total general</strong>
                <strong style={localStyles.greenText}>
                  {chartData.datasets[0].data
                    .reduce((a, b) => a + b, 0)
                    .toLocaleString("ro-RO")}{" "}
                  EUR
                </strong>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

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
        tension: 0.3,
        pointRadius: 4,
        fill: false,
        borderColor: "#1f5f8b",
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
    plugins: {
      legend: { position: "bottom" },
      tooltip: {
        callbacks: {
          label: (ctx) =>
            `${ctx.parsed.y.toLocaleString("ro-RO")} ${ctx.dataset.label}`,
        },
      },
    },
    scales: {
      x: { grid: { display: false } },
      y: {
        grid: { color: "rgba(16,32,26,0.08)" },
        ticks: { callback: (v) => v.toLocaleString("ro-RO") },
      },
    },
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.title}>Evolutie sold</h2>
        {!timelineData ? (
          <div style={styles.message}>Se incarca...</div>
        ) : (
          <>
            <Line data={timelineData} options={lineOptions} />
            <div style={localStyles.grid}>
              {timelineData.datasets.map((d) => (
                <div key={d.label} style={localStyles.miniCard}>
                  <div style={{ fontWeight: 700 }}>{d.label}</div>
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

const localStyles = {
  greenText: {
    color: "#146c43",
    fontWeight: 800,
  },
  blueText: {
    color: "#1f5f8b",
    fontWeight: 800,
    fontSize: 18,
  },
  grid: {
    marginTop: 30,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 16,
  },
  miniCard: {
    background: "#f8faf9",
    border: "1px solid #cfd8d3",
    borderRadius: 6,
    padding: 18,
    textAlign: "center",
  },
};
