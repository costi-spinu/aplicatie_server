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

const shouldTryNextApiBaseUrl = (error) => {
  if (!error.config) {
    return false;
  }

  const retryIndex = error.config.__apiBaseUrlRetryIndex ?? 0;
  if (retryIndex >= API_BASE_URLS.length - 1) {
    return false;
  }

  if (!error.response) {
    return true;
  }

  return [404, 405].includes(error.response.status);
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (!shouldTryNextApiBaseUrl(error)) {
      return Promise.reject(error);
    }

    const nextRetryIndex = (error.config.__apiBaseUrlRetryIndex ?? 0) + 1;
    return api.request({
      ...error.config,
      baseURL: API_BASE_URLS[nextRetryIndex],
      __apiBaseUrlRetryIndex: nextRetryIndex,
    });
  }
);

export default api;