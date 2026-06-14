import { API_ROOT_URL } from "../helpers/appConstants";

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "0.0.0.0"]);

const getApiOrigin = () => {
  try {
    return new URL(API_ROOT_URL).origin;
  } catch {
    return "";
  }
};

export const resolveMediaUrl = (value) => {
  if (!value) return "";
  const rawValue = String(value);
  if (rawValue.startsWith("data:")) return rawValue;

  try {
    const parsedUrl = new URL(rawValue, getApiOrigin() || window.location.origin);
    if (!parsedUrl.pathname.startsWith("/media/")) return rawValue;

    const apiOrigin = getApiOrigin();
    const apiUrl = apiOrigin ? new URL(apiOrigin) : null;
    const currentHostname = window.location.hostname;
    const shouldUseCurrentHost =
      LOCAL_HOSTNAMES.has(parsedUrl.hostname) &&
      currentHostname &&
      !LOCAL_HOSTNAMES.has(currentHostname);

    if (shouldUseCurrentHost) {
      parsedUrl.protocol = window.location.protocol || parsedUrl.protocol;
      parsedUrl.hostname = currentHostname;
    } else if (apiUrl) {
      parsedUrl.protocol = apiUrl.protocol;
      parsedUrl.hostname = apiUrl.hostname;
      parsedUrl.port = apiUrl.port;
    }

    return parsedUrl.href;
  } catch {
    return rawValue;
  }
};

export const prepareMediaValueForApi = (value) => {
  if (!value) return "";
  const rawValue = String(value);
  if (rawValue.startsWith("data:")) return rawValue;

  try {
    const parsedUrl = new URL(rawValue, getApiOrigin() || window.location.origin);
    if (parsedUrl.pathname.startsWith("/media/")) {
      return parsedUrl.pathname;
    }
  } catch {
    return rawValue.split("?", 1)[0].split("#", 1)[0];
  }

  return rawValue.split("?", 1)[0].split("#", 1)[0];
};
