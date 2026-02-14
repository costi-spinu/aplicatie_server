import { useEffect, useState } from "react";
import api from "../services/api";
import styles from "../styles/iosStyles";

export default function Venit() {
  const [suma, setSuma] = useState("");
  const [moneda, setMoneda] = useState("EUR");
  const [data, setData] = useState(
    new Date().toISOString().split("T")[0]
  );

  const [venituri, setVenituri] = useState([]);
  const [total, setTotal] = useState(0);
  const [editId, setEditId] = useState(null);
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);

      const [listRes, totalRes] = await Promise.all([
        api.get("venituri/"),
        api.get("venit/total/"),
      ]);

      const venitData = listRes.data.results || listRes.data;

      setVenituri(Array.isArray(venitData) ? venitData : []);
      setTotal(totalRes.data?.venit_total || 0);
    } catch (err) {
      console.error(err);
      setMsg("❌ Eroare la încărcare date");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const resetForm = () => {
    setSuma("");
    setMoneda("EUR");
    setData(new Date().toISOString().split("T")[0]);
    setEditId(null);
  };

  const adaugaVenit = async () => {
    if (!suma) {
      setMsg("Introdu suma");
      return;
    }

    try {
      await api.post("venituri/", {
        suma: parseFloat(suma),
        moneda,
        data,
      });

      setMsg("✔ Venit adăugat");
      resetForm();
      loadData();
    } catch (err) {
      console.error(err.response?.data);
      setMsg("❌ Eroare la adăugare");
    }
  };

  const salveazaEdit = async () => {
    if (!suma) return;

    try {
      await api.put(`venituri/${editId}/`, {
        suma: parseFloat(suma),
        moneda,
        data,
      });

      setMsg("✔ Venit modificat");
      resetForm();
      loadData();
    } catch {
      setMsg("❌ Eroare la modificare");
    }
  };

  const stergeVenit = async (id) => {
    if (!window.confirm("Sigur ștergi?")) return;

    try {
      await api.delete(`venituri/${id}/`);
      loadData();
    } catch {
      setMsg("❌ Eroare la ștergere");
    }
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <h2 style={styles.title}>⏳ Se încarcă...</h2>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>💰 Venit</h2>

      <div style={styles.heroCard}>
        <div style={styles.heroLabel}>Total lunar</div>
        <div style={styles.heroValue}>{total} EUR</div>
      </div>

      {msg && <div style={styles.message}>{msg}</div>}

      <div style={styles.card}>
        <h3 style={styles.sectionTitle}>
          {editId ? "✏️ Modifică venit" : "➕ Adaugă venit"}
        </h3>

        <input
          style={styles.input}
          type="number"
          placeholder="Sumă"
          value={suma}
          onChange={(e) => setSuma(e.target.value)}
        />

        <select
          style={styles.input}
          value={moneda}
          onChange={(e) => setMoneda(e.target.value)}
        >
          <option value="EUR">EUR</option>
          <option value="RON">RON</option>
        </select>

        <input
          style={styles.input}
          type="date"
          value={data}
          onChange={(e) => setData(e.target.value)}
        />

        {editId ? (
          <button style={styles.greenButton} onClick={salveazaEdit}>
            💾 Salvează
          </button>
        ) : (
          <button style={styles.blueButton} onClick={adaugaVenit}>
            ➕ Adaugă
          </button>
        )}
      </div>

      <div style={styles.card}>
        <h3 style={styles.sectionTitle}>Istoric venituri</h3>

        {venituri.length === 0 && (
          <div style={{ opacity: 0.6 }}>
            Nu există venituri.
          </div>
        )}

        {venituri.map((v) => (
          <div key={v.id} style={styles.row}>
            <div>
              <div style={styles.amount}>
                {v.suma} {v.moneda}
              </div>
              <div style={styles.date}>{v.data}</div>
            </div>

            <div>
              <button
                style={styles.editBtn}
                onClick={() => {
                  setEditId(v.id);
                  setSuma(v.suma);
                  setMoneda(v.moneda);
                  setData(v.data);
                }}
              >
                ✏️
              </button>

              <button
                style={styles.deleteBtn}
                onClick={() => stergeVenit(v.id)}
              >
                🗑
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
