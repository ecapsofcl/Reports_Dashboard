/**
 * config.js
 * ---------------------------------------------------------------------
 * Everything you need to fill in to connect this to YOUR Google Sheets
 * lives in this one file. Nothing else needs editing to get data flowing.
 * ---------------------------------------------------------------------
 */
const CONFIG = {

  // ---- Google Sheets API key (read-only, restricted) -------------------
  // Needed only to list a spreadsheet's TAB NAMES (e.g. which months
  // exist for a branch). Actual cell values are read via the public
  // gviz/CSV endpoint below and do NOT need this key.
  //
  // How to get one:
  //   1. console.cloud.google.com -> new (or existing) project
  //   2. APIs & Services -> Library -> enable "Google Sheets API"
  //   3. APIs & Services -> Credentials -> Create Credentials -> API key
  //   4. Click the key -> Application restrictions -> HTTP referrers ->
  //      add your github.io URL (e.g. https://yourname.github.io/*)
  //   5. API restrictions -> Restrict key -> Google Sheets API only
  sheetsApiKey: "AIzaSyB2wLhVjvxfUJ5K270gw21ffVKMe5PDhr4",

  // ---- The config spreadsheet (SALES_CONFIG_ID in the original Code.gs)
  // Sheet1 columns: ReportType (TOP6/NF/SONIC) | Branch | SpreadsheetId
  salesConfigSpreadsheetId: "1iSYbNyZjQdhp0wHS1vd0MTQlYSY5G0BWlqSotTISeAs",

  // ---- Task tracker members (same list as getMembers() in Code.gs) -----
  members: [
    { name: "Sayisree",  id: "1b8yiDixphIOXPGmIdrjvdvVkaw6_5fa6X1ClocS4o0o" },
    { name: "Anitha",    id: "11IuX8BtXd75KZsxi9vUXQWQua7b9CRJJUHQfs130UOY" },
    { name: "Jamuna",    id: "1du9skTIQBjncl_rAVdbpnBsnR_TMaJKSIvphDBER_aU" },
    { name: "Sanofer",   id: "1zmyGlC2_Z7kuXTj8od5iGTss652NdW2TP2ptGcAb8Yo" },
    { name: "Vaishnavi", id: "12PZ5YdbH2M-Uu824AkIsPjOS0Vr5LwfZg43IUjy_0ZA" },
  ],

  // ---- Purchases spreadsheet + tab name ---------------------------------
  purchaseSpreadsheetId: "YOUR_PURCHASE_SPREADSHEET_ID",
  purchaseSheetName: "Purchase",

  // ---- Login -------------------------------------------------------------
  // SHA-256 hash of the login password. This is a UI gate only — see the
  // security note in README.md before treating this as real protection.
  // Default password for this demo is: eCAPS@2026
  // To set your own: open any browser console and run
  //   crypto.subtle.digest("SHA-256", new TextEncoder().encode("yourPassword"))
  //     .then(b => console.log([...new Uint8Array(b)]
  //       .map(x => x.toString(16).padStart(2,"0")).join("")))
  // then paste the printed hash below.
  authPasswordHash:
    "23bfda1d0a7873a43da7500810b06bd3ecacdc621dc836ac4c113ed944dd2a60",
};
