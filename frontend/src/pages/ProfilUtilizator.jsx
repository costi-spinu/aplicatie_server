import { useEffect, useState } from "react";
import api from "../services/api";
import styles from "../styles/iosStyles";

export default function ProfilUtilizator() {
    const [user, setUser] = useState(null);
    const [allUsers, setAllUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState("");
    const [bridgeRequests, setBridgeRequests] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        init();
    }, []);

    const init = async () => {
        try {
            await Promise.all([
                loadMe(),
                loadUsers(),
                loadBridgeRequests()
            ]);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const loadMe = async () => {
        const res = await api.get("me/");
        setUser(res.data);
    };

    const loadUsers = async () => {
        const res = await api.get("users/list/");
        setAllUsers(res.data);
    };

    const loadBridgeRequests = async () => {
        const res = await api.get("bridge/requests/");
        setBridgeRequests(res.data);
    };

    const updateUser = async () => {
        try {
            await api.put(`admin/users/${user.id}/`, user);
            alert("Profil actualizat ✅");
        } catch (err) {
            alert("Eroare la actualizare");
        }
    };

    const deleteUser = async () => {
        if (!window.confirm("Sigur ștergi contul?")) return;

        try {
            await api.delete(`admin/users/${user.id}/delete/`);
            logout();
        } catch (err) {
            alert("Eroare la ștergere");
        }
    };

    const sendBridge = async () => {
        if (!selectedUser) return;

        try {
            await api.post("bridge/send/", {
                user_id: selectedUser
            });
            alert("Cerere trimisă 🔗");
        } catch (err) {
            alert("Eroare la trimitere");
        }
    };

    const acceptBridge = async (id) => {
        try {
            await api.post(`bridge/accept/${id}/`);
            await loadBridgeRequests();
            alert("Bridge acceptat ✅");
        } catch (err) {
            alert("Eroare la acceptare");
        }
    };

    const logout = () => {
        localStorage.clear();
        window.location.reload();
    };

    if (loading || !user) return <div>Loading...</div>;

    return (
        <div style={styles.container}>
            <div style={styles.card}>
                <h2 style={styles.title}>👤 Profil utilizator</h2>

                {/* EDIT */}
                <input
                    style={styles.input}
                    value={user.username}
                    onChange={(e) =>
                        setUser({ ...user, username: e.target.value })
                    }
                />

                <input
                    style={styles.input}
                    value={user.email}
                    onChange={(e) =>
                        setUser({ ...user, email: e.target.value })
                    }
                />

                <button style={styles.blueButton} onClick={updateUser}>
                    💾 Salvează
                </button>

                <button
                    style={{
                        ...styles.blueButton,
                        background: "#FF3B30",
                        marginTop: 10
                    }}
                    onClick={deleteUser}
                >
                    🗑 Șterge cont
                </button>

                {/* 🔥 LOGOUT */}
                <button
                    style={{
                        ...styles.blueButton,
                        background: "#8E8E93",
                        marginTop: 10
                    }}
                    onClick={logout}
                >
                    🚪 Logout
                </button>

                {/* BRIDGE */}
                <h3 style={{ marginTop: 40 }}>🔗 Conectare utilizator</h3>

                <select
                    style={styles.input}
                    value={selectedUser}
                    onChange={(e) => setSelectedUser(e.target.value)}
                >
                    <option value="">Selectează utilizator</option>
                    {allUsers.map(u => (
                        <option key={u.id} value={u.id}>
                            {u.username}
                        </option>
                    ))}
                </select>

                <button style={styles.greenButton} onClick={sendBridge}>
                    Trimite cerere bridge
                </button>

                {/* REQUESTS */}
                <h3 style={{ marginTop: 40 }}>📨 Cereri primite</h3>

                {bridgeRequests.length === 0 && (
                    <p style={{ opacity: 0.6 }}>Nu ai cereri</p>
                )}

                {bridgeRequests.map(req => (
                    <div key={req.id} style={styles.row}>
                        <span>{req.from_user}</span>
                        <button
                            style={styles.greenButton}
                            onClick={() => acceptBridge(req.id)}
                        >
                            Acceptă
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
