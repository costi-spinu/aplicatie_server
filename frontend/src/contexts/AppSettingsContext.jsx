/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ADDITIONAL_TRANSLATIONS,
  PREFIX_TRANSLATIONS,
  SUFFIX_TRANSLATIONS,
} from "./translationsExtra";

export const LANGUAGES = [
  { code: "ro", label: "Romana" },
  { code: "en", label: "English" },
  { code: "de", label: "Deutsch" },
  { code: "fr", label: "Francais" },
  { code: "it", label: "Italiano" },
];

const TRANSLATIONS = {
  "Se incarca...": {
    en: "Loading...",
    de: "Wird geladen...",
    fr: "Chargement...",
    it: "Caricamento...",
  },
  Inapoi: { en: "Back", de: "Zuruck", fr: "Retour", it: "Indietro" },
  Limba: { en: "Language", de: "Sprache", fr: "Langue", it: "Lingua" },
  Tema: { en: "Theme", de: "Design", fr: "Theme", it: "Tema" },
  "Tema alba": {
    en: "Light theme",
    de: "Helles Design",
    fr: "Theme clair",
    it: "Tema chiaro",
  },
  "Tema neagra": {
    en: "Dark theme",
    de: "Dunkles Design",
    fr: "Theme sombre",
    it: "Tema scuro",
  },
  "Buget & Economii": {
    en: "Budget & Savings",
    de: "Budget & Sparen",
    fr: "Budget & Epargne",
    it: "Budget & Risparmi",
  },
  "Meniu principal": {
    en: "Main menu",
    de: "Hauptmenu",
    fr: "Menu principal",
    it: "Menu principale",
  },
  "Planificare financiara personala": {
    en: "Personal financial planning",
    de: "Personliche Finanzplanung",
    fr: "Planification financiere personnelle",
    it: "Pianificazione finanziaria personale",
  },
  Cont: { en: "Account", de: "Konto", fr: "Compte", it: "Account" },
  Deschide: { en: "Open", de: "Offnen", fr: "Ouvrir", it: "Apri" },
  Logout: { en: "Logout", de: "Abmelden", fr: "Deconnexion", it: "Logout" },
  Venit: { en: "Income", de: "Einnahmen", fr: "Revenus", it: "Entrate" },
  Cheltuieli: { en: "Expenses", de: "Ausgaben", fr: "Depenses", it: "Spese" },
  "Economii si vacanta": {
    en: "Savings and vacation",
    de: "Sparen und Urlaub",
    fr: "Epargne et vacances",
    it: "Risparmi e vacanza",
  },
  "Fonduri investitii": {
    en: "Investment funds",
    de: "Investmentfonds",
    fr: "Fonds d'investissement",
    it: "Fondi investimento",
  },
  "Obiective cheltuieli": {
    en: "Expense goals",
    de: "Ausgabenziele",
    fr: "Objectifs de depenses",
    it: "Obiettivi di spesa",
  },
  Administrare: {
    en: "Administration",
    de: "Verwaltung",
    fr: "Administration",
    it: "Amministrazione",
  },
  "Profil utilizator": {
    en: "User profile",
    de: "Benutzerprofil",
    fr: "Profil utilisateur",
    it: "Profilo utente",
  },
  "Date venit": {
    en: "Income data",
    de: "Einnahmendaten",
    fr: "Donnees revenus",
    it: "Dati entrate",
  },
  "Istoric venit": {
    en: "Income history",
    de: "Einnahmenverlauf",
    fr: "Historique revenus",
    it: "Storico entrate",
  },
  Inregistrari: {
    en: "Records",
    de: "Eintrage",
    fr: "Enregistrements",
    it: "Registrazioni",
  },
  "Inregistrari luna curenta": {
    en: "Current month records",
    de: "Eintrage des aktuellen Monats",
    fr: "Enregistrements du mois en cours",
    it: "Registrazioni del mese corrente",
  },
  "Adauga venit": {
    en: "Add income",
    de: "Einnahme hinzufugen",
    fr: "Ajouter revenu",
    it: "Aggiungi entrata",
  },
  "Modifica venit": {
    en: "Edit income",
    de: "Einnahme bearbeiten",
    fr: "Modifier revenu",
    it: "Modifica entrata",
  },
  "Salveaza modificarea": {
    en: "Save change",
    de: "Anderung speichern",
    fr: "Enregistrer la modification",
    it: "Salva modifica",
  },
  "Adauga": { en: "Add", de: "Hinzufugen", fr: "Ajouter", it: "Aggiungi" },
  "Adauga inregistrare": {
    en: "Add record",
    de: "Eintrag hinzufugen",
    fr: "Ajouter enregistrement",
    it: "Aggiungi registrazione",
  },
  "Modifica inregistrare": {
    en: "Edit record",
    de: "Eintrag bearbeiten",
    fr: "Modifier enregistrement",
    it: "Modifica registrazione",
  },
  Salveaza: { en: "Save", de: "Speichern", fr: "Enregistrer", it: "Salva" },
  Sterge: { en: "Delete", de: "Loschen", fr: "Supprimer", it: "Elimina" },
  Edit: { en: "Edit", de: "Bearbeiten", fr: "Modifier", it: "Modifica" },
  "Export Excel": {
    en: "Export Excel",
    de: "Excel exportieren",
    fr: "Exporter Excel",
    it: "Esporta Excel",
  },
  "Export PDF": {
    en: "Export PDF",
    de: "PDF exportieren",
    fr: "Exporter PDF",
    it: "Esporta PDF",
  },
  "Descarca Excel": {
    en: "Download Excel",
    de: "Excel herunterladen",
    fr: "Telecharger Excel",
    it: "Scarica Excel",
  },
  "Descarca PDF": {
    en: "Download PDF",
    de: "PDF herunterladen",
    fr: "Telecharger PDF",
    it: "Scarica PDF",
  },
  "Fonduri": { en: "Funds", de: "Fonds", fr: "Fonds", it: "Fondi" },
  "Fonduri investite": {
    en: "Invested funds",
    de: "Investierte Fonds",
    fr: "Fonds investis",
    it: "Fondi investiti",
  },
  "Total pe rubrici": {
    en: "Totals by category",
    de: "Summen nach Kategorie",
    fr: "Totaux par categorie",
    it: "Totali per categoria",
  },
  Rubrica: { en: "Category", de: "Kategorie", fr: "Categorie", it: "Categoria" },
  "Rubrica:": {
    en: "Category:",
    de: "Kategorie:",
    fr: "Categorie:",
    it: "Categoria:",
  },
  "Istoric fonduri": {
    en: "Funds history",
    de: "Fondsverlauf",
    fr: "Historique fonds",
    it: "Storico fondi",
  },
  "Export fonduri": {
    en: "Funds export",
    de: "Fonds exportieren",
    fr: "Export fonds",
    it: "Export fondi",
  },
  "Adauga fonduri": {
    en: "Add funds",
    de: "Fonds hinzufugen",
    fr: "Ajouter fonds",
    it: "Aggiungi fondi",
  },
  Retrage: { en: "Withdraw", de: "Abheben", fr: "Retirer", it: "Preleva" },
  Observatii: { en: "Notes", de: "Notizen", fr: "Notes", it: "Note" },
  "Suma EUR": {
    en: "Amount EUR",
    de: "Betrag EUR",
    fr: "Montant EUR",
    it: "Importo EUR",
  },
  "Suma RON": {
    en: "Amount RON",
    de: "Betrag RON",
    fr: "Montant RON",
    it: "Importo RON",
  },
  Suma: { en: "Amount", de: "Betrag", fr: "Montant", it: "Importo" },
  Data: { en: "Date", de: "Datum", fr: "Date", it: "Data" },
  Moneda: { en: "Currency", de: "Wahrung", fr: "Devise", it: "Valuta" },
  Utilizator: { en: "User", de: "Benutzer", fr: "Utilisateur", it: "Utente" },
  "Economii": { en: "Savings", de: "Sparen", fr: "Epargne", it: "Risparmi" },
  "Total economisit": {
    en: "Total saved",
    de: "Gesamt gespart",
    fr: "Total epargne",
    it: "Totale risparmiato",
  },
  "Istoric economii lunare": {
    en: "Monthly savings history",
    de: "Monatlicher Sparverlauf",
    fr: "Historique epargne mensuelle",
    it: "Storico risparmi mensili",
  },
  "Economii vacanta": {
    en: "Vacation savings",
    de: "Urlaubssparen",
    fr: "Epargne vacances",
    it: "Risparmi vacanza",
  },
  "Cheltuieli vacanta": {
    en: "Vacation expenses",
    de: "Urlaubsausgaben",
    fr: "Depenses vacances",
    it: "Spese vacanza",
  },
  "Adauga economii vacanta": {
    en: "Add vacation savings",
    de: "Urlaubssparen hinzufugen",
    fr: "Ajouter epargne vacances",
    it: "Aggiungi risparmi vacanza",
  },
  "Adauga cheltuiala": {
    en: "Add expense",
    de: "Ausgabe hinzufugen",
    fr: "Ajouter depense",
    it: "Aggiungi spesa",
  },
  "Salveaza cheltuiala": {
    en: "Save expense",
    de: "Ausgabe speichern",
    fr: "Enregistrer depense",
    it: "Salva spesa",
  },
  "Total pus deoparte": {
    en: "Total set aside",
    de: "Gesamt zuruckgelegt",
    fr: "Total mis de cote",
    it: "Totale accantonato",
  },
  "Total cheltuit": {
    en: "Total spent",
    de: "Gesamt ausgegeben",
    fr: "Total depense",
    it: "Totale speso",
  },
  Ramas: { en: "Remaining", de: "Verbleibend", fr: "Restant", it: "Rimanente" },
  "Luna curenta": {
    en: "Current month",
    de: "Aktueller Monat",
    fr: "Mois en cours",
    it: "Mese corrente",
  },
  "Ciclul curent": {
    en: "Current cycle",
    de: "Aktueller Zyklus",
    fr: "Cycle en cours",
    it: "Ciclo corrente",
  },
  Istoric: { en: "History", de: "Verlauf", fr: "Historique", it: "Storico" },
  "Selecteaza luna": {
    en: "Select month",
    de: "Monat auswahlen",
    fr: "Selectionner le mois",
    it: "Seleziona mese",
  },
  "Selecteaza ciclul": {
    en: "Select cycle",
    de: "Zyklus auswahlen",
    fr: "Selectionner le cycle",
    it: "Seleziona ciclo",
  },
  "Obiective lunare": {
    en: "Monthly goals",
    de: "Monatliche Ziele",
    fr: "Objectifs mensuels",
    it: "Obiettivi mensili",
  },
  "Obiective pe ciclu": {
    en: "Goals by cycle",
    de: "Ziele pro Zyklus",
    fr: "Objectifs par cycle",
    it: "Obiettivi per ciclo",
  },
  "Tinta totala": {
    en: "Total target",
    de: "Gesamtziel",
    fr: "Objectif total",
    it: "Obiettivo totale",
  },
  "Cheltuit total": {
    en: "Total spent",
    de: "Gesamt ausgegeben",
    fr: "Total depense",
    it: "Totale speso",
  },
  "Cheltuieli variabile pe subcategorii": {
    en: "Variable expenses by subcategory",
    de: "Variable Ausgaben nach Unterkategorie",
    fr: "Depenses variables par sous-categorie",
    it: "Spese variabili per sottocategoria",
  },
  "Salveaza obiective": {
    en: "Save goals",
    de: "Ziele speichern",
    fr: "Enregistrer objectifs",
    it: "Salva obiettivi",
  },
  Alimente: { en: "Food", de: "Lebensmittel", fr: "Alimentation", it: "Alimenti" },
  Sanatate: { en: "Health", de: "Gesundheit", fr: "Sante", it: "Salute" },
  Transport: { en: "Transport", de: "Transport", fr: "Transport", it: "Trasporti" },
  Cultura: { en: "Culture", de: "Kultur", fr: "Culture", it: "Cultura" },
  Shopping: { en: "Shopping", de: "Shopping", fr: "Shopping", it: "Shopping" },
  Neprevazute: {
    en: "Unexpected",
    de: "Unerwartet",
    fr: "Imprevus",
    it: "Imprevisti",
  },
  Animalute: { en: "Pets", de: "Haustiere", fr: "Animaux", it: "Animali" },
  Vacanta: { en: "Vacation", de: "Urlaub", fr: "Vacances", it: "Vacanza" },
  "Iesiri / Restaurante / Diverse": {
    en: "Outings / Restaurants / Misc",
    de: "Ausgehen / Restaurants / Sonstiges",
    fr: "Sorties / Restaurants / Divers",
    it: "Uscite / Ristoranti / Varie",
  },
  Investitii: {
    en: "Investments",
    de: "Investitionen",
    fr: "Investissements",
    it: "Investimenti",
  },
  Salariu: {
    en: "Salary",
    de: "Gehalt",
    fr: "Salaire",
    it: "Stipendio",
  },
  "Adauga salariu": {
    en: "Add salary",
    de: "Gehalt hinzufugen",
    fr: "Ajouter salaire",
    it: "Aggiungi stipendio",
  },
  "Modifica salariu": {
    en: "Edit salary",
    de: "Gehalt bearbeiten",
    fr: "Modifier salaire",
    it: "Modifica stipendio",
  },
  "Salveaza salariu": {
    en: "Save salary",
    de: "Gehalt speichern",
    fr: "Enregistrer salaire",
    it: "Salva stipendio",
  },
  "Salarii automate": {
    en: "Automatic salaries",
    de: "Automatische Gehalter",
    fr: "Salaires automatiques",
    it: "Stipendi automatici",
  },
  Activ: { en: "Active", de: "Aktiv", fr: "Actif", it: "Attivo" },
  Anuleaza: { en: "Cancel", de: "Abbrechen", fr: "Annuler", it: "Annulla" },
  "Informatii financiare": {
    en: "Financial information",
    de: "Finanzinformationen",
    fr: "Informations financieres",
    it: "Informazioni finanziarie",
  },
  "Profil consumator": {
    en: "Consumer profile",
    de: "Verbraucherprofil",
    fr: "Profil consommateur",
    it: "Profilo consumatore",
  },
  Securitate: {
    en: "Security",
    de: "Sicherheit",
    fr: "Securite",
    it: "Sicurezza",
  },
  "Date profil": {
    en: "Profile data",
    de: "Profildaten",
    fr: "Donnees profil",
    it: "Dati profilo",
  },
  Nume: { en: "Last name", de: "Nachname", fr: "Nom", it: "Cognome" },
  Prenume: { en: "First name", de: "Vorname", fr: "Prenom", it: "Nome" },
  Username: {
    en: "Username",
    de: "Benutzername",
    fr: "Nom utilisateur",
    it: "Nome utente",
  },
  "Ocupatie optional": {
    en: "Occupation optional",
    de: "Beruf optional",
    fr: "Profession optionnelle",
    it: "Occupazione opzionale",
  },
  "Numar de telefon optional": {
    en: "Phone number optional",
    de: "Telefonnummer optional",
    fr: "Numero de telephone optionnel",
    it: "Numero di telefono opzionale",
  },
  "Adresa de email": {
    en: "Email address",
    de: "E-Mail-Adresse",
    fr: "Adresse email",
    it: "Indirizzo email",
  },
  "Salveaza profil": {
    en: "Save profile",
    de: "Profil speichern",
    fr: "Enregistrer profil",
    it: "Salva profilo",
  },
  "Sterge poza profil": {
    en: "Delete profile photo",
    de: "Profilfoto loschen",
    fr: "Supprimer photo profil",
    it: "Elimina foto profilo",
  },
  "Venit total": {
    en: "Total income",
    de: "Gesamteinnahmen",
    fr: "Revenu total",
    it: "Entrate totali",
  },
  Sold: { en: "Balance", de: "Saldo", fr: "Solde", it: "Saldo" },
  "Suma cheltuita": {
    en: "Amount spent",
    de: "Ausgegebener Betrag",
    fr: "Somme depensee",
    it: "Somma spesa",
  },
  "Suma economisita": {
    en: "Amount saved",
    de: "Gesparter Betrag",
    fr: "Somme epargnee",
    it: "Somma risparmiata",
  },
  "Suma investita": {
    en: "Amount invested",
    de: "Investierter Betrag",
    fr: "Somme investie",
    it: "Somma investita",
  },
  "Ultimele miscari": {
    en: "Latest movements",
    de: "Letzte Bewegungen",
    fr: "Derniers mouvements",
    it: "Ultimi movimenti",
  },
  "Bridge utilizatori": {
    en: "User Bridge",
    de: "Benutzer-Bridge",
    fr: "Bridge utilisateurs",
    it: "Bridge utenti",
  },
  "Conexiuni Bridge": {
    en: "Bridge connections",
    de: "Bridge-Verbindungen",
    fr: "Connexions Bridge",
    it: "Connessioni Bridge",
  },
  "Trimite cerere bridge": {
    en: "Send bridge request",
    de: "Bridge-Anfrage senden",
    fr: "Envoyer demande bridge",
    it: "Invia richiesta bridge",
  },
  "Cereri primite": {
    en: "Received requests",
    de: "Erhaltene Anfragen",
    fr: "Demandes recues",
    it: "Richieste ricevute",
  },
  Accepta: { en: "Accept", de: "Akzeptieren", fr: "Accepter", it: "Accetta" },
  "Schimbare parola": {
    en: "Change password",
    de: "Passwort andern",
    fr: "Changer mot de passe",
    it: "Cambia password",
  },
  "Schimba parola": {
    en: "Change password",
    de: "Passwort andern",
    fr: "Changer mot de passe",
    it: "Cambia password",
  },
  Instalare: {
    en: "Install",
    de: "Installieren",
    fr: "Installer",
    it: "Installa",
  },
  "Instalare aplicatie": {
    en: "Install app",
    de: "App installieren",
    fr: "Installer application",
    it: "Installa applicazione",
  },
  Inchide: { en: "Close", de: "Schliessen", fr: "Fermer", it: "Chiudi" },
  "Adresa aplicatie": {
    en: "App address",
    de: "App-Adresse",
    fr: "Adresse application",
    it: "Indirizzo applicazione",
  },
  "Copiaza link": {
    en: "Copy link",
    de: "Link kopieren",
    fr: "Copier lien",
    it: "Copia link",
  },
  "Link copiat": {
    en: "Link copied",
    de: "Link kopiert",
    fr: "Lien copie",
    it: "Link copiato",
  },
  "Copiaza manual": {
    en: "Copy manually",
    de: "Manuell kopieren",
    fr: "Copier manuellement",
    it: "Copia manualmente",
  },
  "Instaleaza pe dispozitiv": {
    en: "Install on device",
    de: "Auf Gerat installieren",
    fr: "Installer sur appareil",
    it: "Installa sul dispositivo",
  },
  "Aplicatie instalata": {
    en: "App installed",
    de: "App installiert",
    fr: "Application installee",
    it: "Applicazione installata",
  },
  "QR indisponibil": {
    en: "QR unavailable",
    de: "QR nicht verfugbar",
    fr: "QR indisponible",
    it: "QR non disponibile",
  },
  ...ADDITIONAL_TRANSLATIONS,
};

