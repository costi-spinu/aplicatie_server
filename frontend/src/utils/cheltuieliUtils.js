export const categoryLabelMap = {
  alimente: "Alimente",
  sanatate: "Sanatate",
  transport: "Transport",
  cultura: "Cultura",
  shopping: "Shopping",
  neprevazute: "Neprevazute",
  animalute: "Animalute",
  vacanta: "Vacanta",
  divertisment: "Iesiri / Restaurante / Diverse",
  investitii: "Investitii",
  economii: "Economii",
};

export const categoryKeys = Object.keys(categoryLabelMap);
export const RON_TO_EUR_FALLBACK = 0.2;

export const fixedAutomationCadenceOptions = [
  { value: "lunar", label: "O data pe luna" },
  { value: "de_doua_ori_luna", label: "De 2 ori pe luna" },
  { value: "de_trei_ori_luna", label: "De 3 ori pe luna" },
  { value: "la_2_luni", label: "O data la 2 luni" },
  { value: "la_3_luni", label: "O data la 3 luni" },
  { value: "la_6_luni", label: "O data la 6 luni" },
  { value: "anual", label: "O data pe an" },
];

const fixedAutomationCadencesWithStartMonth = new Set([
  "la_2_luni",
  "la_3_luni",
  "la_6_luni",
  "anual",
]);

const fixedAutomationCadenceLabelMap = fixedAutomationCadenceOptions.reduce(
  (acc, option) => {
    acc[option.value] = option.label;
    return acc;
  },
  {}
);

const fixedAutomationMonthIntervals = {
  lunar: 1,
  de_doua_ori_luna: 1,
  de_trei_ori_luna: 1,
  la_2_luni: 2,
  la_3_luni: 3,
  la_6_luni: 6,
  anual: 12,
};

const fixedAutomationDayOffsets = {
  lunar: [0],
  de_doua_ori_luna: [0, 15],
  de_trei_ori_luna: [0, 10, 20],
  la_2_luni: [0],
  la_3_luni: [0],
  la_6_luni: [0],
  anual: [0],
};

const TARGET_STORAGE_KEY = "realizari_targets_v2";
const TARGET_SNAPSHOT_STORAGE_KEY = "realizari_target_snapshots_by_month_v1";
const LEGACY_TARGET_STORAGE_KEY = "realizari_targets_by_month_v1";

export const emptyBudgetSummary = {
  venitBrut: 0,
  deduceriCredite: 0,
  deduceriAutomate: 0,
  deduceriTotal: 0,
  venitNet: 0,
};

export const buildBudgetSummary = (data) => ({
  venitBrut: Number(data?.venit_brut || 0),
  deduceriCredite: Number(data?.deduceri_credite || 0),
  deduceriAutomate: Number(data?.deduceri_automate || 0),
  deduceriTotal: Number(data?.deduceri_total || 0),
  venitNet: Number(data?.venit || 0),
});

export const getCurrentMonthKey = () => new Date().toISOString().slice(0, 7);
export const round2 = (value) => Math.round(Number(value || 0) * 100) / 100;

const getLocalDateParts = (value) => {
  if (typeof value === "string") {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return {
        year: Number(match[1]),
        monthIndex: Number(match[2]) - 1,
        day: Number(match[3]),
      };
    }
  }

  const date = value instanceof Date ? value : new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) return getLocalDateParts(new Date());

  return {
    year: date.getFullYear(),
    monthIndex: date.getMonth(),
    day: date.getDate(),
  };
};

const getCycleAnchor = (year, monthIndex, startDay) => {
  const safeStartDay = Math.min(Math.max(Number(startDay || 26), 1), 31);
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  return new Date(year, monthIndex, Math.min(safeStartDay, lastDay));
};

