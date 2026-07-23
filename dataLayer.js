/**
 * dataLayer.js
 * ---------------------------------------------------------------------
 * A line-for-line port of Code.gs's business logic. Every function here
 * has the SAME NAME and SAME ARGUMENTS as its Code.gs counterpart, and
 * returns a Promise instead of being called through google.script.run.
 * scripts.js (formerly scripts.html's <script> block) calls these
 * directly — see README.md for the exact call-site changes that were
 * made there.
 *
 * Two Code.gs functions were NOT ported because they were dead code,
 * never actually reachable from the UI:
 *   - the duplicate client-side `getSalesBranches` that lived inside the
 *     old scripts.html and referenced SpreadsheetApp (server-only API —
 *     it could never have run in a browser)
 *   - `updateOverviewUI`, which also referenced `document.getElementById`
 *     from inside Code.gs and was never called
 * ---------------------------------------------------------------------
 */

/* ========================= AUTH ========================= */
async function checkPassword(inputPassword) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(inputPassword));
  const hash = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return hash === CONFIG.authPasswordHash;
}

/* ========================= TASK DATA ========================= */
async function getMembers() {
  return CONFIG.members;
}

async function getMonths(spreadsheetId) {
  return getSheetTitles(spreadsheetId);
}

async function getTaskData(spreadsheetId, month) {
  const allData = await getSheetValues(spreadsheetId, month);
  const headerRowIndex = allData.findIndex((row) => row.includes("S.No"));
  if (headerRowIndex === -1) throw new Error("Header row with 'S.No' not found.");
  return allData.slice(headerRowIndex);
}

async function getMemberDashboardData(spreadsheetId) {
  const months = await getSheetTitles(spreadsheetId);
  const monthData = {};
  await Promise.all(
    months.map(async (name) => {
      const allData = await getSheetValues(spreadsheetId, name);
      const headerRowIndex = allData.findIndex((row) => row.includes("S.No"));
      if (headerRowIndex !== -1) monthData[name] = allData.slice(headerRowIndex);
    })
  );
  return { months, data: monthData };
}

/* ========================= SALES DATA ========================= */

async function getSalesBranches(reportType) {
  const data = await getSheetValues(CONFIG.salesConfigSpreadsheetId, "Sheet1");
  const branches = [];
  data.slice(1).forEach((row) => {
    if (row[0] === reportType) branches.push(row[1]);
  });
  return branches;
}

async function getSalesSpreadsheetId(reportType, branch) {
  const data = await getSheetValues(CONFIG.salesConfigSpreadsheetId, "Sheet1");
  for (let i = 1; i < data.length; i++) {
    const typeCell = String(data[i][0]).trim().toUpperCase();
    const branchCell = String(data[i][1]).trim().toUpperCase();
    if (typeCell === reportType.toUpperCase() && branchCell === branch.toUpperCase()) {
      return data[i][2];
    }
  }
  return null;
}

async function getSalesMonths(reportType, branch) {
  const ssId = await getSalesSpreadsheetId(reportType, branch);
  if (!ssId) return [];
  return getSheetTitles(ssId);
}

async function getSalesReportData(reportType, branch, month) {
  const ssId = await getSalesSpreadsheetId(reportType, branch);
  if (!ssId) return [];

  if (reportType === "SONIC") {
    const values = await getSheetValues(ssId, branch.trim()).catch(() => null);
    return values || [];
  }

  const values = await getSheetValues(ssId, month).catch(() => null);
  if (!values) return [];
  // Code.gs: sheet.getRange(2, 1, lastRow - 1, 5) — rows from row 2 on, first 5 columns
  return values.slice(1).map((row) => row.slice(0, 5));
}

function findRowIndex(values, text) {
  return values.findIndex(
    (r) => r[0] && r[0].toString().toLowerCase().trim().includes(text.toLowerCase().trim())
  );
}

function normalizeMonthKey(month) {
  const key = month.replace(/[^A-Za-z]/g, "").substring(0, 3).toUpperCase();
  const map = {
    JLY: "JUL", JUN: "JUN", JUL: "JUL", JAN: "JAN", FEB: "FEB", MAR: "MAR",
    APR: "APR", MAY: "MAY", AUG: "AUG", SEP: "SEP", OCT: "OCT", NOV: "NOV", DEC: "DEC",
  };
  return map[key] || key;
}

/* ===================== SONICWALL SALES REPORT ===================== */