const textNodeStates = new WeakMap();
const attributeStates = new WeakMap();

const normalizeKey = (value) => String(value || "").trim().replace(/\s+/g, " ");

export const translateText = (value, language = "ro") => {
  if (!value || language === "ro") return value;
  const raw = String(value);
  const key = normalizeKey(raw);
  const leading = raw.match(/^\s*/)?.[0] || "";
  const trailing = raw.match(/\s*$/)?.[0] || "";
  const translated = TRANSLATIONS[key]?.[language];
  if (translated) return `${leading}${translated}${trailing}`;

  const prefix = PREFIX_TRANSLATIONS.find((item) => key.startsWith(item.ro));
  if (prefix?.[language]) {
    return `${leading}${prefix[language]}${key.slice(prefix.ro.length)}${trailing}`;
  }

  const suffix = SUFFIX_TRANSLATIONS.find((item) => key.endsWith(item.ro));
  if (suffix?.[language]) {
    return `${leading}${key.slice(0, -suffix.ro.length)}${suffix[language]}${trailing}`;
  }

  return value;
};

export const translateCurrentText = (value) => {
  const language =
    typeof window === "undefined" ? "ro" : localStorage.getItem("app_language") || "ro";
  return translateText(value, language);
};

const AppSettingsContext = createContext({
  language: "ro",
  setLanguage: () => {},
  colorMode: "light",
  setColorMode: () => {},
  toggleColorMode: () => {},
  t: (value) => value,
});

