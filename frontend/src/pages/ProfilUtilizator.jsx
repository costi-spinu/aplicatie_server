import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../services/api";
import { getCachedApiData } from "../services/apiConfig";
import styles from "../styles/iosStyles";
import { prepareMediaValueForApi, resolveMediaUrl } from "../utils/mediaUrl";

const RON_TO_EUR_FALLBACK = 0.2;

const RUBRICI = [
  { value: "fond_urgenta", label: "Fond de urgenta" },
  { value: "trading212", label: "Investitii - Trading212" },
  { value: "xtb", label: "Investitii - XTB" },
  { value: "revolut", label: "Investitii - Revolut" },
  { value: "tradeville", label: "Investitii - Tradeville" },
  { value: "cont_economii", label: "Cont de economii" },
  { value: "alte_investitii", label: "Alte investitii" },
];

const categoryLabelMap = {
  alimente: "Alimente",
  sanatate: "Sanatate",
  auto: "Transport",
  transport: "Transport",
  cultura: "Cultura",
  shopping: "Shopping",
  neprevazute: "Neprevazute",
  economii: "Economii",
  vacanta: "Vacanta",
  divertisment: "Iesiri / Restaurante / Diverse",
  investitii: "Investitii",
  vacanta_cheltuita: "Cheltuieli vacanta",
};

const todayIso = () => new Date().toISOString().split("T")[0];
const getCurrentMonthKey = () => new Date().toISOString().slice(0, 7);
const round2 = (value) => Math.round(Number(value || 0) * 100) / 100;
const toNumber = (value) => Number(value || 0);
const emptySchedule = () => ({
  data: todayIso(),
  ocupatie: "",
  suma: "",
  moneda: "RON",
  activ: true,
});

const getRubricaLabel = (value) =>
  RUBRICI.find((rubrica) => rubrica.value === value)?.label ||
  value ||
  "Alte investitii";

const getCategoryLabel = (value) =>
  categoryLabelMap[value] || value || "Categorie necunoscuta";