export const getBudgetCycleKey = (value = new Date(), startDay = 26) => {
  const { year, monthIndex, day } = getLocalDateParts(value);
  const current = new Date(year, monthIndex, day);
  const currentAnchor = getCycleAnchor(year, monthIndex, startDay);
  const nextStart =
    current >= currentAnchor
      ? getCycleAnchor(year, monthIndex + 1, startDay)
      : currentAnchor;
  const cycleEnd = new Date(nextStart);
  cycleEnd.setDate(cycleEnd.getDate() - 1);
  const cycleEndMonth = cycleEnd;
  return `${cycleEndMonth.getFullYear()}-${String(
    cycleEndMonth.getMonth() + 1
  ).padStart(2, "0")}`;
};

export const getBudgetCycleRange = (
  cycleKey = getBudgetCycleKey(),
  startDay = 26
) => {
  const [year, month] = String(cycleKey).split("-").map(Number);
  const safeStartDay = Math.min(Math.max(Number(startDay || 26), 1), 31);
  let start;
  let nextStart;

  if (safeStartDay === 1) {
    start = getCycleAnchor(year, month - 1, safeStartDay);
    nextStart = getCycleAnchor(year, month, safeStartDay);
  } else {
    nextStart = getCycleAnchor(year, month - 1, safeStartDay);
    start = getCycleAnchor(year, month - 2, safeStartDay);
  }

  const end = new Date(nextStart);
  end.setMilliseconds(-1);

  return {
    start,
    end,
  };
};

export const formatBudgetCycleLabel = (cycleKey, startDay = 26) => {
  const { start, end } = getBudgetCycleRange(cycleKey, startDay);
  const formatDate = (date) =>
    `${String(date.getDate()).padStart(2, "0")}.${String(
      date.getMonth() + 1
    ).padStart(2, "0")}.${date.getFullYear()}`;

  return `${formatDate(start)} - ${formatDate(end)}`;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const toUtcDayNumber = (value) =>
  Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()) / MS_PER_DAY;

export const getCurrentCycleElapsedDays = (refDate = new Date(), startDay = 26) => {
  const { start } = getCurrentCycleRange(refDate, startDay);
  const current = toDateOnly(refDate);
  return Math.max(1, Math.floor(toUtcDayNumber(current) - toUtcDayNumber(start)) + 1);
};

export const buildDailyVariableSpend = (
  items = [],
  convertAmountToEur,
  refDate = new Date(),
  startDay = 26
) => {
  const { start } = getCurrentCycleRange(refDate, startDay);
  const current = toDateOnly(refDate);
  const daysElapsed = getCurrentCycleElapsedDays(refDate, startDay);
  const total = items
    .filter((item) => {
      const itemDate = toDateOnly(item.data);
      return (
        itemDate >= start &&
        itemDate <= current &&
        item.categorie !== "vacanta_cheltuita"
      );
    })
    .reduce((acc, item) => acc + convertAmountToEur(item.suma, item.moneda), 0);

  return {
    total: round2(total),
    daysElapsed,
    average: round2(total / daysElapsed),
  };
};

const clampDay = (value) => Math.min(Math.max(Number(value || 1), 1), 31);

export const getDayFromDate = (value) => {
  if (!value) return String(new Date().getDate()).padStart(2, "0");
  return String(clampDay(String(value).split("-")[2])).padStart(2, "0");
};

export const getMonthFromDate = (value) =>
  String(value || "").slice(0, 7) || getCurrentMonthKey();

export const requiresFixedAutomationStartMonth = (cadence) =>
  fixedAutomationCadencesWithStartMonth.has(cadence);

export const buildDateForMonthDay = (monthValue, dayValue) => {
  const [rawYear, rawMonth] = String(monthValue || getCurrentMonthKey())
    .split("-")
    .map((part) => Number(part));
  const today = new Date();
  const year = rawYear || today.getFullYear();
  const month = rawMonth || today.getMonth() + 1;
  const day = clampDay(dayValue);
  const lastDay = new Date(year, month, 0).getDate();

  return `${year}-${String(month).padStart(2, "0")}-${String(
    Math.min(day, lastDay)
  ).padStart(2, "0")}`;
};

export const buildDateForCurrentMonthDay = (dayValue) => {
  return buildDateForMonthDay(getCurrentMonthKey(), dayValue);
};

export const getCurrentCycleRange = (refDate = new Date(), startDay = 26) => {
  return getBudgetCycleRange(
    getBudgetCycleKey(refDate, startDay),
    startDay
  );
};

