import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../services/api";
import styles from "../styles/iosStyles";

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

export default function Economii() {
  const [activeTab, setActiveTab] = useState("economii");
  const [venituri, setVenituri] = useState([]);
  const [fixe, setFixe] = useState([]);
  const [variabile, setVariabile] = useState([]);
  const [sumaVacanta, setSumaVacanta] = useState("");
  const [dataVacanta, setDataVacanta] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [sumaCheltuialaVacanta, setSumaCheltuialaVacanta] = useState("");
  const [dataCheltuialaVacanta, setDataCheltuialaVacanta] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [editCheltuialaVacantaId, setEditCheltuialaVacantaId] = useState(null);

  const loadData = useCallback(async () => {
    const [v, f, va] = await Promise.all([
      api.get("venituri/"),
      api.get("cheltuieli-fixe/"),
      api.get("cheltuieli-variabile/"),
    ]);
    setVenituri(v.data);
    setFixe(f.data);
    setVariabile(va.data);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 0);

    return () => clearTimeout(timer);
  }, [loadData]);

  const istoric = useMemo(() => {
    const data = {};

    [...venituri, ...fixe, ...variabile].forEach((item) => {
      const luna = getLunaFinanciara(item.data);

      if (!data[luna]) {
        data[luna] = {
          venit: 0,
          fixe: 0,
          variabile: 0,
          investitii: 0,
          economii: 0,
        };
      }
    });

    venituri.forEach((v) => {
      const luna = getLunaFinanciara(v.data);
      data[luna].venit += Number(v.suma);
    });

    fixe.forEach((c) => {
      const luna = getLunaFinanciara(c.data);
      data[luna].fixe += Number(c.suma);
    });

    variabile.forEach((c) => {
      const luna = getLunaFinanciara(c.data);

      if (c.categorie === "investitii") {
        data[luna].investitii += Number(c.suma);
      } else {
        data[luna].variabile += Number(c.suma);
      }
    });

    Object.values(data).forEach((l) => {
      l.economii = l.venit - l.fixe - l.variabile - l.investitii;
    });

    return data;
  }, [venituri, fixe, variabile]);

  const luniSortate = Object.entries(istoric).sort(([a], [b]) =>
    b.localeCompare(a)
  );

  const totalRecent = Object.values(istoric).reduce(
    (total, luna) => total + Number(luna.economii || 0),
    0
  );

  const formatAmount = (value) => Number(value || 0).toFixed(2);

  const totalVacanta = variabile
    .filter((v) => v.categorie === "vacanta")
    .reduce((s, v) => s + Number(v.suma), 0);

  const totalCheltuit = variabile
    .filter((v) => v.categorie === "vacanta_cheltuita")
    .reduce((s, v) => s + Number(v.suma), 0);

  const totalRamasVacanta = totalVacanta - totalCheltuit;

  const adaugaVacanta = async () => {
    if (!sumaVacanta) return;

    await api.post("cheltuieli-variabile/", {
      categorie: "vacanta",
      suma: sumaVacanta,
      moneda: "EUR",
      data: dataVacanta,
    });

    setSumaVacanta("");
    loadData();
  };

  const adaugaCheltuialaVacanta = async () => {
    if (!sumaCheltuialaVacanta) return;

    const payload = {
      categorie: "vacanta_cheltuita",
      suma: sumaCheltuialaVacanta,
      moneda: "EUR",
      data: dataCheltuialaVacanta,
    };

    if (editCheltuialaVacantaId) {
      await api.put(
        `cheltuieli-variabile/${editCheltuialaVacantaId}/`,
        payload
      );
    } else {
      await api.post("cheltuieli-variabile/", payload);
    }

    setEditCheltuialaVacantaId(null);
    setSumaCheltuialaVacanta("");
    setDataCheltuialaVacanta(new Date().toISOString().split("T")[0]);
    loadData();
  };

  const startEditCheltuialaVacanta = (cheltuiala) => {
    setEditCheltuialaVacantaId(cheltuiala.id);
    setSumaCheltuialaVacanta(cheltuiala.suma);
    setDataCheltuialaVacanta(cheltuiala.data);
  };

  const stergeCheltuialaVacanta = async (cheltuialaId) => {
    if (!window.confirm("Sigur stergi cheltuiala de vacanta?")) return;

    await api.delete(`cheltuieli-variabile/${cheltuialaId}/`);

    if (editCheltuialaVacantaId === cheltuialaId) {
      setEditCheltuialaVacantaId(null);
      setSumaCheltuialaVacanta("");
      setDataCheltuialaVacanta(new Date().toISOString().split("T")[0]);
    }

    loadData();
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Economii si vacanta</h2>

      <div style={styles.heroCard}>
        <div style={styles.heroLabel}>Total economisit</div>
        <div style={styles.heroValue}>{formatAmount(totalRecent)} EUR</div>
      </div>

      <div style={localStyles.tabWrap}>
        {[
          ["economii", "Istoric economii lunare"],
          ["vacanta", "Economii vacanta"],
          ["cheltuieli-vacanta", "Cheltuieli vacanta"],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            style={{
              ...localStyles.tabBtn,
              ...(activeTab === key ? localStyles.tabBtnActive : {}),
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === "economii" && (
        <div style={styles.card}>
          <h3 style={styles.sectionTitle}>Istoric economii lunare</h3>

          {luniSortate.map(([luna, l]) => (
            <div key={luna} style={styles.row}>
              <span>{luna}</span>
              <span
                style={{
                  color: l.economii >= 0 ? "var(--app-success)" : "var(--app-danger)",
                  fontWeight: 800,
                }}
              >
                {formatAmount(l.economii)} EUR
              </span>
            </div>
          ))}
        </div>
      )}

      {activeTab === "vacanta" && (
        <>
          <div style={styles.card}>
            <h3 style={styles.sectionTitle}>Economii vacanta</h3>

            <div style={styles.row}>
              <span>Total pus deoparte</span>
              <span>{formatAmount(totalVacanta)} EUR</span>
            </div>
            <div style={styles.row}>
              <span>Total cheltuit</span>
              <span>{formatAmount(totalCheltuit)} EUR</span>
            </div>
            <div style={styles.row}>
              <strong>Ramas</strong>
              <strong>{formatAmount(totalRamasVacanta)} EUR</strong>
            </div>
          </div>

          <div style={styles.card}>
            <h4 style={styles.sectionTitle}>Adauga economii vacanta</h4>

            <input
              style={styles.input}
              type="number"
              placeholder="Suma"
              value={sumaVacanta}
              onChange={(e) => setSumaVacanta(e.target.value)}
            />

            <input
              style={styles.input}
              type="date"
              value={dataVacanta}
              onChange={(e) => setDataVacanta(e.target.value)}
            />

            <button style={styles.blueButton} onClick={adaugaVacanta}>
              Adauga
            </button>
          </div>
        </>
      )}

      {activeTab === "cheltuieli-vacanta" && (
        <div style={styles.card}>
          <h4 style={styles.sectionTitle}>Cheltuieli vacanta</h4>

          <input
            style={styles.input}
            type="number"
            placeholder="Suma"
            value={sumaCheltuialaVacanta}
            onChange={(e) => setSumaCheltuialaVacanta(e.target.value)}
          />

          <input
            style={styles.input}
            type="date"
            value={dataCheltuialaVacanta}
            onChange={(e) => setDataCheltuialaVacanta(e.target.value)}
          />

          <button style={styles.blueButton} onClick={adaugaCheltuialaVacanta}>
            {editCheltuialaVacantaId
              ? "Salveaza cheltuiala"
              : "Adauga cheltuiala"}
          </button>

          {variabile
            .filter((v) => v.categorie === "vacanta_cheltuita")
            .map((c) => (
              <div key={c.id} style={styles.row}>
                <div>
                  <div style={{ fontWeight: 700 }}>{c.data}</div>
                  <div style={styles.date}>Cheltuiala vacanta</div>
                </div>

                <div style={{ textAlign: "right" }}>
                  <div style={{ color: "var(--app-danger)", fontWeight: 800 }}>
                    -{formatAmount(c.suma)} EUR
                  </div>
                  <div style={localStyles.rowActions}>
                    <button
                      style={localStyles.editButton}
                      onClick={() => startEditCheltuialaVacanta(c)}
                    >
                      Edit
                    </button>
                    <button
                      style={styles.deleteBtn}
                      onClick={() => stergeCheltuialaVacanta(c.id)}
                    >
                      Sterge
                    </button>
                  </div>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

const localStyles = {
  tabWrap: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
    gap: 8,
    marginBottom: 16,
  },
  tabBtn: {
    border: "1px solid var(--app-border)",
    background: "var(--app-panel)",
    color: "var(--app-text)",
    borderRadius: 4,
    padding: "10px 12px",
    fontWeight: 800,
    cursor: "pointer",
  },
  tabBtnActive: {
    background: "var(--app-primary-soft)",
    borderColor: "var(--app-primary)",
    color: "var(--app-primary-dark)",
  },
  rowActions: {
    marginTop: 6,
    display: "flex",
    gap: 10,
    justifyContent: "flex-end",
  },
  editButton: {
    background: "var(--app-panel)",
    border: "1px solid var(--app-border)",
    borderRadius: 4,
    color: "var(--app-primary-dark)",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 12,
    padding: "4px 7px",
  },
};
