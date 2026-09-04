import {
  categoryKeys,
  categoryLabelMap,
  formatExpenseDescription,
  formatExpenseTitle,
  formatExpenseType,
  getFixedAutomationCadenceLabel,
  toUiCategory,
} from "./cheltuieliUtils";

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const makeExportTable = (rows, heading) =>
  `<h3>${escapeHtml(heading)}</h3><table><tbody>${rows
    .map(
      (row, rowIndex) =>
        `<tr>${row
          .map((value) =>
            rowIndex === 0
              ? `<th>${escapeHtml(value)}</th>`
              : `<td>${escapeHtml(value)}</td>`
          )
          .join("")}</tr>`
    )
    .join("")}</tbody></table>`;

const numberValue = (value) => Number(value || 0);
const money = (value) => `${numberValue(value).toFixed(2)} EUR`;
const percent = (value, total) =>
  numberValue(total) > 0
    ? `${((numberValue(value) / numberValue(total)) * 100).toFixed(2)}%`
    : "0.00%";
const sortDescByDate = (a, b) => {
  const dateDiff = new Date(b.data) - new Date(a.data);
  if (dateDiff !== 0) return dateDiff;
  return String(b.id || "").localeCompare(String(a.id || ""));
};

export const buildCheltuieliExportModel = (report = {}) => {
  const fixedManualRows = (report.fixe_manuale_detalii || []).map((item) => ({
    ...item,
    expenseType: "fixe",
  }));
  const variableRows = (report.variabile_detalii || []).map((item) => ({
    ...item,
    expenseType: "variabile",
  }));
  const exportRows = [...fixedManualRows, ...variableRows].sort(sortDescByDate);
  const autoDeductionRows = (report.fixe_automate_detalii || [])
    .map((item) => ({ ...item, occurrenceDate: item.data }))
    .sort(sortDescByDate);
  const creditRows = (report.credite || []).slice().sort(sortDescByDate);
  const incomeRows = (report.venituri || []).slice().sort(sortDescByDate);
  const categoryTotals = (report.categorii || []).reduce((acc, item) => {
    const key = toUiCategory(item.categorie || "neprevazute");
    acc[key] = (acc[key] || 0) + numberValue(item.total);
    return acc;
  }, {});
  const target = report.obiectiv || {};
  const categoryTargets = target.category_targets || {};
  const fixedTotal = numberValue(report.fixe_total);
  const achievements = [
    {
      key: "fixe",
      label: "Cheltuieli fixe",
      actual: fixedTotal,
      target: numberValue(target.fixed_target),
    },
    ...categoryKeys.map((key) => ({
      key,
      label: categoryLabelMap[key],
      actual: numberValue(categoryTotals[key]),
      target: numberValue(categoryTargets[key]),
    })),
  ];

  return {
    achievements,
    autoDeductionRows,
    autoDeductionTotal: numberValue(report.fixe_automate),
    categoryTotals,
    cheltuieliBuget: numberValue(report.cheltuieli_buget),
    creditRows,
    creditTotal: numberValue(report.deduceri_credite),
    deduceriTotal: numberValue(report.deduceri_total),
    end: report.end,
    exportMonth: report.luna,
    exportRows,
    fixedManualTotal: numberValue(report.fixe_manuale),
    fixedTotal,
    incomeRows,
    ramas: numberValue(report.economii),
    start: report.start,
    totalCheltuit: numberValue(report.iesiri_totale),
    variableTotal: numberValue(report.variabile),
    venitBrut: numberValue(report.venit_brut),
    venitNet: numberValue(report.venit_net),
  };
};

