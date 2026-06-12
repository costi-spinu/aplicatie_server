import { useEffect, useState } from "react";
import api from "../services/api";
import styles from "../styles/iosStyles";

export default function EconomiiVacanta() {
  const [data, setData] = useState([]);
  const [suma, setSuma] = useState("");
  const [tip, setTip] = useState("economii");

  const loadData = () => {
    api.get("economii-vacanta/").then((res) => setData(res.data));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    await api.post("economii-vacanta/", {
      tip,
      suma,
      moneda: "EUR",
    });

    await api.post("cheltuieli-variabile/", {
      categorie: "vacanta",
      suma,
      moneda: "EUR",
      data: new Date().toISOString().split("T")[0],
    });

    setSuma("");
    loadData();
  };

  const puse = data.filter((d) => d.tip === "economii");
  const cheltuite = data.filter((d) => d.tip === "cheltuieli");

  const groupedByMonth = data.reduce((acc, item) => {
    const date = new Date(item.data);
    const luna = date.toLocaleString("ro-RO", {
      month: "long",
      year: "numeric",
    });

    if (!acc[luna]) {
      acc[luna] = { economii: 0, cheltuieli: 0 };
    }

    if (item.tip === "economii") acc[luna].economii += Number(item.suma);
    if (item.tip === "cheltuieli") acc[luna].cheltuieli += Number(item.suma);

    return acc;
  }, {});

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Economii vacanta</h2>
      <div style={styles.card}>
        <form onSubmit={handleSubmit}>
          <select
            style={styles.input}
            value={tip}
            onChange={(e) => setTip(e.target.value)}
          >
            <option value="economii">Economii</option>
          </select>
          <input
            style={styles.input}
            type="number"
            placeholder="Suma"
            value={suma}
            onChange={(e) => setSuma(e.target.value)}
            required
          />
          <button type="submit" style={styles.blueButton}>
            Salveaza
          </button>
        </form>
      </div>

      <div style={styles.card}>
        <h3 style={styles.sectionTitle}>Pusi deoparte</h3>
        {puse.map((e) => (
          <div key={e.id} style={styles.row}>
            <span>{e.data}</span>
            <strong>{e.suma} EUR</strong>
          </div>
        ))}
      </div>

      <div style={styles.card}>
        <h3 style={styles.sectionTitle}>Cheltuiti</h3>
        {cheltuite.map((e) => (
          <div key={e.id} style={styles.row}>
            <span>{e.data}</span>
            <strong>{e.suma} EUR</strong>
          </div>
        ))}
      </div>

      <div style={styles.card}>
        <h3 style={styles.sectionTitle}>Sold lunar</h3>
        {Object.entries(groupedByMonth).map(([luna, values]) => (
          <div key={luna} style={styles.row}>
            <span>{luna}</span>
            <strong>{values.economii - values.cheltuieli} EUR</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
