import { useEffect, useState } from "react";
import api from "../services/api";

export default function EconomiiVacanta() {
    const [data, setData] = useState([]);
    const [suma, setSuma] = useState("");
    const [tip, setTip] = useState("economii");

    const loadData = () => {
        api.get("economii-vacanta/").then(res => setData(res.data));
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();

        // 1️⃣ Salvăm în EconomiiVacanta
        await api.post("economii-vacanta/", {
            tip,
            suma,
            moneda: "EUR",
        });

        // 2️⃣ Salvăm și în Cheltuieli Variabile
        await api.post("cheltuieli-variabile/", {
            categorie: "vacanta",
            suma,
            moneda: "EUR",
            data: new Date().toISOString().split("T")[0]
        });

        setSuma("");
        loadData();
    };


    const puse = data.filter(d => d.tip === "economii");
    const cheltuite = data.filter(d => d.tip === "cheltuieli");

    // Grupare pe lună
    const groupedByMonth = data.reduce((acc, item) => {
        const date = new Date(item.data);
        const luna = date.toLocaleString("ro-RO", { month: "long", year: "numeric" });

        if (!acc[luna]) {
            acc[luna] = {
                economii: 0,
                cheltuieli: 0
            };
        }

        if (item.tip === "economii") {
            acc[luna].economii += Number(item.suma);
        }

        if (item.tip === "cheltuieli") {
            acc[luna].cheltuieli += Number(item.suma);
        }

        return acc;
    }, {});

    return (
        <div>
            <h2>🏖 Economii vacanță</h2>

            {/* FORMULAR */}
            <form onSubmit={handleSubmit}>
                <select value={tip} onChange={e => setTip(e.target.value)}>
                    <option value="economii">➕ Economii</option>

                </select>

                <input
                    type="number"
                    placeholder="Suma"
                    value={suma}
                    onChange={e => setSuma(e.target.value)}
                    required
                />

                <button type="submit">Salvează</button>
            </form>

            <h3>Puși deoparte</h3>
            <ul>
                {puse.map(e => (
                    <li key={e.id}>{e.data} – {e.suma} EUR</li>
                ))}
            </ul>

            <h3>Cheltuiți</h3>
            <ul>
                {cheltuite.map(e => (
                    <li key={e.id}>{e.data} – {e.suma} EUR</li>
                ))}
            </ul>

            <h3 className="mt-8 text-lg font-semibold">📊 Sold lunar</h3>

            <div className="max-w-lg mt-4 bg-white rounded-2xl shadow border border-gray-100 overflow-hidden">
                {Object.entries(groupedByMonth).map(([luna, values]) => (
                    <div
                        key={luna}
                        className="px-6 py-4 border-b border-gray-100 last:border-b-0 flex justify-between"
                    >
                        <div className="font-medium text-gray-800">
                            {luna}
                        </div>

                        <div className="text-right">
                            <div className="text-sm text-gray-500">
                                Economii: {values.economii} €
                            </div>
                            <div className="text-sm text-gray-500">
                                Cheltuieli: {values.cheltuieli} €
                            </div>
                            <div className="font-semibold text-blue-600">
                                Sold: {values.economii - values.cheltuieli} €
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
