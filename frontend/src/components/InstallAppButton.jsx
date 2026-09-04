import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../services/api";
import { INSTALL_APP_URLS } from "../helpers/appConstants";
import { createQrSvg } from "../utils/qrCode";

const getCurrentAppUrl = () => {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/`;
};

const isLocalHost = (hostname) =>
  ["localhost", "127.0.0.1", "::1"].includes(hostname);

const uniqueUrls = (urls = []) =>
  Array.from(new Set(urls.map((url) => String(url || "").trim()).filter(Boolean)));

const isIosDevice = () => {
  if (typeof navigator === "undefined") return false;
  const userAgent = navigator.userAgent || "";
  return (
    /iphone|ipad|ipod/i.test(userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
};

const isAndroidDevice = () => {
  if (typeof navigator === "undefined") return false;
  return /android/i.test(navigator.userAgent || "");
};

const hasSecureAppContext = () => {
  if (typeof window === "undefined") return false;
  return Boolean(window.isSecureContext || isLocalHost(window.location.hostname));
};

export default function InstallAppButton() {
  const [open, setOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);
  const [installUrl, setInstallUrl] = useState(getCurrentAppUrl);
  const [suggestions, setSuggestions] = useState([]);
  const [qrSvg, setQrSvg] = useState("");
  const [copyLabel, setCopyLabel] = useState("Copiaza link");

  useEffect(() => {
    const checkStandalone = () => {
      const standalone =
        window.matchMedia?.("(display-mode: standalone)")?.matches ||
        window.navigator.standalone === true;
      setInstalled(Boolean(standalone));
    };

    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };

    const handleInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
    };

    checkStandalone();
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    createQrSvg(installUrl || getCurrentAppUrl(), {
      border: 4,
      width: 340,
    })
      .then((svg) => {
        if (!cancelled) setQrSvg(svg);
      })
      .catch(() => {
        if (!cancelled) setQrSvg("");
      });

    return () => {
      cancelled = true;
    };
  }, [installUrl]);

  const loadInstallInfo = useCallback(async () => {
    const currentUrl = getCurrentAppUrl();
    setInstallUrl(currentUrl);
    const fallbackUrls = uniqueUrls([...INSTALL_APP_URLS, currentUrl]);
    setSuggestions(fallbackUrls);

    if (isLocalHost(window.location.hostname) && INSTALL_APP_URLS[0]) {
      setInstallUrl(INSTALL_APP_URLS[0]);
    }

    try {
      const frontendPort = window.location.port || "5173";
      const response = await api.get("install/info/", {
        params: {
          frontend_port: frontendPort,
          scheme: window.location.protocol.replace(":", "") || "http",
        },
      });
      const urls = uniqueUrls([
        ...INSTALL_APP_URLS,
        ...(response.data?.suggested_urls || []),
        currentUrl,
      ]);
      setSuggestions(urls);

      if (isLocalHost(window.location.hostname) && urls[0]) {
        setInstallUrl(urls[0]);
      }
    } catch (error) {
      console.warn("Nu am putut incarca informatiile de instalare:", error);
      setSuggestions([]);
    }
  }, []);

  const openPanel = async () => {
    setOpen(true);
    setCopyLabel("Copiaza link");
    await loadInstallInfo();
  };

  const closePanel = () => setOpen(false);

  const installOnDevice = async () => {
    if (!installPrompt) {
      window.location.href = installUrl || getCurrentAppUrl();
      return;
    }

    installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(installUrl);
      setCopyLabel("Link copiat");
    } catch {
      setCopyLabel("Copiaza manual");
    }
  };

  const platformHint = useMemo(() => {
    if (installed) {
      return "Aplicatia ruleaza deja in modul instalat.";
    }

    if (isIosDevice()) {
      return "iPhone: apasa Deschide linkul in Safari, apoi Partajare si Adaugare pe ecranul principal.";
    }

    if (isAndroidDevice()) {
      return installPrompt
        ? "Android: apasa Instaleaza pe dispozitiv."
        : "Android: deschide linkul in Chrome, apoi meniu si Adauga pe ecranul principal.";
    }

    return "Scaneaza codul QR cu telefonul si instaleaza din meniul browserului.";
  }, [installPrompt, installed]);

  const securityHint = hasSecureAppContext()
    ? "Conexiune pregatita pentru functii moderne ale telefonului."
    : "Pentru passkeys si Face ID real foloseste HTTPS, de exemplu prin Tailscale HTTPS sau un certificat local.";

  return (
    <>
      <button type="button" style={styles.triggerButton} onClick={openPanel}>
        Instaleaza aplicatia
      </button>

      {open && (
        <div style={styles.overlay} onClick={closePanel}>
          <div style={styles.panel} onClick={(event) => event.stopPropagation()}>
            <div style={styles.header}>
              <h3 style={styles.title}>Instalare aplicatie</h3>
              <button type="button" style={styles.closeButton} onClick={closePanel}>
                Inchide
              </button>
            </div>

            <div style={styles.contentGrid}>
              <div style={styles.qrBox}>
                {qrSvg ? (
                  <div
                    style={styles.qrSvg}
                    dangerouslySetInnerHTML={{ __html: qrSvg }}
                  />
                ) : (
                  <div style={styles.qrFallback}>QR indisponibil</div>
                )}
              </div>

              <div>
                <div style={styles.hintBox}>
                  <p style={styles.hintText}>{platformHint}</p>
                  <p style={styles.hintText}>{securityHint}</p>
                </div>

                <label style={styles.label}>
                  Adresa aplicatie
                  <input
                    style={styles.input}
                    value={installUrl}
                    onChange={(event) => setInstallUrl(event.target.value)}
                  />
                </label>

                <a style={styles.directLink} href={installUrl}>
                  {installUrl}
                </a>

                {suggestions.length > 0 && (
                  <div style={styles.suggestions}>
                    {suggestions.slice(0, 3).map((url) => (
                      <button
                        key={url}
                        type="button"
                        style={styles.suggestionButton}
                        onClick={() => setInstallUrl(url)}
                      >
                        {url}
                      </button>
                    ))}
                  </div>
                )}

                <div style={styles.actions}>
                  <button
                    type="button"
                    style={styles.primaryButton}
                    onClick={installOnDevice}
                    disabled={installed}
                  >
                    {installed
                      ? "Aplicatie instalata"
                      : installPrompt
                        ? "Instaleaza pe dispozitiv"
                        : "Deschide linkul"}
                  </button>
                  <button type="button" style={styles.secondaryButton} onClick={copyLink}>
                    {copyLabel}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const styles = {
  triggerButton: {
    border: "1px solid var(--app-border)",
    background: "var(--app-panel-alt)",
    color: "var(--app-text)",
    borderRadius: 4,
    padding: "10px 12px",
    minHeight: 44,
    fontSize: 14,
    fontWeight: 800,
    cursor: "pointer",
  },
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0, 0, 0, 0.38)",
    zIndex: 100,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "max(12px, env(safe-area-inset-top, 0px)) 12px max(12px, env(safe-area-inset-bottom, 0px))",
    overflow: "auto",
  },
  panel: {
    width: "min(760px, 100%)",
    maxHeight: "calc(100dvh - 24px)",
    overflow: "auto",
    background: "var(--app-panel)",
    border: "1px solid var(--app-border)",
    borderTop: "4px solid var(--app-primary)",
    borderRadius: 6,
    padding: 18,
    color: "var(--app-text)",
    boxShadow: "0 18px 44px rgba(0, 0, 0, 0.24)",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14,
  },
  title: {
    margin: 0,
    fontSize: 18,
    fontWeight: 900,
  },
  closeButton: {
    border: "1px solid var(--app-border)",
    background: "var(--app-panel-alt)",
    color: "var(--app-text)",
    borderRadius: 4,
    padding: "7px 9px",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
  },
  contentGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: 16,
    alignItems: "start",
  },
  qrBox: {
    border: "1px solid var(--app-border)",
    background: "#ffffff",
    borderRadius: 4,
    padding: 16,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  qrSvg: {
    width: "min(320px, 74vw)",
    height: "min(320px, 74vw)",
    overflow: "hidden",
  },
  qrFallback: {
    width: 200,
    height: 200,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#10201a",
    fontWeight: 800,
  },
  hintBox: {
    border: "1px solid var(--app-border-soft)",
    background: "var(--app-panel-alt)",
    borderRadius: 4,
    padding: "10px 12px",
    marginBottom: 12,
  },
  hintText: {
    margin: "0 0 6px",
    color: "var(--app-muted)",
    fontSize: 13,
    lineHeight: 1.45,
    fontWeight: 700,
  },
  label: {
    display: "block",
    fontSize: 13,
    color: "var(--app-muted)",
    fontWeight: 800,
    marginBottom: 10,
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid var(--app-border)",
    background: "var(--app-panel)",
    color: "var(--app-text)",
    borderRadius: 4,
    padding: "9px 10px",
    marginTop: 6,
    fontSize: 14,
  },
  directLink: {
    display: "block",
    color: "var(--app-primary-dark)",
    fontSize: 13,
    fontWeight: 800,
    lineHeight: 1.4,
    margin: "-2px 0 12px",
    overflowWrap: "anywhere",
  },
  suggestions: {
    display: "grid",
    gap: 8,
    marginBottom: 12,
  },
  suggestionButton: {
    border: "1px solid var(--app-border)",
    background: "var(--app-panel-alt)",
    color: "var(--app-text)",
    borderRadius: 4,
    padding: "8px 9px",
    textAlign: "left",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    overflowWrap: "anywhere",
  },
  actions: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: 10,
  },
  primaryButton: {
    border: "1px solid var(--app-primary)",
    background: "var(--app-primary)",
    color: "#ffffff",
    borderRadius: 4,
    padding: "10px 12px",
    fontWeight: 800,
    cursor: "pointer",
  },
  secondaryButton: {
    border: "1px solid var(--app-border)",
    background: "var(--app-panel-alt)",
    color: "var(--app-text)",
    borderRadius: 4,
    padding: "10px 12px",
    fontWeight: 800,
    cursor: "pointer",
  },
};