function translateDocument(language) {
  if (typeof document === "undefined") return;

  const root = document.getElementById("root");
  if (!root) return;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      if (["SCRIPT", "STYLE", "NOSCRIPT"].includes(parent.tagName)) {
        return NodeFilter.FILTER_REJECT;
      }
      if (!normalizeKey(node.nodeValue)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);

  nodes.forEach((node) => {
    const currentValue = node.nodeValue;
    let state = textNodeStates.get(node);

    if (!state || currentValue !== state.rendered) {
      state = { original: currentValue, rendered: currentValue };
      textNodeStates.set(node, state);
    }

    const nextValue = translateText(state.original, language);
    state.rendered = nextValue;
    if (currentValue !== nextValue) {
      node.nodeValue = nextValue;
    }
  });

  root.querySelectorAll("[placeholder], [title], [aria-label]").forEach((element) => {
    let states = attributeStates.get(element);
    if (!states) {
      states = new Map();
      attributeStates.set(element, states);
    }

    ["placeholder", "title", "aria-label"].forEach((attr) => {
      if (!element.hasAttribute(attr)) return;
      const currentValue = element.getAttribute(attr);
      let state = states.get(attr);

      if (!state || currentValue !== state.rendered) {
        state = { original: currentValue, rendered: currentValue };
        states.set(attr, state);
      }

      const nextValue = translateText(state.original, language);
      state.rendered = nextValue;
      if (currentValue !== nextValue) {
        element.setAttribute(attr, nextValue);
      }
    });
  });
}

