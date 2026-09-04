import axios from "axios";
import { API_BASE_URL, API_BASE_URLS } from "../helpers/appConstants";

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: Number(import.meta.env.VITE_API_TIMEOUT_MS || 12000),
});

export const getActiveApiBaseUrl = () => api.defaults.baseURL || API_BASE_URL;

const responseCache = new Map();
const responseCacheTimestamps = new Map();
export const FRESH_CACHE_WINDOW_MS = 2500;
let refreshTokenRequest = null;

export const clearStoredAuthTokens = () => {
  localStorage.removeItem("access");
  localStorage.removeItem("refresh");
  window.dispatchEvent(new Event("auth-expired"));
};

const storeAuthTokens = (tokens = {}) => {
  if (tokens.access) {
    localStorage.setItem("access", tokens.access);
  }

  if (tokens.refresh) {
    localStorage.setItem("refresh", tokens.refresh);
  }
};

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
  const cacheKey = normalizeCacheKey(url, params);
  responseCache.set(cacheKey, data);
  responseCacheTimestamps.set(cacheKey, Date.now());
};

export const getCachedApiDataAge = (url, params) => {
  const cachedAt = responseCacheTimestamps.get(normalizeCacheKey(url, params));
  return cachedAt ? Date.now() - cachedAt : Infinity;
};

export const isCachedApiDataFresh = (url, params, maxAge = FRESH_CACHE_WINDOW_MS) =>
  getCachedApiDataAge(url, params) <= maxAge;

export const areCachedApiEndpointsFresh = (
  endpoints = [],
  maxAge = FRESH_CACHE_WINDOW_MS
) =>
  endpoints
    .map((entry) => (typeof entry === "string" ? { url: entry } : entry))
    .filter((entry) => entry?.url)
    .every((entry) => isCachedApiDataFresh(entry.url, entry.params, maxAge));

export const clearApiDataCache = () => {
  responseCache.clear();
  responseCacheTimestamps.clear();
};

export const preloadApiData = async (endpoints = [], options = {}) => {
  const force = options.force === true;
  const requests = endpoints
    .map((entry) => (typeof entry === "string" ? { url: entry } : entry))
    .filter((entry) => entry?.url)
    .filter((entry) => force || !isCachedApiDataFresh(entry.url, entry.params))
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

  const requestUrl = String(config.url || "");
  const isPublicRequest = [
    "register/",
    "token/",
    "token/refresh/",
    "install/info/",
  ].some((endpoint) => requestUrl.includes(endpoint));
  const token = localStorage.getItem("access");
  if (token && !isPublicRequest) {
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

const isAuthEndpoint = (url = "") =>
  ["register/", "token/", "token/refresh/"].some((endpoint) =>
    String(url).includes(endpoint)
  );

const getUniqueBaseUrls = (preferredBaseUrl) =>
  Array.from(new Set([preferredBaseUrl, api.defaults.baseURL, ...API_BASE_URLS].filter(Boolean)));

const requestTokenRefresh = async (preferredBaseUrl) => {
  const refresh = localStorage.getItem("refresh");
  if (!refresh) {
    throw new Error("Refresh token lipsa");
  }

  let lastError = null;
  for (const baseURL of getUniqueBaseUrls(preferredBaseUrl)) {
    try {
      const response = await axios.post("token/refresh/", { refresh }, { baseURL });
      storeAuthTokens(response.data);
      rememberWorkingApiBaseUrl(response);
      return response.data.access;
    } catch (error) {
      lastError = error;

      const statusCode = error.response?.status;
      if (statusCode === 401 || statusCode === 403) {
        break;
      }
    }
  }

  throw lastError || new Error("Refresh token esuat");
};

const refreshAccessToken = (preferredBaseUrl) => {
  if (!refreshTokenRequest) {
    refreshTokenRequest = requestTokenRefresh(preferredBaseUrl).finally(() => {
      refreshTokenRequest = null;
    });
  }

  return refreshTokenRequest;
};

const shouldRefreshAccessToken = (error) => {
  const responseStatus = error.response?.status;
  const requestUrl = error.config?.url || "";

  return (
    responseStatus === 401 &&
    error.config &&
    !error.config.__authRetry &&
    !isAuthEndpoint(requestUrl) &&
    Boolean(localStorage.getItem("refresh"))
  );
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
    if (shouldRefreshAccessToken(error)) {
      try {
        const access = await refreshAccessToken(error.config.baseURL);
        return api.request({
          ...error.config,
          __authRetry: true,
          headers: {
            ...(error.config.headers || {}),
            Authorization: `Bearer ${access}`,
          },
        });
      } catch {
        clearStoredAuthTokens();
        clearApiDataCache();
      }
    }

    if (!shouldTryNextApiBaseUrl(error)) {
      return Promise.reject(error);
    }

    return requestNextApiBaseUrl(error.config);
  }
);

export default api;
