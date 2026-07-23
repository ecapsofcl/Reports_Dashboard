# eCAPS Dashboard — Static GitHub Pages Build

This is your full dashboard (Overview, Tasks, Sales — Top 6/Netfox/SonicWall,
Purchases, PDF export) rebuilt to run as a static site with **no backend at
all**. It reads your Google Sheets directly from the browser and gates access
with a login screen.

**Read the security note below before putting real data behind this.**

## Files

```
index.html          Page shell — sidebar, Overview markup, loads everything else
style.css            Main premium theme (was styles.html)
login-style.css       Login screen theme (was login-styles.html)
auth.html             Login screen markup (unchanged)
tasks.html            Tasks section markup (unchanged)
sales.html            Sales section markup (unchanged)
purchase.html         Purchases section markup (unchanged)
report-center.html    Report Center markup (unchanged)
scripts.js            Your original scripts.html logic — 18 call sites that
                       used to say google.script.run now call the functions
                       in dataLayer.js instead. Everything else is untouched.
config.js             ← the only file you need to fill in (IDs, key, password)
gviz.js               Low-level Google Sheets readers (new)
dataLayer.js          Client-side port of Code.gs's business logic (new)
```

## 1. Set up Google Sheets access

Every spreadsheet this dashboard reads from — the sales config sheet, every
branch's TOP6/NF/SONIC workbook, every team member's task sheet, and the
purchases sheet — needs to be shared **"Anyone with the link — Viewer"**.
(Share button → General access → Anyone with the link.) This is what lets
the static site read them with no login of its own to Google.

## 2. Get a Google Sheets API key

Cell values are read through the free public CSV export, but listing a
spreadsheet's **tab names** (which months exist, etc.) needs the Sheets API:

1. [console.cloud.google.com](https://console.cloud.google.com) → new project (or pick one)
2. APIs & Services → Library → enable **Google Sheets API**
3. APIs & Services → Credentials → Create Credentials → API key
4. Click the key → **Application restrictions** → HTTP referrers → add
   `https://yourname.github.io/*`
5. **API restrictions** → Restrict key → **Google Sheets API** only

## 3. Fill in `config.js`

```js
sheetsApiKey: "...",                 // from step 2
salesConfigSpreadsheetId: "...",     // the SALES_CONFIG_ID sheet
purchaseSpreadsheetId: "...",
purchaseSheetName: "Purchase",
members: [ ... ],                    // already filled in from your Code.gs
authPasswordHash: "...",             // see step 5
```

## 4. Push to GitHub and enable Pages

```bash
git init
git add .
git commit -m "eCAPS dashboard — static build"
git branch -M main
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```
Then **Settings → Pages → Source: Deploy from branch → main / (root)**.

## 5. Set your own password

Default demo password: `eCAPS@2026`. To change it, run in any browser console:
```js
crypto.subtle.digest("SHA-256", new TextEncoder().encode("yourPassword"))
  .then(b => console.log([...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("")))
```
Paste the printed hash into `config.js` → `authPasswordHash`.

---

## ⚠️ Security — please read this before sharing the link

**This is a UI gate, not real protection.** A static site has no server to
keep secrets on, so:

- Every spreadsheet ID and the Sheets API key are visible in your page's
  JavaScript source to anyone who opens dev tools — whether or not they
  log in.
- Because those spreadsheets must be shared "Anyone with the link," anyone
  who extracts the ID from your source (or your public GitHub repo, since
  you chose a public repo) can open the underlying Google Sheet directly,
  or read it the same way this dashboard does — completely bypassing the
  login screen.
- The login screen only stops someone from casually opening the dashboard
  *UI*. It does not protect the data itself.

If your sales figures are genuinely sensitive, the safer options are:
- Go back to hosting this on **Apps Script** (`Deploy → Web app`), where
  `checkPassword()` runs server-side and the Sheets are never exposed —
  this is what the project already does today.
- Or keep it on GitHub Pages but make the **repo private** and put the
  whole site behind **GitHub's built-in access control** (private repos
  can still use Pages on GitHub Pro/Team/Enterprise, restricted to people
  you invite) rather than relying on the in-app password.

## What's different from Code.gs (and why)

- **`getPurchaseData()`** now reads a spreadsheet ID + tab name you set in
  `config.js`, instead of `SpreadsheetApp.getActive()`. The original relied
  on the script being bound to a specific spreadsheet, which doesn't apply
  here — there's no "active" spreadsheet in a static page.
- **Tab-name listing** (`getSheetTitles`) uses the Sheets API + your key.
  Cell values (`getSheetValues`) use the public CSV export and need no key.
  Both require "Anyone with the link — Viewer" sharing.
- **Email Reports** isn't implemented — `MailApp` doesn't exist outside
  Apps Script. The button still shows an example alert like before; wiring
  it up for real would need a small serverless function (e.g. a free
  Cloudflare Worker or a re-purposed Apps Script endpoint) to send mail.
- **PDF export (`exportPDF`, `generateAllBranchPDF`, etc.) is unchanged**
  and fully client-side already (`html2pdf.js`), so it works exactly as
  it did before.
- Two bits of dead code from the original were not ported (documented at
  the top of `dataLayer.js`): a duplicate client-side `getSalesBranches`
  that referenced `SpreadsheetApp` (a server-only API — it could never
  have run in the browser to begin with) and `updateOverviewUI`, which
  referenced `document.getElementById` from inside `Code.gs` and was
  never called by anything.
- One subtle adaptation: `getSonicwallDashboardData` originally detected
  numeric columns via `typeof v === "number"`, which only works with Apps
  Script's typed `getValues()`. Since the public CSV export always returns
  strings, the ported version detects "is this cell numeric" by
  parseability instead — same intent, same result, different mechanism.

## Local preview

```bash
python3 -m http.server 8000
# visit http://localhost:8000
```
