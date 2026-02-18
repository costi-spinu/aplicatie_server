import { useEffect, useState, useMemo } from "react";
import api from "../services/api";
import styles from "../styles/iosStyles";

// ==========================
// LUNA FINANCIARĂ 26 → 25
// ==========================
function getLunaFinanciara(dateStr) {
    const d = new Date(dateStr + "T12:00:00");
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


    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const v = await api.get("venituri/");
        const f = await api.get("cheltuieli-fixe/");
        const va = await api.get("cheltuieli-variabile/");
        setVenituri(v.data);
        setFixe(f.data);
        setVariabile(va.data);
    };

    // ==========================
    // ECONOMII LUNARE
    // ==========================
    const istoric = useMemo(() => {
        const data = {};

        [...venituri, ...fixe, ...variabile].forEach(item => {
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

        venituri.forEach(v => {
            const luna = getLunaFinanciara(v.data);
            data[luna].venit += Number(v.suma);
        });

        fixe.forEach(c => {
            const luna = getLunaFinanciara(c.data);
            data[luna].fixe += Number(c.suma);
        });

        variabile.forEach(c => {
            const luna = getLunaFinanciara(c.data);

            if (c.categorie === "investitii") {
                data[luna].investitii += Number(c.suma);
            } else {
                data[luna].variabile += Number(c.suma);
            }
        });

        Object.values(data).forEach(l => {
            l.economii = l.venit - l.fixe - l.variabile - l.investitii;
        });

        return data;
    }, [venituri, fixe, variabile]);

    const luniSortate = Object.entries(istoric)
        .sort(([a], [b]) => b.localeCompare(a));

    // const totalRecent = luniSortate.length
    //     ? luniSortate[0][1].economii
    //     : 0;

    const totalRecent = Object.values(istoric)
        .reduce((total, luna) => total + Number(luna.economii || 0), 0);

    const formatAmount = (value) => Number(value || 0).toFixed(2);


    // ==========================
    // VACANȚĂ
    // ==========================
    const totalVacanta = variabile
        .filter(v => v.categorie === "vacanta")
        .reduce((s, v) => s + Number(v.suma), 0);

    const totalCheltuit = variabile
        .filter(v => v.categorie === "vacanta_cheltuita")
        .reduce((s, v) => s + Number(v.suma), 0);

    const totalRamasVacanta = totalVacanta - totalCheltuit;

    const adaugaVacanta = async () => {
        if (!sumaVacanta) return;

        await api.post("cheltuieli-variabile/", {
            categorie: "vacanta",
            suma: sumaVacanta,
            moneda: "EUR",
            data: dataVacanta
        });

        setSumaVacanta("");
        loadData();
    };

    const adaugaCheltuialaVacanta = async () => {
        if (!sumaCheltuialaVacanta) return;

        // await api.post("cheltuieli-variabile/", {
        //     categorie: "vacanta_cheltuita",
        //     suma: sumaCheltuialaVacanta,
        //     moneda: "EUR",
        //     data: dataCheltuialaVacanta
        // });
        const payload = {
            categorie: "vacanta_cheltuita",
            suma: sumaCheltuialaVacanta,
            moneda: "EUR",
            data: dataCheltuialaVacanta
        }
        if (editCheltuialaVacantaId) {
            await api.put(`cheltuieli-variabile/${editCheltuialaVacantaId}/`, payload);
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
        if (!window.confirm("Sigur ștergi cheltuiala de vacanță?")) return;

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
            <h2 style={styles.title}>💾 Economii</h2>

            {/* HERO */}
            <div style={styles.heroCard}>
                <div style={styles.heroLabel}>
                    📆 Total recent economisit
                </div>
                <div style={styles.heroValue}>
                    {/* {totalRecent} € */}
                    {formatAmount(totalRecent)} €
                </div>
            </div>

            {/* ISTORIC */}
            <div style={styles.card}>
                {/* <h3 style={styles.sectionTitle}>Istoric lunar</h3> */}
                <h3 style={styles.sectionTitle}>Istoric economii lunare</h3>

                {luniSortate.map(([luna, l]) => (
                    <div key={luna} style={styles.row}>
                        <span>{luna}</span>
                        <span style={{
                            color: l.economii >= 0 ? "#34C759" : "#FF3B30",
                            fontWeight: "600"
                        }}>
                            {/* {l.economii} € */}
                            {formatAmount(l.economii)} €
                        </span>
                    </div>
                ))}
            </div>

            {/* VACANȚĂ SUMMARY */}
            <div style={styles.card}>
                <h3 style={styles.sectionTitle}>🏖 Economii vacanță</h3>

                <div style={styles.row}>
                    <span>Total pus deoparte</span>
                    {/* <span>{totalVacanta} €</span> */}
                    <span>{formatAmount(totalVacanta)} €</span>
                </div>
                <div style={styles.row}>
                    <span>Total cheltuit</span>
                    {/* <span>{totalCheltuit} €</span> */}
                    <span>{formatAmount(totalCheltuit)} €</span>
                </div>
                <div style={styles.row}>
                    <strong>Rămași</strong>
                    {/* <strong>{totalRamasVacanta} €</strong> */}
                    <strong>{formatAmount(totalRamasVacanta)} €</strong>
                </div>
            </div>

            {/* ADAUGĂ VACANȚĂ */}
            <div style={styles.card}>
                <h4 style={styles.sectionTitle}>➕ Adaugă economii vacanță</h4>

                <input
                    style={styles.input}
                    type="number"
                    placeholder="Sumă"
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
                    Adaugă
                </button>
            </div>

            {/* CHELTUIELI VACANȚĂ */}
            <div style={styles.card}>
                <h4 style={styles.sectionTitle}>➖ Cheltuieli vacanță</h4>

                <input
                    style={styles.input}
                    type="number"
                    placeholder="Sumă"
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
                    {/* Adaugă cheltuială */}
                    {editCheltuialaVacantaId ? "Salvează cheltuiala" : "Adaugă cheltuială"}
                </button>

                {variabile
                    .filter(v => v.categorie === "vacanta_cheltuita")
                    // .map((c, index) => (
                    //     <div key={index} style={styles.row}>
                    //         <span>{c.data}</span>
                    //         <span style={{ color: "#FF3B30" }}>
                    //             -{c.suma} €
                    //         </span>
                    .map((c) => (
                        <div key={c.id} style={styles.row}>
                            <div>
                                <div style={{ fontWeight: 600 }}>{c.data}</div>
                                <div style={styles.date}>Cheltuială vacanță</div>
                            </div>

                            <div style={{ textAlign: "right" }}>
                                <div style={{ color: "#FF3B30", fontWeight: 600 }}>
                                    -{formatAmount(c.suma)} €
                                </div>
                                <div style={{ marginTop: 6, display: "flex", gap: 10, justifyContent: "flex-end" }}>
                                    <button
                                        style={{ background: "none", border: "none", color: "#0A84FF", cursor: "pointer" }}
                                        onClick={() => startEditCheltuialaVacanta(c)}
                                    >
                                        Edit
                                    </button>
                                    <button
                                        style={styles.deleteBtn}
                                        onClick={() => stergeCheltuialaVacanta(c.id)}
                                    >
                                        Șterge
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
            </div>
        </div>
    );
}