export const toDateOnly = (value) => {
  const d = new Date(value);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
};

export const toUiCategory = (cat) => (cat === "auto" ? "transport" : cat);
export const toApiCategory = (cat) => (cat === "transport" ? "auto" : cat);
export const getExpenseMonthKey = (item) => String(item.data || "").slice(0, 7);
export const isManualFixedExpense = (item) => item.sursa !== "automat";

export const getFixedAutomationCadenceLabel = (value) =>
  fixedAutomationCadenceLabelMap[value] || value || "-";

export const isRentAutomation = (item) =>
  String(item?.denumire || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .includes("chiri");

const parseIsoDate = (value) => {
  const [year, month, day] = String(value || "")
    .split("-")
    .map((part) => Number(part));
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

const formatIsoDate = (value) =>
  `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(
    value.getDate()
  ).padStart(2, "0")}`;

export const getMonthRange = (monthKey) => {
  const [year, month] = String(monthKey || getCurrentMonthKey())
    .split("-")
    .map((part) => Number(part));
  const safeYear = year || new Date().getFullYear();
  const safeMonthIndex = month ? month - 1 : new Date().getMonth();
  return {
    start: new Date(safeYear, safeMonthIndex, 1),
    end: new Date(safeYear, safeMonthIndex + 1, 0),
  };
};

const addMonths = (baseDate, monthCount) => {
  const next = new Date(baseDate);
  const targetMonth = baseDate.getMonth() + monthCount;
  next.setMonth(targetMonth, 1);
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(baseDate.getDate(), lastDay));
  return next;
};

export const iterFixedAutomationDates = (schedule, start, end) => {
  const scheduleDate = parseIsoDate(schedule?.data);
  if (!scheduleDate || scheduleDate > end) return [];

  const interval = fixedAutomationMonthIntervals[schedule.cursivitate] || 1;
  const monthDelta =
    (start.getFullYear() - scheduleDate.getFullYear()) * 12 +
    start.getMonth() -
    scheduleDate.getMonth();
  let step = Math.max(0, Math.floor(monthDelta / interval) - 1);
  const dates = [];
  const seenDates = new Set();

  while (true) {
    const monthAnchor = addMonths(scheduleDate, step * interval);
    if (monthAnchor > end) break;

    if (monthAnchor >= scheduleDate) {
      const lastDay = new Date(
        monthAnchor.getFullYear(),
        monthAnchor.getMonth() + 1,
        0
      ).getDate();
      const offsets = fixedAutomationDayOffsets[schedule.cursivitate] || [0];

      offsets.forEach((offset) => {
        const occurrence = new Date(
          monthAnchor.getFullYear(),
          monthAnchor.getMonth(),
          Math.min(scheduleDate.getDate() + offset, lastDay)
        );
        const key = formatIsoDate(occurrence);
        if (
          occurrence >= start &&
          occurrence <= end &&
          occurrence >= scheduleDate &&
          !seenDates.has(key)
        ) {
          seenDates.add(key);
          dates.push(key);
        }
      });
    }

    step += 1;
  }

  return dates.sort();
};

export const countFixedAutomationOccurrencesForCurrentMonth = (
  schedule,
  refDate = new Date(),
  cycleRange = null
) => {
  const monthStart = new Date(refDate.getFullYear(), refDate.getMonth(), 1);
  const monthEnd = new Date(
    refDate.getFullYear(),
    refDate.getMonth() + 1,
    0,
    23,
    59,
    59,
    999
  );
  const elapsedEnd = new Date(
    refDate.getFullYear(),
    refDate.getMonth(),
    refDate.getDate(),
    23,
    59,
    59,
    999
  );

  const rangeStart = cycleRange?.start || monthStart;
  const rangeEnd = cycleRange?.end || monthEnd;
  const effectiveEnd =
    schedule?.cursivitate === "lunar"
      ? rangeEnd
      : new Date(Math.min(rangeEnd.getTime(), elapsedEnd.getTime()));

  return iterFixedAutomationDates(
    schedule,
    rangeStart,
    effectiveEnd
  ).length;
};

export const formatExpenseTitle = (item) =>
  item.expenseType === "fixe"
    ? item.descriere || "Cheltuiala fixa"
    : categoryLabelMap[toUiCategory(item.categorie)] || toUiCategory(item.categorie);

export const formatExpenseDescription = (item) =>
  item.expenseType === "variabile" ? String(item.descriere || "").trim() : "";

export const formatExpenseType = (type) =>
  type === "fixe" ? "Fixa" : "Variabila";

const normalizeTargetCategories = (values = {}) =>
  categoryKeys.reduce((acc, key) => {
    const raw = Number(values[key] || 0);
    acc[key] = Number.isFinite(raw) ? raw : 0;
    return acc;
  }, {});

const normalizeTargets = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return {
    fixedTarget: Number(value.fixedTarget || 0),
    categoryTargets: normalizeTargetCategories(value.categoryTargets),
    updatedAt: value.updatedAt || null,
  };
};