async function getSonicwallDashboardData(reportType, branch, month) {
  const ssId = await getSalesSpreadsheetId(reportType, branch);
  if (!ssId) return null;

  const titles = await getSheetTitles(ssId);
  const sheetName = titles.find((t) => t.trim().toUpperCase() === branch.toString().trim().toUpperCase());
  if (!sheetName) return null;

  const data = await getSheetValues(ssId, sheetName);

  const monthNames = ["MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC", "JAN", "FEB", "MAR", "APR"];
  const monthHeaderRow = data.findIndex((row) =>
    row.some((cell) => monthNames.some((m) => String(cell).toUpperCase().includes(m)))
  );
  if (monthHeaderRow === -1) throw new Error("Month header row not found");

  const valueRow = monthHeaderRow + 1;
  const monthValueCols = [];
  for (let c = 0; c < data[valueRow].length; c++) {
    const cell = String(data[valueRow][c]).toUpperCase();
    if (cell.includes("QTY")) monthValueCols.push(c + 1);
  }

  function findRow(text) {
    text = text.toUpperCase();
    return data.findIndex((r) => r.some((cell) => String(cell).toUpperCase().includes(text)));
  }

  const targetRow = data.findIndex((r) => String(r[0]).trim().toUpperCase() === "MONTHLY TARGET IN LAKHS");
  const achievedRow = data.findIndex((r) => String(r[0]).trim().toUpperCase() === "MONTHLY ACHIEVED");
  const percentRow = data.findIndex((r) => String(r[0]).trim().toUpperCase() === "MONTHLY ACHIEVED %");
  if (targetRow === -1 || achievedRow === -1 || percentRow === -1) throw new Error("Monthly rows not found");

  const monthly = {
    months: ["May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr"],
    target: [], achieved: [], percent: [],
  };

  // Original checked `typeof v === 'number'`, which only works with GAS's
  // typed getValues(). Our CSV reads are always strings, so we detect a
  // numeric cell by parseability instead — same intent, adapted for text.
  const isNumericCell = (v) => v !== "" && v !== null && v !== undefined && !isNaN(Number(v));
  const firstMonthCol = data[targetRow].findIndex(isNumericCell);
  if (firstMonthCol === -1) throw new Error("Monthly numeric columns not detected");

  for (let i = 0; i < 12; i++) {
    const col = firstMonthCol + i * 2;
    monthly.target.push(Number(data[targetRow][col]) || 0);
    monthly.achieved.push(Number(data[achievedRow][col]) || 0);
    monthly.percent.push(Number(data[percentRow][col]) || 0);
  }

  const qTargetRow = findRow("QUARTERLY TARGET");
  const qAchievedRow = findRow("QUARTERLY ACHIEVED");
  const qPercentRow = findRow("QUARTER ACHIEVED %");

  const q = (row, col) => Number(data[row]?.[col]) || 0;
  const quarterly = {
    Q1: { target: q(qTargetRow, 1), achieved: q(qAchievedRow, 1), percent: Math.round(q(qPercentRow, 1) * 100) },
    Q2: { target: q(qTargetRow, 7), achieved: q(qAchievedRow, 7), percent: Math.round(q(qPercentRow, 7) * 100) },
    Q3: { target: q(qTargetRow, 13), achieved: q(qAchievedRow, 13), percent: Math.round(q(qPercentRow, 13) * 100) },
    Q4: { target: q(qTargetRow, 19), achieved: q(qAchievedRow, 19), percent: Math.round(q(qPercentRow, 19) * 100) },
  };

  const models = [];
  const mayValueCol = monthValueCols[0];
  for (let i = 4; i <= 10; i++) {
    const name = data[i]?.[0];
    const value = Number(data[i]?.[mayValueCol]) || 0;
    if (name) models.push({ name, value });
  }

  const yearTarget = monthly.target.reduce((a, b) => a + b, 0);
  const totalAchieved = monthly.achieved.reduce((a, b) => a + b, 0);
  const yearPercent = yearTarget > 0 ? Math.round((totalAchieved / yearTarget) * 100) : 0;

  return { monthly, quarterly, models, year: { target: yearTarget, achieved: totalAchieved, percent: yearPercent } };
}

async function getTop6Growth(reportType, branch, month) {
  const ssId = await getSalesSpreadsheetId(reportType, branch);
  if (!ssId) return 0;
  const monthNames = await getSheetTitles(ssId);
  const currentIndex = monthNames.indexOf(month);
  if (currentIndex <= 0) return 0;
  const [currentData, previousData] = await Promise.all([
    getSheetValues(ssId, month),
    getSheetValues(ssId, monthNames[currentIndex - 1]),
  ]);
  let currentTotal = 0, previousTotal = 0;
  currentData.slice(2).forEach((r) => { if (String(r[1]).toUpperCase() === "TOTAL") currentTotal = Number(r[3]) || 0; });
  previousData.slice(2).forEach((r) => { if (String(r[1]).toUpperCase() === "TOTAL") previousTotal = Number(r[3]) || 0; });
  if (previousTotal === 0) return 0;
  return (((currentTotal - previousTotal) / previousTotal) * 100).toFixed(1);
}