function TranslationRuntime({ language }) {
  const frameRef = useRef(null);

  const scheduleTranslate = useCallback(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(() => translateDocument(language));
  }, [language]);

  useEffect(() => {
    scheduleTranslate();
    const root = document.getElementById("root");
    if (!root) return undefined;

    const observer = new MutationObserver(scheduleTranslate);
    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["placeholder", "title", "aria-label"],
    });

    return () => {
      observer.disconnect();
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [language, scheduleTranslate]);

  return null;
}

export function AppSettingsProvider({ children }) {
  const [language, setLanguageState] = useState(
    () => localStorage.getItem("app_language") || "ro"
  );
  const [colorMode, setColorModeState] = useState(
    () => localStorage.getItem("app_theme") || "light"
  );

  const setLanguage = useCallback((value) => {
    const next = LANGUAGES.some((item) => item.code === value) ? value : "ro";
    localStorage.setItem("app_language", next);
    setLanguageState(next);
  }, []);

  const setColorMode = useCallback((value) => {
    const next = value === "dark" ? "dark" : "light";
    localStorage.setItem("app_theme", next);
    setColorModeState(next);
  }, []);

  const toggleColorMode = useCallback(() => {
    setColorMode(colorMode === "dark" ? "light" : "dark");
  }, [colorMode, setColorMode]);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    document.documentElement.dataset.theme = colorMode;
  }, [colorMode]);

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      colorMode,
      setColorMode,
      toggleColorMode,
      t: (text) => translateText(text, language),
    }),
    [colorMode, language, setColorMode, setLanguage, toggleColorMode]
  );

  return (
    <AppSettingsContext.Provider value={value}>
      {children}
      <TranslationRuntime language={language} />
    </AppSettingsContext.Provider>
  );
}

export const useAppSettings = () => useContext(AppSettingsContext);