export const normalizeApiTarget = (value) =>
  value
    ? {
        fixedTarget: Number(value.fixed_target || 0),
        categoryTargets: normalizeTargetCategories(value.category_targets || {}),
        updatedAt: value.updated_at || null,
      }
    : null;

export const normalizeApiTargetsByMonth = (items = []) =>
  items.reduce((acc, item) => {
    acc[item.luna] = normalizeApiTarget(item);
    return acc;
  }, {});

const parseTargets = (raw) => {
  if (!raw) return null;
  try {
    return normalizeTargets(JSON.parse(raw));
  } catch {
    return null;
  }
};

const parseTargetSnapshots = (raw) => {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) || {};
    return Object.entries(parsed).reduce((acc, [monthKey, targets]) => {
      const normalized = normalizeTargets(targets);
      if (normalized) acc[monthKey] = normalized;
      return acc;
    }, {});
  } catch {
    return {};
  }
};

export const loadTargetState = () => {
  const savedTargets = parseTargets(localStorage.getItem(TARGET_STORAGE_KEY));
  const snapshots = {
    ...parseTargetSnapshots(localStorage.getItem(LEGACY_TARGET_STORAGE_KEY)),
    ...parseTargetSnapshots(localStorage.getItem(TARGET_SNAPSHOT_STORAGE_KEY)),
  };

  return { savedTargets, snapshots };
};

const getLatestTargetsAtOrBefore = (snapshots, monthKey) => {
  const snapshotKey = Object.keys(snapshots)
    .filter((key) => key <= monthKey)
    .sort((a, b) => b.localeCompare(a))[0];

  return snapshotKey ? snapshots[snapshotKey] : null;
};

export const getTargetsForMonth = ({ savedTargets, snapshots }, monthKey) => {
  if (monthKey === getCurrentMonthKey() && savedTargets) {
    return savedTargets;
  }

  return (
    snapshots[monthKey] ||
    getLatestTargetsAtOrBefore(snapshots, monthKey) ||
    savedTargets
  );
};

export const getApiErrorMessage = (error, fallback) => {
  if (error?.response?.status === 401) {
    return "Sesiunea a expirat sau nu esti autentificat. Delogheaza-te si intra din nou in cont.";
  }

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

export const upsertById = (items, nextItem) => {
  const exists = items.some((item) => item.id === nextItem.id);
  if (!exists) return [nextItem, ...items];
  return items.map((item) => (item.id === nextItem.id ? nextItem : item));
};

export const applyExpenseRefreshOverrides = (
  items,
  expenseType,
  { preserveExpense, removeExpense } = {}
) => {
  let nextItems = Array.isArray(items) ? items : [];

  if (removeExpense?.type === expenseType) {
    nextItems = nextItems.filter((item) => item.id !== removeExpense.id);
  }

  if (preserveExpense?.type === expenseType && preserveExpense.item) {
    nextItems = upsertById(nextItems, preserveExpense.item);
  }

  return nextItems;
};

export const notifyFinanceDataChanged = () => {
  window.dispatchEvent(new Event("finance-data-updated"));
};
