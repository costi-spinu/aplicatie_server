import { useEffect, useState } from "react";
import api from "../services/api";
import styles from "../styles/iosStyles";
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from "chart.js";
import { Bar, Pie } from "react-chartjs-2";

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement
);

function getIntervalLunaFinanciara(dateStr) {
  const d = new Date(dateStr);

  if (d.getDate() >= 26) {
    return {
      start: new Date(d.getFullYear(), d.getMonth(), 26),
      end: new Date(d.getFullYear(), d.getMonth() + 1, 25, 23, 59, 59),
    };
  }

  return {
    start: new Date(d.getFullYear(), d.getMonth() - 1, 26),
    end: new Date(d.getFullYear(), d.getMonth(), 25, 23, 59, 59),
  };
}

function inInterval(data, interval) {
  const d = new Date(data);
  return d >= interval.start && d <= interval.end;
}

function getLunaFinanciara(dateStr) {
  const d = new Date(`${dateStr}T12:00:00`);
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
    const loadData = async () => {
      const [v, f, va] = await Promise.all([
        api.get("venituri/"),
        api.get("cheltuieli-fixe/"),
        api.get("cheltuieli-variabile/"),
      ]);
      setVenituri(v.data);
      setFixe(f.data);
      setVariabile(va.data);
    };

    const timer = setTimeout(() => {
      loadData();
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  const today = new Date().toISOString().split("T")[0];
  const lunaCurenta = getLunaFinanciara(today);
  const intervalCurent = getIntervalLunaFinanciara(today);

  const cheltuieliLunaCurenta = [...fixe, ...variabile].filter((c) =>
    inInterval(c.data, intervalCurent)
  );

  const investitiiLunaCurenta = cheltuieliLunaCurenta
    .filter((c) => c.categorie === "investitii")
    .reduce((s, c) => s + Number(c.suma), 0);

  const cheltuieliFaraInvestitii = cheltuieliLunaCurenta
    .filter((c) => c.categorie !== "investitii")
    .reduce((s, c) => s + Number(c.suma), 0);

  const venitTotal = venituri
    .filter((v) => inInterval(v.data, intervalCurent))
    .reduce((s, v) => s + Number(v.suma), 0);

  const economii = venitTotal - cheltuieliFaraInvestitii - investitiiLunaCurenta;
  const istoric = {};

  [...venituri, ...fixe, ...variabile].forEach((item) => {
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

  venituri.forEach((v) => {
    const luna = getLunaFinanciara(v.data);
    istoric[luna].venit += Number(v.suma);
  });

  fixe.forEach((c) => {
    const luna = getLunaFinanciara(c.data);
    istoric[luna].fixe += Number(c.suma);
  });

  variabile.forEach((c) => {
    const luna = getLunaFinanciara(c.data);
    if (c.categorie === "investitii") {
      istoric[luna].investitii += Number(c.suma);
    } else {
      istoric[luna].variabile += Number(c.suma);
    }
  });

  Object.values(istoric).forEach((l) => {
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
    labels: ["Cheltuieli", "Investitii", "Economii"],
    datasets: [
      {
        data: [cheltuieliFaraInvestitii, investitiiLunaCurenta, economii],
        backgroundColor: ["#b42318", "#1f5f8b", "#146c43"],
      },
    ],
  };

  const barData = {
    labels: ["Venit", "Cheltuieli", "Investitii", "Economii"],
    datasets: [
      {
        data: [
          venitTotal,
          cheltuieliFaraInvestitii,
          investitiiLunaCurenta,
          economii,
        ],
        backgroundColor: [
          "#146c43",
          "#b42318",
          "#1f5f8b",
          economii >= 0 ? "#5f6f66" : "#b42318",
        ],
      },
    ],
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.title}>Buget - luna {lunaCurenta}</h2>

        <h3 style={styles.sectionTitle}>Grafice luna curenta</h3>
        <div style={localStyles.graphRow}>
          <div style={localStyles.pieBox}>
            <Pie data={pieData} />
          </div>
        </div>

        <div style={localStyles.barBox}>
          <Bar data={barData} />
        </div>

        <h3 style={{ ...styles.sectionTitle, marginTop: 40 }}>Istoric lunar</h3>
        {Object.entries(istoric)
          .sort(([a], [b]) => b.localeCompare(a))
          .map(([luna, l]) => (
            <div key={luna} style={localStyles.monthCard}>
              <div style={localStyles.monthTitle}>{luna}</div>
              <div style={styles.row}>
                <span>Venit</span>
                <strong>{l.venit} EUR</strong>
              </div>
              <div style={styles.row}>
                <span>Fixe</span>
                <span>
                  {l.fixe} EUR ({l.procente.fixe.toFixed(1)}%)
                </span>
              </div>
              <div style={styles.row}>
                <span>Variabile</span>
                <span>
                  {l.variabile} EUR ({l.procente.variabile.toFixed(1)}%)
                </span>
              </div>
              <div style={styles.row}>
                <span>Investitii</span>
                <span>
                  {l.investitii} EUR ({l.procente.investitii.toFixed(1)}%)
                </span>
              </div>
              <div style={styles.row}>
                <span>Economii</span>
                <strong style={{ color: l.economii >= 0 ? "#146c43" : "#b42318" }}>
                  {l.economii} EUR ({l.procente.economii.toFixed(1)}%)
                </strong>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

const localStyles = {
  monthCard: {
    background: "#ffffff",
    border: "1px solid #cfd8d3",
    borderRadius: 6,
    padding: 18,
    marginBottom: 18,
  },
  monthTitle: {
    fontWeight: 800,
    marginBottom: 12,
  },
  graphRow: {
    display: "flex",
    justifyContent: "center",
    marginBottom: 32,
  },
  pieBox: {
    width: 320,
    height: 320,
  },
  barBox: {
    width: "100%",
    height: 260,
  },
};