async function getNFGrowth(reportType, branch, selectedMonth) {
  const ssId = await getSalesSpreadsheetId(reportType, branch);
  if (!ssId) return 0;
  const sheets = await getSheetTitles(ssId);
  const monthIndex = sheets.findIndex((s) => s === selectedMonth);
  if (monthIndex <= 0) return 0;
  const [currentData, previousData] = await Promise.all([
    getSheetValues(ssId, selectedMonth),
    getSheetValues(ssId, sheets[monthIndex - 1]),
  ]);
  let currentTotal = 0, previousTotal = 0;
  currentData.slice(2).forEach((r) => { if (String(r[1]).toUpperCase() === "TOTAL") currentTotal = Number(r[3]) || 0; });
  previousData.slice(2).forEach((r) => { if (String(r[1]).toUpperCase() === "TOTAL") previousTotal = Number(r[3]) || 0; });
  if (previousTotal === 0) return 0;
  return (((currentTotal - previousTotal) / previousTotal) * 100).toFixed(1);
}

/* ========================= OVERVIEW DASHBOARD ========================= */

function getTotalValueFromRows(data) {
  for (let i = 0; i < data.length; i++) {
    const rowText = data[i].join(" ").toUpperCase();
    if (rowText.includes("TOTAL")) {
      return Number(String(data[i][4]).replace(/,/g, "")) || 0;
    }
  }
  return 0;
}

async function getOverviewDashboardData(branch, period, month, quarter) {
  period = String(period).toUpperCase();
  const rows = await getSheetValues(CONFIG.salesConfigSpreadsheetId, "Sheet1");

  let top6Total = 0, netfoxTotal = 0, sonicTotal = 0;

  const branchCode = { Bangalore: "BLR", Chennai: "CHN", Cochin: "COH", Coimbatore: "CBE", Hyderabad: "HYD", Vizag: "VIZAG" };
  const selectedBranch = branch === "ALL" ? "ALL" : branchCode[branch];
  const quarterTopNF = { Q1: ["APR", "MAY", "JUN"], Q2: ["JLY", "AUG", "SEP"], Q3: ["OCT", "NOV", "DEC"], Q4: ["JAN", "FEB", "MAR"] };

  for (const row of rows.slice(1)) {
    const type = row[0], branchName = row[1], ssId = row[2];
    if (!ssId) continue;

    if (selectedBranch !== "ALL") {
      if (type === "SONIC") { if (String(branchName).toUpperCase() !== String(selectedBranch).toUpperCase()) continue; }
      else { if (String(branchName).toUpperCase() !== String(branch).toUpperCase()) continue; }
    }

    if (type === "TOP6" || type === "NF") {
      const titles = await getSheetTitles(ssId);

      if (period === "MONTH") {
        let sheetName;
        if (type === "TOP6") {
          sheetName = titles.includes(month) ? month : null;
        } else {
          sheetName = titles.find((t) =>
            t.toUpperCase().replace(/\s+/g, "").startsWith(String(month).toUpperCase().replace(/\s+/g, ""))
          );
        }
        if (sheetName) {
          const values = await getSheetValues(ssId, sheetName);
          const total = getTotalValueFromRows(values);
          if (type === "TOP6") top6Total += total; else netfoxTotal += total;
        }
      } else if (period === "QUARTER") {
        const months = quarterTopNF[quarter] || [];
        for (const t of titles) {
          if (months.some((m) => t.toUpperCase().includes(m))) {
            const values = await getSheetValues(ssId, t);
            const total = getTotalValueFromRows(values);
            if (type === "TOP6") top6Total += total; else netfoxTotal += total;
          }
        }
      } else if (period === "YEAR") {
        for (const t of titles) {
          const values = await getSheetValues(ssId, t);
          const total = getTotalValueFromRows(values);
          if (type === "TOP6") top6Total += total; else netfoxTotal += total;
        }
      }
    }

    if (type === "SONIC") {
      const titles = await getSheetTitles(ssId);
      const sheetName = titles.find((t) => t.trim().toUpperCase() === String(branchName).trim().toUpperCase());
      if (!sheetName) continue;
      const values = await getSheetValues(ssId, sheetName);
      const achievedRow = values.findIndex((r) => String(r[0]).toUpperCase().includes("MONTHLY ACHIEVED"));
      if (achievedRow === -1) continue;

      if (period === "MONTH") {
        const key = normalizeMonthKey(month);
        const monthMap = { MAY: 2, JUN: 4, JUL: 6, AUG: 8, SEP: 10, OCT: 12, NOV: 14, DEC: 16, JAN: 18, FEB: 20, MAR: 22, APR: 24 };
        const col = monthMap[key];
        if (col !== undefined) sonicTotal += Number(values[achievedRow][col - 1]) || 0;
      } else if (period === "QUARTER") {
        const quarterMap = { Q1: [2, 4, 6], Q2: [8, 10, 12], Q3: [14, 16, 18], Q4: [20, 22, 24] };
        (quarterMap[quarter] || []).forEach((col) => { sonicTotal += Number(values[achievedRow][col - 1]) || 0; });
      } else if (period === "YEAR") {
        [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24].forEach((col) => { sonicTotal += Number(values[achievedRow][col - 1]) || 0; });
      }
    }
  }

  return {
    top6: Number(top6Total.toFixed(2)),
    netfox: Number(netfoxTotal.toFixed(2)),
    sonic: Number(sonicTotal.toFixed(2)),
  };
}

