export const APP_NAME = "Buget & Economii";

const parseUrlList = (value = "") =>
  String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const normalizeApiBaseUrl = (url) => new URL("api/", url).href;

const getSameOriginApiBaseUrl = () => {
  if (typeof window === "undefined") {
    return "http://127.0.0.1:8000/api/";
  }

  return normalizeApiBaseUrl(window.location.origin);
};

const getPortApiBaseUrl = (port) => {
  if (typeof window === "undefined") {
    return `http://127.0.0.1:${port}/api/`;
  }

  const protocol = window.location.protocol?.startsWith("http")
    ? window.location.protocol
    : "http:";
  const hostname = window.location.hostname || "127.0.0.1";
  return `${protocol}//${hostname}:${port}/api/`;
};

const getDefaultApiBaseUrls = () => {
  const urls = [getSameOriginApiBaseUrl()];

  if (typeof window === "undefined" || window.location.port !== "8000") {
    urls.push(getPortApiBaseUrl("8000"));
  }

  return Array.from(new Set(urls));
};

const ENV_API_BASE_URLS = parseUrlList(import.meta.env.VITE_API_BASE_URL);

export const API_BASE_URLS = ENV_API_BASE_URLS.length
  ? ENV_API_BASE_URLS
  : getDefaultApiBaseUrls();

export const API_BASE_URL = API_BASE_URLS[0];

export const INSTALL_APP_URLS = parseUrlList(import.meta.env.VITE_INSTALL_URLS);

export const API_ROOT_URL = new URL("..", API_BASE_URL).href;
export const TOKEN_URL = new URL("token/", API_ROOT_URL).href;
export const PASSWORD_RESET_URL = new URL("password-reset/", API_ROOT_URL).href;
