import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../services/api";
import styles from "../styles/iosStyles";
import { translateCurrentText } from "../contexts/AppSettingsContext";

export default function AdminPanel() {
  const [users, setUsers] = useState([]);
  const [editUser, setEditUser] = useState(null);
  const [search, setSearch] = useState("");
  const [newUser, setNewUser] = useState({
    username: "",
    email: "",
    password: "",
  });
  const [createMessage, setCreateMessage] = useState("");
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);

  const loadUsers = useCallback(async () => {
    try {
      const res = await api.get("admin/users/");
      setUsers(res.data);
    } catch (err) {
      console.error("Eroare load users:", err);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadUsers);
  }, [loadUsers]);

  const filteredUsers = useMemo(
    () =>
      users.filter(
        (u) =>
          u.username.toLowerCase().includes(search.toLowerCase()) ||
          u.email.toLowerCase().includes(search.toLowerCase())
      ),
    [search, users]
  );

  const createUser = async (event) => {
    event.preventDefault();
    setCreateMessage("");
    setCreateError("");

    if (!newUser.username.trim() || !newUser.email.trim() || !newUser.password) {
      setCreateError("Completează toate câmpurile pentru noul utilizator.");
      return;
    }

    setCreating(true);
    try {
      await api.post("admin/users/", {
        username: newUser.username.trim(),
        email: newUser.email.trim().toLowerCase(),
        password: newUser.password,
      });
      setNewUser({ username: "", email: "", password: "" });
      setCreateMessage("Utilizatorul a fost creat cu succes.");
      await loadUsers();
    } catch (error) {
      const responseData = error.response?.data;
      const messages = responseData && typeof responseData === "object"
        ? Object.values(responseData)
            .flatMap((value) => (Array.isArray(value) ? value : [value]))
            .filter(Boolean)
            .map(String)
        : [];
      setCreateError(messages.join(" ") || "Utilizatorul nu a putut fi creat.");
    } finally {
      setCreating(false);
    }
  };

  const saveUser = async () => {
    await api.put(`admin/users/${editUser.id}/`, editUser);
    setEditUser(null);
    loadUsers();
  };

  const deleteUser = async (user) => {
    if (!window.confirm(translateCurrentText("Sigur vrei sa stergi acest utilizator?"))) {
      return;
    }

    if (user.is_superuser) {
      window.alert(translateCurrentText("Nu poti sterge un superuser."));
      return;
    }

    await api.delete(`admin/users/${user.id}/delete/`);
    loadUsers();
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.title}>Administrare utilizatori</h2>

        <form onSubmit={createUser} style={localStyles.createForm}>
          <h3 style={styles.sectionTitle}>Utilizator nou</h3>
          <div style={localStyles.createGrid}>
            <input
              style={styles.input}
              placeholder="Nume utilizator"
              autoComplete="off"
              value={newUser.username}
              onChange={(event) =>
                setNewUser((current) => ({
                  ...current,
                  username: event.target.value,
                }))
              }
            />
            <input
              style={styles.input}
              type="email"
              placeholder="Email"
              autoComplete="off"
              value={newUser.email}
              onChange={(event) =>
                setNewUser((current) => ({
                  ...current,
                  email: event.target.value,
                }))
              }
            />
            <input
              style={styles.input}
              type="password"
              placeholder="Parolă (minimum 6 caractere)"
              autoComplete="new-password"
              value={newUser.password}
              onChange={(event) =>
                setNewUser((current) => ({
                  ...current,
                  password: event.target.value,
                }))
              }
            />
          </div>
          {createError && <div style={styles.errorBox}>{createError}</div>}
          {createMessage && <div style={styles.messageBox}>{createMessage}</div>}
          <button type="submit" style={styles.blueButton} disabled={creating}>
            {creating ? "Se creează..." : "Creează utilizator"}
          </button>
        </form>

        <input
          style={localStyles.searchInput}
          placeholder="Cauta utilizator"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div style={localStyles.userList}>
          {filteredUsers.length === 0 && (
            <div style={localStyles.empty}>Niciun utilizator gasit</div>
          )}

          {filteredUsers.map((u) => (
            <div key={u.id} style={localStyles.userRow}>
              <div>
                <div style={{ fontWeight: 800 }}>{u.username}</div>
                {u.is_superuser && (
                  <div style={localStyles.superBadge}>SUPERUSER</div>
                )}
                <div style={localStyles.email}>{u.email}</div>
                <div style={localStyles.date}>
                  Creat la: {new Date(u.date_joined).toLocaleString("ro-RO")}
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
                  Sterge
                </button>
              </div>
            </div>
          ))}
        </div>

        {editUser && (
          <div style={localStyles.modal}>
            <div style={localStyles.modalCard}>
              <h3>Edit utilizator</h3>
              <input
                style={styles.input}
                value={editUser.username}
                onChange={(e) =>
                  setEditUser({ ...editUser, username: e.target.value })
                }
              />
              <input
                style={styles.input}
                value={editUser.email}
                onChange={(e) =>
                  setEditUser({ ...editUser, email: e.target.value })
                }
              />
              <label style={localStyles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={editUser.is_staff}
                  onChange={(e) =>
                    setEditUser({ ...editUser, is_staff: e.target.checked })
                  }
                />{" "}
                Staff
              </label>
              <label style={localStyles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={editUser.is_superuser}
                  onChange={(e) =>
                    setEditUser({
                      ...editUser,
                      is_superuser: e.target.checked,
                    })
                  }
                />{" "}
                Superuser
              </label>
              <div style={localStyles.modalActions}>
                <button style={styles.blueButton} onClick={saveUser}>
                  Salveaza
                </button>
                <button
                  style={localStyles.cancelButton}
                  onClick={() => setEditUser(null)}
                >
                  Anuleaza
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const localStyles = {
  createForm: {
    padding: 16,
    marginBottom: 20,
    border: "1px solid var(--app-border)",
    borderRadius: 6,
    background: "var(--app-panel-alt)",
  },
  createGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
    gap: 10,
  },
  searchInput: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 4,
    border: "1px solid #cfd8d3",
    marginBottom: 20,
    fontSize: 15,
    background: "#ffffff",
  },
  userList: {
    background: "#ffffff",
    border: "1px solid #cfd8d3",
    borderRadius: 6,
    overflow: "hidden",
  },
  userRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 14,
    padding: 18,
    borderBottom: "1px solid #e4ebe7",
  },
  email: {
    fontSize: 12,
    color: "#5f6f66",
  },
  date: {
    fontSize: 12,
    color: "#5f6f66",
    marginTop: 4,
  },
  empty: {
    padding: 20,
    textAlign: "center",
    color: "#5f6f66",
  },
  actionButtons: {
    display: "flex",
    gap: 10,
  },
  editButton: {
    padding: "8px 14px",
    borderRadius: 4,
    border: "1px solid #1f5f8b",
    background: "#1f5f8b",
    color: "white",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
  },
  deleteButton: {
    padding: "8px 14px",
    borderRadius: 4,
    border: "1px solid #b42318",
    background: "#b42318",
    color: "white",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
  },
  superBadge: {
    fontSize: 10,
    background: "#b42318",
    color: "white",
    padding: "2px 6px",
    borderRadius: 4,
    display: "inline-block",
    marginTop: 4,
  },
  modal: {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    background: "rgba(16,32,26,0.35)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalCard: {
    background: "white",
    padding: 30,
    border: "1px solid #cfd8d3",
    borderRadius: 6,
    width: "100%",
    maxWidth: 420,
  },
  checkboxLabel: {
    display: "block",
    marginBottom: 10,
  },
  modalActions: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
    marginTop: 20,
  },
  cancelButton: {
    border: "1px solid #cfd8d3",
    background: "#ffffff",
    borderRadius: 4,
    color: "#10201a",
    fontWeight: 700,
    cursor: "pointer",
  },
};
