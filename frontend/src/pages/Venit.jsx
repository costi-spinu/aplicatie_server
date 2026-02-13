import { useEffect, useState } from "react";
import api from "../services/api";
import styles from "../styles/iosStyles";

export default function Venit() {
    const [suma, setSuma] = useState("");
    const [currentUser, setCurrentUser] = useState(null);
    const [moneda, setMoneda] = useState("EUR");
    const [data, setData] = useState(
        new Date().toISOString().split("T")[0]
    );

    const [venituri, setVenituri] = useState([]);
    const [total, setTotal] = useState(0);

    const [editId, setEditId] = useState(null);
    const [msg, setMsg] = useState(null);

    const formatDateTime = (dt) => {
        return new Date(dt).toLocaleString("ro-RO");
    };

    const loadData = async () => {
    try {
        const [list, totalRes, meRes] = await Promise.all([
            api.get("venituri/"),
            api.get("venit/total/"),
            api.get("me/")
        ]);

        setVenituri(list.data);
        setTotal(totalRes.data.venit_total);
        setCurrentUser(meRes.data);

    } catch (err) {
        console.error("Eroare venit:", err);
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
        if (!suma) return;

        try {
            await api.post("venituri/", {
                suma: Number(suma),
                moneda,
                data,
            });
            setMsg("✔ Venit adăugat");
            resetForm();
            loadData();
        } catch {
            setMsg("❌ Eroare la adăugare");
        }
    };

    const salveazaEdit = async () => {
        if (!suma) return;

        try {
            await api.put(`venituri/${editId}/`, {
                suma: Number(suma),
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
        if (!window.confirm("Sigur ștergi acest venit?")) return;

        try {
            await api.delete(`venituri/${id}/`);
            loadData();
        } catch {
            setMsg("❌ Eroare la ștergere");
        }
    };

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
                        💾 Salvează modificarea
                    </button>
                ) : (
                    <button style={styles.blueButton} onClick={adaugaVenit}>
                        ➕ Adaugă venit
                    </button>
                )}
            </div>

            {editId && (
                <div style={styles.selectedCard}>
                    <div style={styles.selectedLabel}>
                        Venit selectat pentru modificare
                    </div>
                    <div style={styles.selectedValue}>
                        {suma} {moneda} – {data}
                    </div>
                </div>
            )}

            <div style={styles.card}>
                <h3 style={styles.sectionTitle}>Istoric venituri</h3>

                {venituri.map((v) => (
                    <div
                        key={v.id}
                        style={{
                            ...styles.row,
                            ...(editId === v.id ? styles.activeRow : {}),
                        }}
                        onClick={() => {
                            setEditId(v.id);
                            setSuma(v.suma);
                            setMoneda(v.moneda);
                            setData(v.data);
                        }}
                    >
                        <div>
                            <div style={styles.amount}>
                                {v.suma} {v.moneda}
                            </div>

                            <div style={{ fontSize: 12, opacity: 0.7 }}>
                                👤 {v.username}
                            </div>
                            <div style={styles.date}>{v.data}</div>
                            {v.updated_at && (
                                <div style={styles.updated}>
                                    ultima modificare: {formatDateTime(v.updated_at)}
                                </div>
                            )}
                        </div>

                        <button
                            style={styles.deleteBtn}
                            onClick={(e) => {
                                e.stopPropagation();
                                stergeVenit(v.id);
                            }}
                        >
                            🗑
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