const formatAmount = (value, currency = "EUR") =>
  `${Number(value || 0).toLocaleString("ro-RO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;

const getApiErrorMessage = (error, fallback) => {
  const data = error?.response?.data;
  if (typeof data === "string" && data.trim()) return data;
  if (data?.detail) return data.detail;

  if (data && typeof data === "object") {
    const firstValue = Object.values(data)[0];
    if (Array.isArray(firstValue) && firstValue[0]) return String(firstValue[0]);
    if (firstValue) return String(firstValue);
  }

  return fallback;
};

const convertToEur = (amount, currency, ronToEurRate) => {
  if (currency === "RON") return round2(toNumber(amount) * ronToEurRate);
  return round2(amount);
};

const buildUserState = (data) =>
  data
    ? {
        id: data.id,
        username: data.username || "",
        first_name: data.first_name || "",
        last_name: data.last_name || "",
        email: data.email || "",
      }
    : null;

const buildProfileState = (data) => {
  if (!data) return null;
  const nextProfile = data.profile || {};
  const schedules = nextProfile.salary_schedules || [];

  return {
    poza: "",
    data_nasterii: "",
    ocupatia: "",
    telefon: "",
    venit_estimat: "",
    venit_estimat_lunar: "",
    ...nextProfile,
    salary_schedules: schedules.length ? schedules : [emptySchedule()],
  };
};

export default function ProfilUtilizator() {
  const cachedProfile = getCachedApiData("profile/");
  const cachedBridgeConnections = getCachedApiData("bridge/connections/");
  const cachedRate = getCachedApiData("curs-bnr/");
  const cachedRonToEurRate =
    Number(cachedRate?.ron_eur || 0) || RON_TO_EUR_FALLBACK;
  const cachedEurRonRate = Number(cachedRate?.eur_ron || 0) || null;
  const cachedFinancialData = {
    buget: getCachedApiData("buget/lunar/") || null,
    venituri: getCachedApiData("venituri/") || [],
    fixe: getCachedApiData("cheltuieli-fixe/") || [],
    variabile: getCachedApiData("cheltuieli-variabile/") || [],
    fonduri: getCachedApiData("fonduri/") || {
      total_eur: 0,
      total_ron: 0,
      miscari: [],
    },
  };

  const [activeTab, setActiveTab] = useState("profile");
  const [user, setUser] = useState(() => buildUserState(cachedProfile));
  const [profile, setProfile] = useState(() => buildProfileState(cachedProfile));
  const [allUsers, setAllUsers] = useState(() => getCachedApiData("users/list/") || []);
  const [selectedUser, setSelectedUser] = useState("");
  const [bridgeRequests, setBridgeRequests] = useState(
    () => getCachedApiData("bridge/requests/") || []
  );
  const [bridgeConnections, setBridgeConnections] = useState(() =>
    Array.isArray(cachedBridgeConnections)
      ? Array.from(
          new Map(
            cachedBridgeConnections.map((item) => [item.user_id || item.id, item])
          ).values()
        )
      : []
  );
  const [financialData, setFinancialData] = useState(cachedFinancialData);
  const [loading, setLoading] = useState(!cachedProfile);
  const [msg, setMsg] = useState("");
  const [profileLoadError, setProfileLoadError] = useState("");
  const [passwordForm, setPasswordForm] = useState({
    old_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [ronToEurRate, setRonToEurRate] = useState(cachedRonToEurRate);
  const [eurRonRate, setEurRonRate] = useState(cachedEurRonRate);
  const [rateDate, setRateDate] = useState(cachedRate?.date || "");
  const [rateSource, setRateSource] = useState(cachedRate?.source || "fallback");
  const [failedPhotoUrl, setFailedPhotoUrl] = useState("");
  const profilePhotoUrl = resolveMediaUrl(profile?.poza);
  const photoLoadError = profilePhotoUrl && failedPhotoUrl === profilePhotoUrl;

  const loadProfile = useCallback(async () => {
    const res = await api.get("profile/");
    setUser(buildUserState(res.data));
    setProfile(buildProfileState(res.data));
  }, []);

  const loadUsers = useCallback(async () => {
    const res = await api.get("users/list/");
    setAllUsers(res.data || []);
  }, []);

  const loadBridgeRequests = useCallback(async () => {
    const res = await api.get("bridge/requests/");
    setBridgeRequests(res.data || []);
  }, []);

  const loadBridgeConnections = useCallback(async () => {
    const res = await api.get("bridge/connections/");
    const uniqueConnections = Array.from(
      new Map((res.data || []).map((item) => [item.user_id || item.id, item])).values()
    );
    setBridgeConnections(uniqueConnections);
  }, []);

  const loadFinancialData = useCallback(async () => {
    const [buget, venituri, fixe, variabile, fonduri] = await Promise.all([
      api.get("buget/lunar/"),
      api.get("venituri/"),
      api.get("cheltuieli-fixe/"),
      api.get("cheltuieli-variabile/"),
      api.get("fonduri/"),
    ]);

    setFinancialData({
      buget: buget.data || null,
      venituri: venituri.data || [],
      fixe: fixe.data || [],
      variabile: variabile.data || [],
      fonduri: fonduri.data || { total_eur: 0, total_ron: 0, miscari: [] },
    });
  }, []);

  const fetchExchangeRate = useCallback(async () => {
    try {
      const response = await api.get("curs-bnr/");
      const rate = Number(response.data?.ron_eur);
      if (!rate || Number.isNaN(rate)) throw new Error("Curs valutar invalid");

      setRonToEurRate(rate);
      setEurRonRate(Number(response.data?.eur_ron || 0) || null);
      setRateDate(response.data?.date || "");
      setRateSource("BNR");
    } catch (error) {
      console.warn("Curs BNR indisponibil pentru profil:", error);
      setRonToEurRate(RON_TO_EUR_FALLBACK);
      setEurRonRate(null);
      setRateDate("");
      setRateSource("fallback");
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        setProfileLoadError("");
        await loadProfile();
      } catch (err) {
        console.error("Profilul nu a putut fi incarcat:", err);
        setProfileLoadError(
          "Nu am putut incarca profilul. Verifica daca esti autentificat si daca API-ul backend raspunde corect."
        );
        setMsg("Nu am putut incarca profilul utilizatorului.");
        setLoading(false);
        return;
      }

      const optionalResults = await Promise.allSettled([
        loadUsers(),
        loadBridgeRequests(),
        loadBridgeConnections(),
        loadFinancialData(),
        fetchExchangeRate(),
      ]);

      const hasOptionalError = optionalResults.some(
        (result) => result.status === "rejected"
      );
      if (hasOptionalError) {
        console.warn("Unele date optionale de profil nu au putut fi incarcate.", optionalResults);
        setMsg("Profilul s-a incarcat, dar unele date optionale nu sunt disponibile momentan.");
      }

      setLoading(false);
    };

    init();
  }, [
    fetchExchangeRate,
    loadBridgeConnections,
    loadBridgeRequests,
    loadFinancialData,
    loadProfile,
    loadUsers,
  ]);

  const updateUserField = (field, value) =>
    setUser((prev) => ({ ...prev, [field]: value }));

  const updateProfileField = (field, value) =>
    setProfile((prev) => ({ ...prev, [field]: value }));

  const updateSchedule = (index, field, value) => {
    setProfile((prev) => ({
      ...prev,
      salary_schedules: (prev.salary_schedules || []).map((item, idx) =>
        idx === index ? { ...item, [field]: value } : item
      ),
    }));
  };

  const addSchedule = () => {
    setProfile((prev) => ({
      ...prev,
      salary_schedules: [...(prev.salary_schedules || []), emptySchedule()],
    }));
  };

  const removeSchedule = (index) => {
    setProfile((prev) => ({
      ...prev,
      salary_schedules: (prev.salary_schedules || []).filter(
        (_, idx) => idx !== index
      ),
    }));
  };

  const handlePhoto = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setFailedPhotoUrl("");
      updateProfileField("poza", reader.result);
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const removeProfilePhoto = () => {
    setFailedPhotoUrl("");
    updateProfileField("poza", "");
    setMsg("Poza va fi stearsa dupa ce salvezi profilul.");
  };

  const buildSalaryPayload = () =>
    (profile.salary_schedules || [])
      .filter((item) => item.data && item.suma)
      .map((item) => {
        const dateDay = Number(String(item.data).split("-")[2] || item.zi || 1);
        return {
          data: item.data,
          zi: dateDay,
          ocupatie: item.ocupatie || profile.ocupatia || "",
          suma: Number(item.suma),
          moneda: item.moneda || "RON",
          activ: item.activ !== false,
        };
      });

  const updateProfile = async () => {
    try {
      const payload = {
        username: user.username,
        first_name: user.first_name || "",
        last_name: user.last_name || "",
        email: user.email || "",
        profile: {
          poza: prepareMediaValueForApi(profile.poza),
          data_nasterii: profile.data_nasterii || null,
          ocupatia: profile.ocupatia || "",
          telefon: profile.telefon || "",
          venit_estimat: profile.venit_estimat || null,
          venit_estimat_lunar: profile.venit_estimat_lunar || null,
          salary_schedules: buildSalaryPayload(),
        },
      };

      const res = await api.put("profile/", payload);
      const nextProfile = res.data.profile || {};
      const schedules = nextProfile.salary_schedules || [];
      setUser({
        id: res.data.id,
        username: res.data.username || "",
        first_name: res.data.first_name || "",
        last_name: res.data.last_name || "",
        email: res.data.email || "",
      });
      setProfile({
        ...nextProfile,
        salary_schedules: schedules.length ? schedules : [emptySchedule()],
      });
      await loadFinancialData();
      window.dispatchEvent(new Event("profile-updated"));
      setMsg("Profil actualizat.");
    } catch (error) {
      console.error(error);
      setMsg(getApiErrorMessage(error, "Eroare la actualizarea profilului."));
    }
  };

  const changePassword = async () => {
    try {
      await api.post("profile/password/", passwordForm);
      setPasswordForm({
        old_password: "",
        new_password: "",
        confirm_password: "",
      });
      setMsg("Parola a fost schimbata.");
    } catch {
      setMsg("Nu s-a putut schimba parola.");
    }
  };

  const logout = () => {
    localStorage.clear();
    window.location.reload();
  };

  const sendBridge = async () => {
    if (!selectedUser) return;

    try {
      const response = await api.post("bridge/send/", { user_id: selectedUser });
      setSelectedUser("");
      await Promise.all([loadBridgeRequests(), loadBridgeConnections()]);
      setMsg(response.data?.message || "Cerere bridge trimisa.");
    } catch {
      setMsg("Eroare la trimiterea cererii bridge.");
    }
  };

  const acceptBridge = async (id) => {
    try {
      await api.post(`bridge/accept/${id}/`);
      await Promise.all([
        loadBridgeRequests(),
        loadBridgeConnections(),
        loadFinancialData(),
      ]);
      setMsg("Bridge acceptat.");
    } catch {
      setMsg("Eroare la acceptare.");
    }
  };

  const financialSummary = useMemo(() => {
    const buget = financialData.buget || {};
    const venit = toNumber(buget.venit);
    const cheltuieli = toNumber(buget.cheltuieli);
    const economii = toNumber(buget.economii);
    const fonduri = financialData.fonduri || {};

    return {
      venit,
      cheltuieli,
      sold: venit - cheltuieli,
      economii,
      investitEur: toNumber(fonduri.total_eur),
      investitRon: toNumber(fonduri.total_ron),
      perioada: buget.luna || "",
    };
  }, [financialData]);

  const investmentRows = useMemo(() => {
    const totals = RUBRICI.reduce((acc, item) => {
      acc[item.value] = { eur: 0, ron: 0 };
      return acc;
    }, {});

    (financialData.fonduri?.miscari || []).forEach((item) => {
      const key = item.rubrica || "alte_investitii";
      if (!totals[key]) totals[key] = { eur: 0, ron: 0 };
      totals[key].eur += toNumber(item.suma_eur);
      totals[key].ron += toNumber(item.suma_ron);
    });

    return Object.entries(totals)
      .map(([key, value]) => ({ key, label: getRubricaLabel(key), ...value }))
      .filter((item) => item.eur || item.ron);
  }, [financialData.fonduri]);

  const recentInvestments = useMemo(
    () => (financialData.fonduri?.miscari || []).slice(0, 6),
    [financialData.fonduri]
  );

  const topSpending = useMemo(() => {
    const monthKey = getCurrentMonthKey();
    const totals = {};
    const addTotal = (key, label, amount) => {
      if (!totals[key]) totals[key] = { key, label, amount: 0 };
      totals[key].amount += amount;
    };

    financialData.variabile
      .filter((item) => String(item.data || "").slice(0, 7) === monthKey)
      .forEach((item) => {
        const key = item.categorie || "neprevazute";
        addTotal(
          key,
          getCategoryLabel(key),
          convertToEur(item.suma, item.moneda, ronToEurRate)
        );
      });

    const fixedTotal = financialData.fixe
      .filter((item) => String(item.data || "").slice(0, 7) === monthKey)
      .reduce(
        (sum, item) => sum + convertToEur(item.suma, item.moneda, ronToEurRate),
        0
      );

    if (fixedTotal > 0) {
      addTotal("cheltuieli_fixe", "Cheltuieli fixe", fixedTotal);
    }

    return Object.values(totals)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3);
  }, [financialData.fixe, financialData.variabile, ronToEurRate]);

  if (loading) {
    return <div style={styles.container}>Se incarca...</div>;
  }

  if (!user || !profile) {
    return (
      <div style={styles.container}>
        <div style={styles.errorBox}>
          {profileLoadError || "Profilul nu a putut fi incarcat."}
        </div>
      </div>
    );
  }

  const tabs = [
    { key: "profile", label: "Profil utilizator" },
    { key: "financial", label: "Informatii financiare" },
    { key: "consumer", label: "Profil consumator" },
    { key: "bridge", label: "Bridge" },
    { key: "security", label: "Securitate" },
  ];

  const salaryRateLabel =
    rateSource === "BNR" && eurRonRate
      ? `Curs BNR: 1 EUR = ${eurRonRate} RON${rateDate ? ` (${rateDate})` : ""}`
      : "Curs BNR indisponibil, folosesc curs fallback.";

  const renderMetric = (label, value, helper) => (
    <div style={localStyles.metricBox}>
      <div style={localStyles.metricLabel}>{label}</div>
      <div style={localStyles.metricValue}>{value}</div>
      {helper && <div style={localStyles.metricHelper}>{helper}</div>}
    </div>
  );

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Profil utilizator</h2>

      <div style={localStyles.segmentWrapper}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            style={{
              ...localStyles.segmentBtn,
              ...(activeTab === tab.key ? localStyles.segmentBtnActive : {}),
            }}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {msg && <div style={styles.message}>{msg}</div>}

      {activeTab === "profile" && (
        <div style={styles.card}>
          <div style={localStyles.profileHeader}>
            {profilePhotoUrl && !photoLoadError ? (
              <img
                src={profilePhotoUrl}
                alt="Profil"
                style={localStyles.avatar}
                onError={() => setFailedPhotoUrl(profilePhotoUrl)}
              />
            ) : (
              <div style={localStyles.avatarPlaceholder}>Profil</div>
            )}
            <div style={localStyles.profileTitleBlock}>
              <h3 style={styles.sectionTitle}>Date profil</h3>
              <div style={localStyles.mutedText}>
                {user.username || "Cont utilizator"}
              </div>
            </div>
          </div>

          <div style={localStyles.gridTwo}>
            <input
              style={styles.input}
              value={user.last_name}
              onChange={(e) => updateUserField("last_name", e.target.value)}
              placeholder="Nume"
            />
            <input
              style={styles.input}
              value={user.first_name}
              onChange={(e) => updateUserField("first_name", e.target.value)}
              placeholder="Prenume"
            />
          </div>

          <input
            style={styles.input}
            value={user.username}
            onChange={(e) => updateUserField("username", e.target.value)}
            placeholder="Username"
          />

          <div style={localStyles.gridTwo}>
            <input
              style={styles.input}
              value={profile.ocupatia || ""}
              onChange={(e) => updateProfileField("ocupatia", e.target.value)}
              placeholder="Ocupatie optional"
            />
            <input
              style={styles.input}
              value={profile.telefon || ""}
              onChange={(e) => updateProfileField("telefon", e.target.value)}
              placeholder="Numar de telefon optional"
            />
          </div>

          <div style={localStyles.gridTwo}>
            <input
              style={styles.input}
              type="date"
              value={profile.data_nasterii || ""}
              onChange={(e) =>
                updateProfileField("data_nasterii", e.target.value)
              }
            />
            <input
              style={styles.input}
              type="number"
              value={profile.venit_estimat_lunar || ""}
              onChange={(e) =>
                updateProfileField("venit_estimat_lunar", e.target.value)
              }
              placeholder="Venit estimat lunar optional"
            />
          </div>

          <input
            style={styles.input}
            type="email"
            value={user.email}
            onChange={(e) => updateUserField("email", e.target.value)}
            placeholder="Adresa de email"
          />

          <div style={localStyles.photoActions}>
            <label htmlFor="profile-photo-input" style={localStyles.secondaryButton}>
              {profile.poza ? "Schimba poza" : "Incarca poza"}
            </label>
            <input
              id="profile-photo-input"
              style={localStyles.hiddenFileInput}
              type="file"
              accept="image/*"
              onChange={handlePhoto}
            />
            <button
              type="button"
              style={{
                ...localStyles.deletePhotoButton,
                ...(!profile.poza ? localStyles.disabledButton : {}),
              }}
              onClick={removeProfilePhoto}
              disabled={!profile.poza}
            >
              Sterge poza
            </button>
          </div>

          <h3 style={styles.sectionTitle}>Salariu</h3>
          {(profile.salary_schedules || []).map((item, index) => {
            const salaryPreview =
              item.moneda === "RON" && item.suma
                ? round2(toNumber(item.suma) * ronToEurRate)
                : null;

            return (
              <div key={`${item.id || "new"}-${index}`} style={localStyles.salaryBox}>
                <div style={localStyles.gridTwo}>
                  <input
                    style={styles.input}
                    type="number"
                    value={item.suma || ""}
                    onChange={(e) =>
                      updateSchedule(index, "suma", e.target.value)
                    }
                    placeholder="Salariu"
                  />
                  <select
                    style={styles.input}
                    value={item.moneda || "RON"}
                    onChange={(e) =>
                      updateSchedule(index, "moneda", e.target.value)
                    }
                  >
                    <option value="RON">RON / LEI</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
                <div style={localStyles.gridTwo}>
                  <input
                    style={styles.input}
                    type="date"
                    value={item.data || todayIso()}
                    onChange={(e) =>
                      updateSchedule(index, "data", e.target.value)
                    }
                  />
                  <input
                    style={styles.input}
                    value={item.ocupatie || ""}
                    onChange={(e) =>
                      updateSchedule(index, "ocupatie", e.target.value)
                    }
                    placeholder="Ocupatie optional"
                  />
                </div>
                {salaryPreview !== null && (
                  <div style={localStyles.previewText}>
                    Conversie automata: {formatAmount(salaryPreview)}.{" "}
                    {salaryRateLabel}
                  </div>
                )}
                <div style={localStyles.rowActions}>
                  <label style={localStyles.checkRow}>
                    <input
                      type="checkbox"
                      checked={item.activ !== false}
                      onChange={(e) =>
                        updateSchedule(index, "activ", e.target.checked)
                      }
                    />
                    Activ
                  </label>
                  <button
                    style={localStyles.deleteSmallButton}
                    onClick={() => removeSchedule(index)}
                  >
                    Sterge
                  </button>
                </div>
              </div>
            );
          })}

          <div style={localStyles.actionGrid}>
            <button style={localStyles.secondaryButton} onClick={addSchedule}>
              Adauga salariu
            </button>
            <button style={styles.blueButton} onClick={updateProfile}>
              Salveaza profil
            </button>
          </div>
        </div>
      )}

      {activeTab === "financial" && (
        <>
          <div style={localStyles.summaryGrid}>
            {renderMetric("Venit total", formatAmount(financialSummary.venit))}
            {renderMetric("Sold", formatAmount(financialSummary.sold))}
            {renderMetric(
              "Suma cheltuita",
              formatAmount(financialSummary.cheltuieli)
            )}
            {renderMetric(
              "Suma economisita",
              formatAmount(financialSummary.economii)
            )}
            {renderMetric(
              "Suma investita",
              formatAmount(financialSummary.investitEur),
              formatAmount(financialSummary.investitRon, "RON")
            )}
          </div>

          <div style={styles.card}>
            <h3 style={styles.sectionTitle}>Investitii</h3>
            {investmentRows.length === 0 && (
              <div style={styles.message}>Nu exista fonduri investite.</div>
            )}
            {investmentRows.length > 0 && (
              <div style={localStyles.tableWrapper}>
                <table style={localStyles.table}>
                  <thead>
                    <tr>
                      <th style={localStyles.th}>Rubrica</th>
                      <th style={localStyles.th}>Total EUR</th>
                      <th style={localStyles.th}>Total RON</th>
                    </tr>
                  </thead>
                  <tbody>
                    {investmentRows.map((item) => (
                      <tr key={item.key}>
                        <td style={localStyles.td}>{item.label}</td>
                        <td style={localStyles.td}>{formatAmount(item.eur)}</td>
                        <td style={localStyles.td}>
                          {formatAmount(item.ron, "RON")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <h3 style={{ ...styles.sectionTitle, marginTop: 18 }}>
              Ultimele miscari
            </h3>
            {recentInvestments.length === 0 && (
              <div style={styles.message}>Nu exista miscari recente.</div>
            )}
            {recentInvestments.map((item) => (
              <div key={item.id} style={localStyles.infoRow}>
                <div>
                  <div style={localStyles.rowTitle}>
                    {getRubricaLabel(item.rubrica)}
                  </div>
                  <div style={localStyles.mutedText}>{item.data}</div>
                </div>
                <div style={localStyles.rowAmount}>
                  {formatAmount(item.suma_eur)} /{" "}
                  {formatAmount(item.suma_ron, "RON")}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {activeTab === "consumer" && (
        <div style={styles.card}>
          <h3 style={styles.sectionTitle}>Profil consumator</h3>
          {topSpending.length === 0 && (
            <div style={styles.message}>
              Nu exista cheltuieli in luna curenta.
            </div>
          )}
          {topSpending.map((item, index) => (
            <div key={item.key} style={localStyles.rankRow}>
              <div style={localStyles.rankBadge}>{index + 1}</div>
              <div style={localStyles.rankContent}>
                <div style={localStyles.rowTitle}>{item.label}</div>
                <div style={localStyles.mutedText}>Luna curenta</div>
              </div>
              <div style={localStyles.rowAmount}>{formatAmount(item.amount)}</div>
            </div>
          ))}
        </div>
      )}

      {activeTab === "bridge" && (
        <div style={styles.card}>
          <h3 style={styles.sectionTitle}>Bridge utilizatori</h3>
          <div style={localStyles.bridgeGrid}>
            <select
              style={styles.input}
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
            >
              <option value="">Selecteaza utilizator</option>
              {allUsers.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.username}
                </option>
              ))}
            </select>
            <button style={styles.greenButton} onClick={sendBridge}>
              Trimite cerere bridge
            </button>
          </div>

          <h3 style={styles.sectionTitle}>Conexiuni Bridge</h3>
          {bridgeConnections.length === 0 && (
            <div style={styles.message}>Nu exista conexiuni active.</div>
          )}
          {bridgeConnections.map((item) => (
            <div key={item.id} style={localStyles.infoRow}>
              <div>
                <div style={localStyles.rowTitle}>{item.username}</div>
                <div style={localStyles.mutedText}>{item.email || "-"}</div>
              </div>
            </div>
          ))}

          <h3 style={{ ...styles.sectionTitle, marginTop: 18 }}>Cereri primite</h3>
          {bridgeRequests.length === 0 && (
            <div style={styles.message}>Nu ai cereri in asteptare.</div>
          )}
          {bridgeRequests.map((request) => (
            <div key={request.id} style={localStyles.infoRow}>
              <div style={localStyles.rowTitle}>{request.from_user}</div>
              <button
                style={localStyles.acceptButton}
                onClick={() => acceptBridge(request.id)}
              >
                Accepta
              </button>
            </div>
          ))}
        </div>
      )}

      {activeTab === "security" && (
        <div style={styles.card}>
          <h3 style={styles.sectionTitle}>Schimbare parola</h3>
          <input
            style={styles.input}
            type="password"
            value={passwordForm.old_password}
            onChange={(e) =>
              setPasswordForm({ ...passwordForm, old_password: e.target.value })
            }
            placeholder="Parola veche"
          />
          <input
            style={styles.input}
            type="password"
            value={passwordForm.new_password}
            onChange={(e) =>
              setPasswordForm({ ...passwordForm, new_password: e.target.value })
            }
            placeholder="Parola noua"
          />
          <input
            style={styles.input}
            type="password"
            value={passwordForm.confirm_password}
            onChange={(e) =>
              setPasswordForm({
                ...passwordForm,
                confirm_password: e.target.value,
              })
            }
            placeholder="Repeta parola noua"
          />
          <div style={localStyles.actionGrid}>
            <button style={styles.blueButton} onClick={changePassword}>
              Schimba parola
            </button>
            <button style={localStyles.themeLikeButton} onClick={logout}>
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const localStyles = {
  segmentWrapper: {
    width: "100%",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    border: "1px solid var(--app-border)",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 18,
  },
  segmentBtn: {
    border: "none",
    borderRight: "1px solid var(--app-border)",
    background: "var(--app-panel)",
    color: "var(--app-text)",
    padding: "10px",
    fontWeight: 800,
    fontSize: 13,
    cursor: "pointer",
  },
  segmentBtnActive: {
    background: "var(--app-primary-soft)",
    color: "var(--app-primary-dark)",
  },
  profileHeader: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    marginBottom: 18,
  },
  avatar: {
    width: 86,
    height: 86,
    borderRadius: 4,
    objectFit: "cover",
    border: "1px solid var(--app-border)",
  },
  avatarPlaceholder: {
    width: 86,
    height: 86,
    borderRadius: 4,
    border: "1px solid var(--app-border)",
    background: "var(--app-panel-alt)",
    color: "var(--app-muted)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 13,
    fontWeight: 800,
  },
  profileTitleBlock: {
    minWidth: 0,
  },
  gridTwo: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 12,
  },
  salaryBox: {
    border: "1px solid var(--app-border)",
    borderRadius: 4,
    padding: 12,
    marginBottom: 12,
    background: "var(--app-panel-alt)",
  },
  previewText: {
    margin: "-2px 0 10px",
    fontSize: 12,
    color: "var(--app-muted)",
  },
  checkRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontWeight: 700,
    color: "var(--app-text)",
  },
  rowActions: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  actionGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 10,
    marginTop: 10,
  },
  secondaryButton: {
    width: "100%",
    border: "1px solid var(--app-border)",
    background: "var(--app-panel-alt)",
    color: "var(--app-text)",
    borderRadius: 4,
    padding: "10px 14px",
    fontWeight: 800,
    cursor: "pointer",
    textAlign: "center",
  },
  photoActions: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: 10,
    marginBottom: 12,
  },
  hiddenFileInput: {
    display: "none",
  },
  deletePhotoButton: {
    width: "100%",
    border: "1px solid var(--app-danger)",
    background: "var(--app-danger-soft)",
    color: "var(--app-danger)",
    borderRadius: 4,
    padding: "10px 14px",
    fontWeight: 800,
    cursor: "pointer",
  },
  disabledButton: {
    opacity: 0.55,
    cursor: "not-allowed",
  },
  themeLikeButton: {
    border: "1px solid var(--app-border)",
    background: "var(--app-panel-alt)",
    color: "var(--app-text)",
    borderRadius: 4,
    padding: "7px 9px",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
    width: "fit-content",
    minWidth: 86,
    justifySelf: "start",
  },
  deleteSmallButton: {
    border: "1px solid var(--app-danger)",
    background: "var(--app-danger-soft)",
    color: "var(--app-danger)",
    borderRadius: 4,
    padding: "4px 8px",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
    gap: 12,
    marginBottom: 18,
  },
  metricBox: {
    background: "var(--app-panel)",
    border: "1px solid var(--app-border)",
    borderLeft: "4px solid var(--app-primary)",
    borderRadius: 4,
    padding: 14,
  },
  metricLabel: {
    color: "var(--app-muted)",
    fontSize: 13,
    fontWeight: 700,
    marginBottom: 6,
  },
  metricValue: {
    color: "var(--app-text)",
    fontSize: 21,
    fontWeight: 900,
  },
  metricHelper: {
    color: "var(--app-muted)",
    fontSize: 12,
    marginTop: 6,
  },
  tableWrapper: {
    border: "1px solid var(--app-border)",
    borderRadius: 4,
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 14,
  },
  th: {
    padding: "10px 12px",
    borderBottom: "1px solid var(--app-border)",
    background: "var(--app-panel-alt)",
    color: "var(--app-text)",
    textAlign: "left",
  },
  td: {
    padding: "10px 12px",
    borderBottom: "1px solid var(--app-border-soft)",
    color: "var(--app-text)",
  },
  infoRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderBottom: "1px solid var(--app-border-soft)",
    padding: "11px 0",
  },
  rowTitle: {
    color: "var(--app-text)",
    fontWeight: 800,
  },
  rowAmount: {
    color: "var(--app-text)",
    fontWeight: 900,
    textAlign: "right",
    whiteSpace: "nowrap",
  },
  mutedText: {
    color: "var(--app-muted)",
    fontSize: 13,
  },
  rankRow: {
    display: "grid",
    gridTemplateColumns: "38px 1fr auto",
    gap: 12,
    alignItems: "center",
    borderBottom: "1px solid var(--app-border-soft)",
    padding: "12px 0",
  },
  rankBadge: {
    width: 30,
    height: 30,
    borderRadius: 4,
    background: "var(--app-primary-soft)",
    color: "var(--app-primary-dark)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 900,
  },
  rankContent: {
    minWidth: 0,
  },
  bridgeGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(220px, 1fr) minmax(180px, 260px)",
    gap: 10,
    alignItems: "start",
    marginBottom: 18,
  },
  acceptButton: {
    border: "1px solid var(--app-success)",
    background: "var(--app-success)",
    color: "#ffffff",
    borderRadius: 4,
    padding: "7px 10px",
    fontWeight: 800,
    cursor: "pointer",
  },
};
