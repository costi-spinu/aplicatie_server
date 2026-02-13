import { useEffect, useState } from "react";
import api from "../services/api";
import styles from "../styles/iosStyles";

export default function AdminPanel() {
    const [users, setUsers] = useState([]);
    const [filteredUsers, setFilteredUsers] = useState([]);
    const [editUser, setEditUser] = useState(null);
    const [search, setSearch] = useState("");

    useEffect(() => {
        loadUsers();
    }, []);

    useEffect(() => {
        const filtered = users.filter((u) =>
            u.username.toLowerCase().includes(search.toLowerCase()) ||
            u.email.toLowerCase().includes(search.toLowerCase())
        );
        setFilteredUsers(filtered);
    }, [search, users]);

    const loadUsers = async () => {
        try {
            const res = await api.get("admin/users/");
            setUsers(res.data);
            setFilteredUsers(res.data);
        } catch (err) {
            console.error("Eroare load users:", err);
        }
    };

    const saveUser = async () => {
        await api.put(`admin/users/${editUser.id}/`, editUser);
        setEditUser(null);
        loadUsers();
    };

    const deleteUser = async (user) => {
        if (!window.confirm("Sigur vrei să ștergi acest utilizator?"))
            return;

        if (user.is_superuser) {
            alert("Nu poți șterge un superuser.");
            return;
        }

        await api.delete(`admin/users/${user.id}/delete/`);
        loadUsers();
    };

    return (
        <div style={styles.container}>
            <div style={styles.card}>
                <h2 style={{ ...styles.title, color: "#FF3B30" }}>
                    👥 Administrare Utilizatori
                </h2>

                {/* SEARCH BAR */}
                <input
                    style={localStyles.searchInput}
                    placeholder="🔎 Caută utilizator..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />

                {/* LISTA USERS */}
                <div style={localStyles.userList}>
                    {filteredUsers.length === 0 && (
                        <div style={localStyles.empty}>
                            Niciun utilizator găsit
                        </div>
                    )}

                    {filteredUsers.map((u) => (
                        <div key={u.id} style={localStyles.userRow}>
                            <div>
                                <div style={{ fontWeight: 600 }}>
                                    {u.username}
                                </div>

                                {u.is_superuser && (
                                    <div style={localStyles.superBadge}>
                                        SUPERUSER
                                    </div>
                                )}

                                <div style={localStyles.email}>
                                    {u.email}
                                </div>

                                <div style={localStyles.date}>
                                    Creat la:{" "}
                                    {new Date(u.date_joined)
                                        .toLocaleString("ro-RO")}
                                </div>
                            </div>

                            <div style={localStyles.actionButtons}>
                                <button
                                    style={localStyles.editButton}
                                    onClick={() => setEditUser(u)}
                                >
                                    Edit
                                </button>

                                <button
                                    style={localStyles.deleteButton}
                                    onClick={() => deleteUser(u)}
                                >
                                    Șterge
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* MODAL EDIT */}
                {editUser && (
                    <div style={localStyles.modal}>
                        <div style={localStyles.modalCard}>
                            <h3>Edit utilizator</h3>

                            <input
                                style={styles.input}
                                value={editUser.username}
                                onChange={(e) =>
                                    setEditUser({
                                        ...editUser,
                                        username: e.target.value,
                                    })
                                }
                            />

                            <input
                                style={styles.input}
                                value={editUser.email}
                                onChange={(e) =>
                                    setEditUser({
                                        ...editUser,
                                        email: e.target.value,
                                    })
                                }
                            />

                            <label>
                                <input
                                    type="checkbox"
                                    checked={editUser.is_staff}
                                    onChange={(e) =>
                                        setEditUser({
                                            ...editUser,
                                            is_staff: e.target.checked,
                                        })
                                    }
                                />
                                Staff
                            </label>

                            <label>
                                <input
                                    type="checkbox"
                                    checked={editUser.is_superuser}
                                    onChange={(e) =>
                                        setEditUser({
                                            ...editUser,
                                            is_superuser: e.target.checked,
                                        })
                                    }
                                />
                                Superuser
                            </label>

                            <div style={{ marginTop: 20 }}>
                                <button
                                    style={styles.blueButton}
                                    onClick={saveUser}
                                >
                                    💾 Salvează
                                </button>

                                <button
                                    style={{ marginLeft: 10 }}
                                    onClick={() => setEditUser(null)}
                                >
                                    Anulează
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

//////////////////////////////////////////////////////
// STILURI LOCALE
//////////////////////////////////////////////////////

const localStyles = {
    searchInput: {
        width: "95%",
        padding: "14px",
        borderRadius: "14px",
        border: "1px solid #E5E5EA",
        marginBottom: "20px",
        fontSize: "15px",
        background: "#F9F9FB",
    },
    userList: {
        background: "#F9F9FB",
        borderRadius: "20px",
        overflow: "hidden",
    },
    userRow: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "18px",
        borderBottom: "1px solid #EAEAF0",
    },
    email: {
        fontSize: 12,
        color: "#8E8E93",
    },
    date: {
        fontSize: 12,
        color: "#636366",
        marginTop: 4,
    },
    empty: {
        padding: "20px",
        textAlign: "center",
        color: "#8E8E93",
    },
    actionButtons: {
        display: "flex",
        gap: "10px",
    },
    editButton: {
        padding: "8px 14px",
        borderRadius: "14px",
        border: "none",
        background: "#0A84FF",
        color: "white",
        fontWeight: "600",
        fontSize: "14px",
        cursor: "pointer",
    },
    deleteButton: {
        padding: "8px 14px",
        borderRadius: "14px",
        border: "none",
        background: "#FF3B30",
        color: "white",
        fontWeight: "600",
        fontSize: "14px",
        cursor: "pointer",
    },
    superBadge: {
        fontSize: "10px",
        background: "#FF3B30",
        color: "white",
        padding: "2px 6px",
        borderRadius: "6px",
        display: "inline-block",
        marginTop: "4px",
    },
    modal: {
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
    },
    modalCard: {
        background: "white",
        padding: "30px",
        borderRadius: "20px",
        width: "400px",
    },
};