async function getOverviewMonths() {
  const data = await getSheetValues(CONFIG.salesConfigSpreadsheetId, "Sheet1");
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === "TOP6") return getSheetTitles(data[i][2]);
  }
  return [];
}

async function getDashboardFilters() {
  const data = await getSheetValues(CONFIG.salesConfigSpreadsheetId, "Sheet1");
  const branches = new Set();
  let months = [];
  const branchMap = { CBE: "Coimbatore", CHN: "Chennai", COH: "Cochin", BLR: "Bangalore", HYD: "Hyderabad", VIZAG: "Vizag" };

  let monthFound = false;
  for (const row of data.slice(1)) {
    let branch = row[1];
    const ssId = row[2];
    if (branchMap[branch]) branch = branchMap[branch];
    if (branch) branches.add(branch);
    if (!monthFound && ssId) {
      const titles = await getSheetTitles(ssId);
      months = titles.filter((name) => !name.toLowerCase().includes("summary"));
      monthFound = true;
    }
  }

  return { branches: [...branches].sort(), months };
}

async function getBrandDrilldownData(type, brand, selectedBranch, selectedMonth) {
  const configData = await getSheetValues(CONFIG.salesConfigSpreadsheetId, "Sheet1");

  let currentSpreadsheetId = "";
  for (const row of configData.slice(1)) {
    if (String(row[0]).trim().toUpperCase() === type.toUpperCase() &&
        String(row[1]).trim().toUpperCase() === selectedBranch.toUpperCase()) {
      currentSpreadsheetId = row[2];
    }
  }
  if (!currentSpreadsheetId) return null;

  const sheetOrder = await getSheetTitles(currentSpreadsheetId);
  const normBrand = (b) => String(b).replace(/[^A-Za-z0-9]/g, "").trim().toUpperCase();
  const selectedBrandNorm = normBrand(brand);

  const monthly = [];
  for (const sheetName of sheetOrder) {
    const data = await getSheetValues(currentSpreadsheetId, sheetName);
    for (let i = 0; i < data.length; i++) {
      if (normBrand(data[i][1]) === selectedBrandNorm) {
        monthly.push([sheetName, Number(data[i][3]) || 0]);
        break;
      }
    }
  }
  monthly.sort((a, b) => sheetOrder.indexOf(a[0]) - sheetOrder.indexOf(b[0]));

  const currentData = await getSheetValues(currentSpreadsheetId, selectedMonth);
  let totalSales = 0, percent = 0;
  currentData.forEach((row) => {
    if (normBrand(row[1]) === selectedBrandNorm) {
      totalSales = Number(row[3]) || 0;
      percent = Number(String(row[4]).replace("%", "")) || 0;
    }
  });

  let growthMonth = 0, growthQuarter = 0;
  const currentIndex = monthly.findIndex((m) => m[0] === selectedMonth);
  if (currentIndex > 0) {
    const previous = monthly[currentIndex - 1][1];
    if (previous > 0) growthMonth = ((totalSales - previous) / previous) * 100;
  }
  if (currentIndex >= 3) {
    const quarterValue = monthly[currentIndex - 3][1];
    if (quarterValue > 0) growthQuarter = ((totalSales - quarterValue) / quarterValue) * 100;
  }

  const branches = [];
  for (const row of configData.slice(1)) {
    const reportType = String(row[0]).trim().toUpperCase();
    if (reportType !== type.toUpperCase()) continue;
    const branchName = String(row[1]).trim();
    const spreadsheetId = String(row[2]).trim();
    try {
      const titles = await getSheetTitles(spreadsheetId);
      if (!titles.includes(selectedMonth)) continue;
      const data = await getSheetValues(spreadsheetId, selectedMonth);
      data.forEach((r) => {
        if (normBrand(r[1]) === selectedBrandNorm) branches.push([branchName, Number(r[3]) || 0]);
      });
    } catch (err) { console.warn(err); }
  }

  return {
    totalSales: totalSales.toFixed(2),
    percent: percent.toFixed(1),
    growthMonth: growthMonth.toFixed(1),
    growthQuarter: growthQuarter.toFixed(1),
    monthly,
    branches,
  };
}

