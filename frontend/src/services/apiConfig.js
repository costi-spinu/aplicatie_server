import axios from "axios";
import { API_BASE_URL, API_BASE_URLS } from "../helpers/appConstants";

const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
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
