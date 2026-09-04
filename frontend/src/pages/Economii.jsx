import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../services/api";
import {
  areCachedApiEndpointsFresh,
  getCachedApiData,
} from "../services/apiConfig";
import { ECONOMII_ENDPOINTS } from "../services/preloadEndpoints";
import styles from "../styles/iosStyles";
import { translateCurrentText } from "../contexts/AppSettingsContext";

export default function Economii() {
  const cachedVariabile = getCachedApiData("cheltuieli-variabile/");
  const cachedHistory = getCachedApiData("economii/istoric/");
  const cachedVacationSummary = getCachedApiData("economii/vacanta/");

  const [activeTab, setActiveTab] = useState("economii");
  const [variabile, setVariabile] = useState(() =>
    Array.isArray(cachedVariabile) ? cachedVariabile : []
  );
  const [istoric, setIstoric] = useState(() =>
    Array.isArray(cachedHistory) ? cachedHistory : []
  );
  const [vacationSummary, setVacationSummary] = useState(
    cachedVacationSummary || {
      puse_deoparte: 0,
      cheltuite: 0,
      ramase: 0,
    }
  );
  const [sumaVacanta, setSumaVacanta] = useState("");
  const [dataVacanta, setDataVacanta] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [sumaCheltuialaVacanta, setSumaCheltuialaVacanta] = useState("");
  const [dataCheltuialaVacanta, setDataCheltuialaVacanta] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [editCheltuialaVacantaId, setEditCheltuialaVacantaId] = useState(null);
  const [msg, setMsg] = useState("");

  const loadData = useCallback(async () => {
    try {
      const [historyRes, variableRes, vacationRes] = await Promise.all([
        api.get("economii/istoric/"),
        api.get("cheltuieli-variabile/"),
        api.get("economii/vacanta/"),
      ]);
      setIstoric(historyRes.data || []);
      setVariabile(variableRes.data || []);
      setVacationSummary(vacationRes.data || {});
      setMsg("");
    } catch (error) {
      console.error("Eroare la incarcarea economiilor:", error);
      setMsg("Nu am putut incarca datele pentru economii si vacanta.");
    }
  }, []);

  useEffect(() => {
    if (areCachedApiEndpointsFresh(ECONOMII_ENDPOINTS)) return;
    void Promise.resolve().then(loadData);
  }, [loadData]);

  const luniSortate = useMemo(
    () => istoric.slice().sort((a, b) => b.luna.localeCompare(a.luna)),
    [istoric]
  );

  const totalRecent = istoric.reduce(
    (total, luna) => total + Number(luna.economii ?? luna.sold ?? 0),
    0
  );

  const formatAmount = (value) => Number(value || 0).toFixed(2);

  const totalVacanta = Number(vacationSummary.puse_deoparte || 0);
  const totalEconomiiIntroduse = variabile
    .filter((v) => v.categorie === "economii")
    .reduce((s, v) => s + Number(v.suma), 0);

  const totalCheltuit = Number(vacationSummary.cheltuite || 0);
  const totalRamasVacanta = Number(vacationSummary.ramase || 0);

  const adaugaVacanta = async () => {
    if (!sumaVacanta) return;

    await api.post("cheltuieli-variabile/", {
      categorie: "vacanta",
      suma: sumaVacanta,
      moneda: "EUR",
      data: dataVacanta,
    });

    setSumaVacanta("");
    await loadData();
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
    await loadData();
  };

  const startEditCheltuialaVacanta = (cheltuiala) => {
    setEditCheltuialaVacantaId(cheltuiala.id);
    setSumaCheltuialaVacanta(cheltuiala.suma);
    setDataCheltuialaVacanta(cheltuiala.data);
  };

  const stergeCheltuialaVacanta = async (cheltuialaId) => {
    if (!window.confirm(translateCurrentText("Sigur stergi cheltuiala de vacanta?"))) {
      return;
    }

    await api.delete(`cheltuieli-variabile/${cheltuialaId}/`);

    if (editCheltuialaVacantaId === cheltuialaId) {
      setEditCheltuialaVacantaId(null);
      setSumaCheltuialaVacanta("");
      setDataCheltuialaVacanta(new Date().toISOString().split("T")[0]);
    }

    await loadData();
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Economii si vacanta</h2>

      {msg && <div style={styles.message}>{msg}</div>}

      <div style={localStyles.summaryGrid}>
        <div style={styles.heroCard}>
          <div style={styles.heroLabel}>Total economisit</div>
          <div style={styles.heroValue}>{formatAmount(totalRecent)} EUR</div>
        </div>
        <div style={styles.heroCard}>
          <div style={styles.heroLabel}>Economii introduse</div>
          <div style={styles.heroValue}>
            {formatAmount(totalEconomiiIntroduse)} EUR
          </div>
        </div>
        <div style={styles.heroCard}>
          <div style={styles.heroLabel}>Ramas pentru vacanta</div>
          <div style={styles.heroValue}>{formatAmount(totalRamasVacanta)} EUR</div>
        </div>
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

          {luniSortate.map((l) => {
            const saved = Number(l.economii ?? l.sold ?? 0);
            return (
              <div key={l.luna} style={{ ...styles.row, display: "block" }}>
                <div style={localStyles.historyHeading}>
                  <span>{l.luna}</span>
                  <span
                    style={{
                      color:
                        saved >= 0 ? "var(--app-success)" : "var(--app-danger)",
                      fontWeight: 800,
                    }}
                  >
                    {formatAmount(saved)} EUR
                  </span>
                </div>
                <div style={styles.date}>
                  {l.start} - {l.end} | Venit brut {formatAmount(l.venit_brut)} EUR
                  | Credite {formatAmount(l.deduceri_credite)} EUR | Fixe automate{" "}
                  {formatAmount(l.fixe_automate)} EUR | Fixe manuale{" "}
                  {formatAmount(l.fixe_manuale)} EUR | Variabile{" "}
                  {formatAmount(l.variabile)} EUR
                </div>
              </div>
            );
          })}
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
  historyHeading: {
    alignItems: "center",
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
    gap: 12,
    marginBottom: 16,
  },
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