async function getNFDrilldownData(type, category, selectedBranch, selectedMonth) {
  const configData = await getSheetValues(CONFIG.salesConfigSpreadsheetId, "Sheet1");

  let currentSpreadsheetId = "";
  for (const row of configData.slice(1)) {
    if (String(row[0]).trim().toUpperCase() === type.toUpperCase() &&
        String(row[1]).trim().toUpperCase() === selectedBranch.toUpperCase()) {
      currentSpreadsheetId = row[2];
    }
  }
  if (!currentSpreadsheetId) return null;

  const sheetOrder = await getSheetTitles(currentSpreadsheetId);
  const normBasic = (b) => String(b).replace(/[^A-Za-z0-9]/g, "").trim().toUpperCase();
  // Original applied this RACK->RACKS fix only in the monthly-trend match,
  // not in the current-value or branch-contribution matches. Kept as-is.
  const normWithRackFix = (b) => normBasic(b).replace(/RACK$/, "RACKS");
  const selectedBrandForMonthly = normWithRackFix(category);
  const selectedBrandBasic = normBasic(category);

  const monthly = [];
  for (const sheetName of sheetOrder) {
    const data = await getSheetValues(currentSpreadsheetId, sheetName);
    for (let i = 0; i < data.length; i++) {
      if (normBasic(data[i][1]) === selectedBrandForMonthly) {
        monthly.push([sheetName, Number(data[i][3]) || 0]);
        break;
      }
    }
  }
  monthly.sort((a, b) => sheetOrder.indexOf(a[0]) - sheetOrder.indexOf(b[0]));

  const currentData = await getSheetValues(currentSpreadsheetId, selectedMonth);
  let totalSales = 0, percent = 0;
  currentData.forEach((row) => {
    if (normBasic(row[1]) === selectedBrandBasic) {
      totalSales = Number(row[3]) || 0;
      percent = Number(String(row[4]).replace("%", "")) || 0;
    }
  });

  let growthMonth = 0, growthQuarter = 0;
  const currentIndex = monthly.findIndex((m) => m[0] === selectedMonth);
  if (currentIndex > 0) {
    const previous = monthly[currentIndex - 1][1];
    if (previous > 0) growthMonth = ((totalSales - previous) / previous) * 100;
  }
  if (currentIndex >= 3) {
    const quarterValue = monthly[currentIndex - 3][1];
    if (quarterValue > 0) growthQuarter = ((totalSales - quarterValue) / quarterValue) * 100;
  }

  const branches = [];
  for (const row of configData.slice(1)) {
    const reportType = String(row[0]).trim().toUpperCase();
    if (reportType !== type.toUpperCase()) continue;
    const branchName = String(row[1]).trim();
    const spreadsheetId = String(row[2]).trim();
    try {
      const titles = await getSheetTitles(spreadsheetId);
      if (!titles.includes(selectedMonth)) continue;
      const data = await getSheetValues(spreadsheetId, selectedMonth);
      data.forEach((r) => {
        if (normBasic(r[1]) === selectedBrandBasic) branches.push([branchName, Number(r[3]) || 0]);
      });
    } catch (err) { console.warn(err); }
  }

  return {
    totalSales: totalSales.toFixed(2),
    percent: percent.toFixed(1),
    growthMonth: growthMonth.toFixed(1),
    growthQuarter: growthQuarter.toFixed(1),
    monthly,
    branches,
  };
}

/* ========================= PURCHASE DATA ========================= */
async function getPurchaseData() {
  return getSheetValues(CONFIG.purchaseSpreadsheetId, CONFIG.purchaseSheetName);
}
