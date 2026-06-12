export const APP_NAME = "Buget & Economii";

const parseUrlList = (value = "") =>
  String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const getDefaultApiBaseUrl = () => {
  if (typeof window === "undefined") {
    return "http://127.0.0.1:8000/api/";
  }

  const protocol = window.location.protocol?.startsWith("http")
    ? window.location.protocol
    : "http:";
  const hostname = window.location.hostname || "127.0.0.1";
  return `${protocol}//${hostname}:8000/api/`;
};

const DEFAULT_API_BASE_URL = getDefaultApiBaseUrl();

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL;

export const INSTALL_APP_URLS = parseUrlList(import.meta.env.VITE_INSTALL_URLS);

export const API_ROOT_URL = new URL("..", API_BASE_URL).href;
export const TOKEN_URL = new URL("token/", API_ROOT_URL).href;
export const PASSWORD_RESET_URL = new URL("password-reset/", API_ROOT_URL).href;
