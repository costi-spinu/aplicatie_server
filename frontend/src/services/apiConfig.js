import axios from "axios";
import { API_BASE_URL, API_BASE_URLS } from "../helpers/appConstants";

const api = axios.create({
  baseURL: API_BASE_URL,
});

const responseCache = new Map();

const normalizeCacheKey = (url = "", params = {}) => {
  const cleanParams = Object.entries(params || {})
    .filter(([key]) => key !== "_fresh")
    .sort(([left], [right]) => left.localeCompare(right));

  const query = cleanParams
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(String(value ?? ""))}`
    )
    .join("&");

  return query ? `${url}?${query}` : url;
};

export const getCachedApiData = (url, params) =>
  responseCache.get(normalizeCacheKey(url, params));

export const setCachedApiData = (url, data, params) => {
  if (!url) return;
  responseCache.set(normalizeCacheKey(url, params), data);
};

export const clearApiDataCache = () => {
  responseCache.clear();
};

export const preloadApiData = async (endpoints = [], options = {}) => {
  const force = options.force === true;
  const requests = endpoints
    .map((entry) => (typeof entry === "string" ? { url: entry } : entry))
    .filter((entry) => entry?.url)
    .filter((entry) => force || getCachedApiData(entry.url, entry.params) === undefined)
    .map((entry) => api.get(entry.url, { params: entry.params }));

  if (requests.length === 0) return [];
  return Promise.allSettled(requests);
};

api.interceptors.request.use((config) => {
  const method = String(config.method || "get").toLowerCase();

  config.headers = config.headers || {};
  if (method === "get") {
    config.headers["Cache-Control"] = "no-cache, no-store, max-age=0";
    config.headers.Pragma = "no-cache";
    config.headers.Expires = "0";
    config.params = {
      ...(config.params || {}),
      _fresh: Date.now(),
    };
  }

  const token = localStorage.getItem("access");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const getRetryIndex = (config = {}) => config.__apiBaseUrlRetryIndex ?? 0;

const getNextApiBaseUrl = (config = {}) => {
  const nextRetryIndex = getRetryIndex(config) + 1;
  if (nextRetryIndex >= API_BASE_URLS.length) {
    return null;
  }

  return {
    baseURL: API_BASE_URLS[nextRetryIndex],
    retryIndex: nextRetryIndex,
  };
};

const requestNextApiBaseUrl = (config) => {
  const next = getNextApiBaseUrl(config);
  if (!next) {
    return null;
  }

  return api.request({
    ...config,
    baseURL: next.baseURL,
    __apiBaseUrlRetryIndex: next.retryIndex,
  });
};

const isHtmlResponse = (response) => {
  const contentType = String(response.headers?.["content-type"] || "").toLowerCase();
  if (contentType.includes("text/html")) {
    return true;
  }

  if (typeof response.data !== "string") {
    return false;
  }

  const trimmedData = response.data.trim().toLowerCase();
  return trimmedData.startsWith("<!doctype html") || trimmedData.startsWith("<html");
};

const shouldTryNextApiBaseUrl = (error) => {
  if (!error.config || !getNextApiBaseUrl(error.config)) {
    return false;
  }

  if (!error.response) {
    return true;
  }

  return [404, 405].includes(error.response.status) || isHtmlResponse(error.response);
};

const rememberWorkingApiBaseUrl = (response) => {
  const responseBaseUrl = response.config?.baseURL;
  if (responseBaseUrl && api.defaults.baseURL !== responseBaseUrl) {
    api.defaults.baseURL = responseBaseUrl;
  }
};

api.interceptors.response.use(
  (response) => {
    if (isHtmlResponse(response)) {
      const retryRequest = requestNextApiBaseUrl(response.config);
      if (retryRequest) {
        return retryRequest;
      }
    }

    rememberWorkingApiBaseUrl(response);
    const method = String(response.config?.method || "get").toLowerCase();
    if (method === "get") {
      setCachedApiData(response.config?.url, response.data, response.config?.params);
    } else if (["post", "put", "patch", "delete"].includes(method)) {
      clearApiDataCache();
    }
    return response;
  },
  async (error) => {
    if (!shouldTryNextApiBaseUrl(error)) {
      return Promise.reject(error);
    }

    return requestNextApiBaseUrl(error.config);
  }
);

export default api;