export const buildCheltuieliExportTables = (model) => {
  const summaryRows = [
    ["Indicator", "Valoare"],
    ["Perioada bugetara", `${model.start} - ${model.end}`],
    ["Venit brut", money(model.venitBrut)],
    ["Credite scazute", `-${money(model.creditTotal)}`],
    ["Cheltuieli fixe automate", `-${money(model.autoDeductionTotal)}`],
    ["Deduceri totale", `-${money(model.deduceriTotal)}`],
    ["Venit disponibil dupa deduceri", money(model.venitNet)],
    ["Cheltuieli fixe manuale", money(model.fixedManualTotal)],
    ["Cheltuieli variabile", money(model.variableTotal)],
    ["Cheltuieli fixe totale", money(model.fixedTotal)],
    ["Cheltuieli din venitul disponibil", money(model.cheltuieliBuget)],
    ["Total iesiri inclusiv credite", money(model.totalCheltuit)],
    ["Suma economisita sau ramasa", money(model.ramas)],
  ];
  const categoryRows = [
    [
      "Categorie",
      "Total",
      "% din venit brut",
      "% din venit disponibil",
    ],
    [
      "Cheltuieli fixe manuale",
      money(model.fixedManualTotal),
      percent(model.fixedManualTotal, model.venitBrut),
      percent(model.fixedManualTotal, model.venitNet),
    ],
    [
      "Cheltuieli fixe automate",
      money(model.autoDeductionTotal),
      percent(model.autoDeductionTotal, model.venitBrut),
      percent(model.autoDeductionTotal, model.venitNet),
    ],
    [
      "Cheltuieli fixe totale",
      money(model.fixedTotal),
      percent(model.fixedTotal, model.venitBrut),
      percent(model.fixedTotal, model.venitNet),
    ],
    ...Object.entries(model.categoryTotals).map(([key, value]) => [
      categoryLabelMap[key] || key,
      money(value),
      percent(value, model.venitBrut),
      percent(value, model.venitNet),
    ]),
  ];
  const objectiveRows = [
    [
      "Obiectiv",
      "Cheltuit",
      "Tinta",
      "% din tinta",
      "% din venit brut",
      "% din venit disponibil",
    ],
    ...model.achievements.map((row) => [
      row.label,
      money(row.actual),
      money(row.target),
      row.target > 0
        ? `${((row.actual / row.target) * 100).toFixed(2)}%`
        : "-",
      percent(row.actual, model.venitBrut),
      percent(row.actual, model.venitNet),
    ]),
  ];
  const incomeRows = [
    ["Data", "Suma initiala", "Moneda", "Suma EUR", "Sursa", "User"],
    ...model.incomeRows.map((row) => [
      row.data,
      row.suma,
      row.moneda,
      numberValue(row.suma_eur).toFixed(2),
      row.sursa || "manual",
      row.username || "-",
    ]),
  ];
  const detailRows = [
    [
      "Data",
      "Tip",
      "Categorie",
      "Descriere",
      "Suma initiala",
      "Moneda",
      "Suma EUR",
      "User",
    ],
    ...model.exportRows.map((row) => [
      row.data,
      formatExpenseType(row.expenseType),
      row.expenseType === "variabile"
        ? formatExpenseTitle(row)
        : "Cheltuieli fixe",
      row.expenseType === "variabile"
        ? formatExpenseDescription(row) || "-"
        : row.descriere || "Cheltuiala fixa",
      row.suma,
      row.moneda,
      numberValue(row.suma_eur).toFixed(2),
      row.username || "-",
    ]),
  ];
  const creditRows = [
    ["Data", "Denumire", "Suma initiala", "Moneda", "Suma EUR", "User"],
    ...model.creditRows.map((row) => [
      row.data,
      row.denumire || "Credit",
      row.suma,
      row.moneda,
      numberValue(row.suma_eur).toFixed(2),
      row.username || "-",
    ]),
  ];
  const autoDeductionRows = [
    [
      "Data",
      "Denumire",
      "Cursivitate",
      "Suma initiala",
      "Moneda",
      "Suma EUR",
      "User",
    ],
    ...model.autoDeductionRows.map((row) => [
      row.occurrenceDate,
      row.denumire || "Automatizare",
      getFixedAutomationCadenceLabel(row.cursivitate),
      row.suma,
      row.moneda,
      numberValue(row.suma_eur).toFixed(2),
      row.username || "-",
    ]),
  ];

  return {
    summaryRows,
    categoryRows,
    objectiveRows,
    incomeRows,
    creditRows,
    autoDeductionRows,
    detailRows,
  };
};

export const buildCheltuieliExportHtml = (model) => {
  const tables = buildCheltuieliExportTables(model);

  return `<!doctype html><html><head><meta charset="UTF-8" /><title>Desfasurator cheltuieli ${escapeHtml(model.exportMonth)}</title><style>
      body { font-family: Segoe UI, Arial, sans-serif; color: #10201a; margin: 28px; }
      h1 { font-size: 22px; margin: 0 0 6px; }
      h3 { font-size: 15px; margin: 22px 0 8px; }
      .meta { color: #5f6f66; font-size: 12px; margin-bottom: 16px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 14px; page-break-inside: auto; }
      th, td { border: 1px solid #cfd8d3; padding: 7px 8px; text-align: left; font-size: 12px; }
      th { background: #eef2f1; font-weight: 700; }
      tr { page-break-inside: avoid; page-break-after: auto; }
      @media print { body { margin: 10mm; } }
    </style></head><body>
      <h1>Desfasurator cheltuieli</h1>
      <div class="meta">Ciclul ${escapeHtml(model.start)} - ${escapeHtml(model.end)}. Generat la ${escapeHtml(new Date().toLocaleString("ro-RO"))}</div>
      ${makeExportTable(tables.summaryRows, "Sumar")}
      ${makeExportTable(tables.categoryRows, "Totaluri si procente pe categorie")}
      ${makeExportTable(tables.objectiveRows, "Obiective cheltuieli")}
      ${makeExportTable(tables.incomeRows, "Venituri incluse")}
      ${makeExportTable(tables.creditRows, "Credite scazute din venit")}
      ${makeExportTable(tables.autoDeductionRows, "Cheltuieli fixe automate")}
      ${makeExportTable(tables.detailRows, "Cheltuieli fixe manuale si variabile")}
    </body></html>`;
};

export const downloadCheltuieliExcel = (model) => {
  const excelHtml = buildCheltuieliExportHtml(model);

  downloadBlob(
    new Blob([excelHtml], { type: "application/vnd.ms-excel;charset=utf-8" }),
    `desfasurator-cheltuieli-${model.exportMonth}.xls`
  );
};

export const downloadCheltuieliPdf = (model) => {
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(buildCheltuieliExportHtml(model));
  win.document.close();
  win.focus();
  win.print();
};
