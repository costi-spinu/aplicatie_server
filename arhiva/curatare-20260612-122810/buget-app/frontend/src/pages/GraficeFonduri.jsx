import { useEffect, useState } from "react";
import api from "../services/api";
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
import { Line } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

const COLORS = {
  EUR: "#1f5f8b",
  RON: "#146c43",
};

export default function GraficeFonduri() {
  const [totalData, setTotalData] = useState(null);
  const [perUserData, setPerUserData] = useState({});
  const [soldFinal, setSoldFinal] = useState({ EUR: 0, RON: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("fonduri/grafic/timeline/extended/")
      .then((res) => {
        const buildDatasets = (data) =>
          data.datasets.map((d) => ({
            ...d,
            borderColor: COLORS[d.label] || "#5f6f66",
            backgroundColor: COLORS[d.label] || "#5f6f66",
            borderWidth: 3,
            tension: 0.3,
            pointRadius: 4,
            fill: false,
          }));

        setTotalData({
          labels: res.data.total.labels,
          datasets: buildDatasets(res.data.total),
        });

        const finalSold = {};
        res.data.total.datasets.forEach((d) => {
          finalSold[d.label] = d.data[d.data.length - 1] ?? 0;
        });
        setSoldFinal(finalSold);

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
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { position: "bottom" },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const value = ctx.parsed.y;
            const moneda = ctx.dataset.label;
            const sign = value >= 0 ? "+" : "-";
            return `${moneda}: ${sign}${Math.abs(value).toLocaleString()}`;
          },
        },
      },
    },
    scales: {
      x: { grid: { display: false } },
      y: {
        grid: { color: "rgba(16,32,26,0.08)" },
        ticks: { callback: (v) => v.toLocaleString() },
      },
    },
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.title}>Evolutie investitii</h2>
        {loading && <div style={localStyles.loading}>Se incarca graficele...</div>}

        {!loading && (
          <>
            <h3 style={styles.sectionTitle}>Total investitii</h3>
            {totalData && <Line data={totalData} options={lineOptions} />}

            <div style={localStyles.heroGrid}>
              <div style={localStyles.statBox}>
                <div style={localStyles.heroLabel}>Sold total EUR</div>
                <div style={localStyles.heroValue}>
                  {soldFinal.EUR?.toLocaleString()}
                </div>
              </div>
              <div style={localStyles.statBox}>
                <div style={localStyles.heroLabel}>Sold total RON</div>
                <div style={localStyles.heroValue}>
                  {soldFinal.RON?.toLocaleString()}
                </div>
              </div>
            </div>

            {Object.entries(perUserData).map(([username, data]) => (
              <div key={username} style={{ marginTop: 44 }}>
                <h3>{username}</h3>
                <Line data={data} options={lineOptions} />
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

const localStyles = {
  heroGrid: {
    marginTop: 32,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 12,
  },
  statBox: {
    background: "#f8faf9",
    border: "1px solid #cfd8d3",
    borderRadius: 6,
    padding: 18,
    textAlign: "center",
  },
  heroLabel: {
    fontSize: 14,
    color: "#5f6f66",
  },
  heroValue: {
    fontSize: 28,
    fontWeight: 800,
    marginTop: 8,
  },
  loading: {
    textAlign: "center",
    padding: 40,
    fontSize: 16,
  },
};
