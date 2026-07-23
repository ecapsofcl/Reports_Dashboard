/**
 * gviz.js
 * ---------------------------------------------------------------------
 * Two primitives that stand in for SpreadsheetApp in the original
 * Code.gs:
 *
 *   getSheetTitles(spreadsheetId)            ~= ss.getSheets().map(getName())
 *   getSheetValues(spreadsheetId, sheetName)  ~= sheet.getDataRange().getValues()
 *
 * Both require the spreadsheet to be shared "Anyone with the link —
 * Viewer". getSheetValues additionally works with no API key at all
 * (it's the same public CSV export Sheets has always had); only
 * getSheetTitles needs the Sheets API key from config.js, since listing
 * tab names isn't something the public CSV export exposes.
 * ---------------------------------------------------------------------
 */

const _titlesCache = new Map(); // spreadsheetId -> Promise<string[]>
const _valuesCache = new Map(); // `${id}::${sheet}` -> Promise<string[][]>

async function getSheetTitles(spreadsheetId) {
  if (_titlesCache.has(spreadsheetId)) return _titlesCache.get(spreadsheetId);

  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}` +
    `?fields=sheets.properties.title&key=${CONFIG.sheetsApiKey}`;

  const promise = fetch(url)
    .then((res) => {
      if (!res.ok) throw new Error(`Sheets API ${res.status} for ${spreadsheetId} — check sharing + API key`);
      return res.json();
    })
    .then((json) => (json.sheets || []).map((s) => s.properties.title));

  _titlesCache.set(spreadsheetId, promise);
  return promise;
}

async function getSheetValues(spreadsheetId, sheetName) {
  const key = `${spreadsheetId}::${sheetName}`;
  if (_valuesCache.has(key)) return _valuesCache.get(key);

  const url =
    `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq` +
    `?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;

  const promise = fetch(url)
    .then((res) => {
      if (!res.ok) throw new Error(`Sheet fetch ${res.status} for "${sheetName}" — check sharing settings`);
      return res.text();
    })
    .then((csvText) => {
      const result = Papa.parse(csvText, { skipEmptyLines: false });
      return result.data; // array of arrays of strings, same shape as getValues()/getDisplayValues()
    });

  _valuesCache.set(key, promise);
  return promise;
}

/** Clears cached reads — call after a manual refresh if you add one. */
function clearSheetCache() {
  _titlesCache.clear();
  _valuesCache.clear();
}
