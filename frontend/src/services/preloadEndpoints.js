export const VENIT_DATA_ENDPOINTS = [
  "venituri/",
  "me/",
  "salary-schedules/",
  "credite/",
  "perioada-bugetara/",
  "arhive/",
  "buget/lunar/",
];

export const VENIT_ENDPOINTS = ["curs-bnr/", ...VENIT_DATA_ENDPOINTS];

export const CHELTUIELI_DATA_ENDPOINTS = [
  "cheltuieli-fixe/",
  "cheltuieli-variabile/",
  "cheltuieli-fixe-automate/",
  "perioada-bugetara/",
  "buget/lunar/",
];

export const CHELTUIELI_ENDPOINTS = [
  "curs-bnr/",
  ...CHELTUIELI_DATA_ENDPOINTS,
];

export const ECONOMII_ENDPOINTS = [
  "cheltuieli-variabile/",
  "economii/istoric/",
  "economii/vacanta/",
];

export const FONDURI_OWN_CACHE_PARAMS = { scope: "personal-v2" };

export const FONDURI_ENDPOINTS = [
  { url: "fonduri/", params: FONDURI_OWN_CACHE_PARAMS },
  "fonduri/bridge/",
  { url: "fonduri/categorii/", params: FONDURI_OWN_CACHE_PARAMS },
  { url: "investitii-automate/", params: FONDURI_OWN_CACHE_PARAMS },
];

export const REALIZARI_TARGET_ENDPOINTS = [
  "realizari-targets/",
  "obiective-cheltuieli-global/",
  "perioada-bugetara/",
];

export const REALIZARI_EXPENSE_ENDPOINTS = [
  "cheltuieli-fixe/",
  "cheltuieli-variabile/",
];

export const REALIZARI_ENDPOINTS = [
  ...REALIZARI_TARGET_ENDPOINTS,
  ...REALIZARI_EXPENSE_ENDPOINTS,
];

export const PROFIL_ENDPOINTS = [
  "profile/",
  "users/list/",
  "bridge/requests/",
  "bridge/connections/",
  "buget/lunar/",
  "venituri/",
  "cheltuieli-fixe/",
  "cheltuieli-variabile/",
  "fonduri/",
  "curs-bnr/",
];

export const PAGE_PRELOAD_ENDPOINTS = {
  venit: VENIT_ENDPOINTS,
  cheltuieli: CHELTUIELI_ENDPOINTS,
  economii: ECONOMII_ENDPOINTS,
  fonduri: FONDURI_ENDPOINTS,
  realizari: REALIZARI_ENDPOINTS,
  profil: PROFIL_ENDPOINTS,
};
