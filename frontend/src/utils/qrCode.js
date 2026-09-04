import QRCode from "qrcode";

export const createQrSvg = (value, options = {}) =>
  QRCode.toString(value, {
    type: "svg",
    errorCorrectionLevel: options.errorCorrectionLevel || "M",
    margin: options.border ?? 4,
    width: options.width ?? 320,
    color: {
      dark: "#000000",
      light: "#ffffff",
    },
  });
