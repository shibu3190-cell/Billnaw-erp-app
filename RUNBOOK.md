# Billnaw — Run, Test & Deploy Runbook

Follow in order. Each phase ends with a **checkpoint** — do not move on until it passes.

---

# PHASE 0 — Install prerequisites (once)

| Tool | Why | Check it works |
|---|---|---|
| [VS Code](https://code.visualstudio.com) | editor | `code --version` |
| [Node.js 18+](https://nodejs.org) | runs the local server + Supabase CLI | `node --version` |
| [Git](https://git-scm.com/downloads) | version control | `git --version` |
| Google Chrome | Web Bluetooth only works in Chrome/Edge | — |

Install the Supabase CLI:
```bash
npm install -g supabase
supabase --version
```

**VS Code extensions worth adding** (Extensions sidebar, search by name):
- **Live Server** — one-click local server with auto-reload
- **ESLint** — catches typos before you run
- **SQLTools + PostgreSQL driver** — optional, query Supabase from inside VS Code

---

# PHASE 1 — Open the project in VS Code

1. Put all project files in one folder, e.g. `C:\projects\billnaw` or `~/projects/billnaw`.
2. Your folder must look exactly like this:

```
billnaw/
├── index.html
├── app.js
├── gstConfig.js
├── supabaseClient.js
├── styles.css
├── sw.js
├── manifest.json
├── icon.svg
├── .gitignore
├── SETUP.md
├── RUNBOOK.md
└── supabase/
    ├── migrations/
    │   ├── 0001_init.sql
    │   └── 0002_stock_rpc.sql
    └── functions/
        └── ai-invoice-parse/
            └── index.ts
```

3. `File → Open Folder → billnaw`
4. Open the terminal inside VS Code: **Ctrl + `** (backtick) / **Cmd + `** on Mac.

**Checkpoint:** you see all 8 root files in the VS Code sidebar. If `supabase/` is missing, the AI entry and database steps will fail later.

---

# PHASE 2 — Supabase project & database

## 2.1 Create the project
1. Go to [supabase.com](https://supabase.com) → sign in → **New Project**.
2. Name: `billnaw`. Set a strong database password (save it somewhere).
3. Region: pick the one closest to your users (for India: Mumbai / Singapore).
4. Wait ~2 minutes for provisioning.

## 2.2 Get your keys
**Settings (gear icon) → API**. Copy these two:
- **Project URL** — looks like `https://abcdefgh.supabase.co`
- **anon / public key** — a long `eyJhbGci...` string

> The anon key is **safe** to put in your code and commit to Git. It has no power on its own — the RLS policies you're about to install are what actually protect data.
> The **service_role** key on that same page is the opposite: it bypasses all security. Never put it in any file in this project.

## 2.3 Run the migrations
1. Supabase Dashboard → **SQL Editor** → **New query**.
2. Open `supabase/migrations/0001_init.sql` in VS Code, select all (Ctrl+A), copy.
3. Paste into the SQL Editor → **Run**.
4. Repeat for `supabase/migrations/0002_stock_rpc.sql`.

**Checkpoint:** Dashboard → **Table Editor** shows 7 tables:
`shops`, `profiles`, `items`, `customers`, `sales`, `ai_purchase_staging`, `audit_log`.

If you see an error instead, read the message — the most common cause is running `0002` before `0001` (it depends on functions defined in `0001`).

## 2.4 Configure auth for testing
**Authentication → Providers → Email:**
- Enable Email: **ON**
- Confirm email: **OFF** *(turn back ON before real customers — it stops junk signups)*

**Authentication → Providers → Phone:**
- Leave OFF for now. Phone OTP needs a paid SMS provider (Twilio etc.). Email OTP works with zero extra setup — test with that first.

## 2.5 Paste your keys into the app
Open `supabaseClient.js` in VS Code, edit the top two lines:
```js
const SUPABASE_URL = 'https://YOUR-PROJECT-REF.supabase.co';   // ← paste Project URL
const SUPABASE_ANON_KEY = 'YOUR-ANON-PUBLIC-KEY';               // ← paste anon key
```
Save (Ctrl+S).

**Checkpoint:** neither line still contains the word `YOUR-`.

---

# PHASE 3 — Run it locally on PC

## 3.1 Start a local server
**You cannot just double-click `index.html`.** Opening it as `file://` breaks service workers, module loading, and Supabase auth redirects.

In the VS Code terminal:
```bash
npx serve .
```
It prints something like `Local: http://localhost:3000`.

*(Alternative: right-click `index.html` in VS Code → **Open with Live Server**.)*

## 3.2 Open in Chrome
Go to `http://localhost:3000`. Press **F12** to open DevTools and keep the **Console** tab visible for the entire test — errors appear there, not on screen.

**Checkpoint:** the dark green login screen appears with **Email / Phone OTP** toggle buttons. Console shows no red errors.

> If the console says *"supabase is not defined"* → the CDN script didn't load; check your internet connection.
> If it says *"Failed to fetch"* on any action → your `SUPABASE_URL` is wrong.

---

# PHASE 4 — Test script (PC)

Run these in order and tick each one off.

## TEST 1 — Registration + email OTP
1. Click **Register Business** tab.
2. Fill in:
   - Business Name: `Abhijit Electronics`
   - GSTIN: `19ABCDE1234F1Z5` *(19 = West Bengal — this sets your shop's home state)*
   - Phone: `9876543210`
   - Address: `Burrabazar, Kolkata, WB, 700007`
   - Industry: **Electronics**
   - Email: **a real inbox you can open**
   - Password: `test1234`
   - PIN: `4821`
3. Click **Save & Launch Terminal**.

**Expect:** the 6-box OTP screen appears. Check your email for the code.

4. Type the code (it auto-submits on the 6th digit).

**Expect:** OTP screen closes → PIN unlock screen appears showing "Abhijit Electronics".

5. Enter PIN `4821`.

**Expect:** you land on the Dashboard.

**Verify in Supabase:** Table Editor → `shops` has 1 row; `profiles` has 1 row with `role = owner` and a matching `shop_id`.

> ❌ *No email arrived?* Check spam. Supabase's built-in email service is rate-limited (a few per hour) — for heavy testing, Settings → Auth → SMTP and plug in your own SMTP.

## TEST 2 — Login methods
1. Login screen → **Not you? Sign out of this account**.
2. Sign back in with email + password → should reach the PIN screen.
3. Sign out again → click **Sign in with a one-time code instead** → verify via OTP.

**Checkpoint:** both paths reach the PIN screen.

## TEST 3 — Add stock
1. Sidebar → **Inventory / Items** → add a product manually:
   - Name: `Motorola G84 5G`, Category: Electronics, HSN: `8517`, GST: **18**, Qty: `10`, Cost: `16200`, Price: `18999`
2. Add a second: `Gold Chain 22K`, Category: Jewelry, HSN: `7113`, GST: **3**, Qty: `5`, Price: `65000`

**Verify in Supabase:** `items` table has 2 rows with your `shop_id`.

## TEST 4 — Intra-state sale (CGST + SGST)
1. **POS** tab → click the Motorola card → set qty `1` → confirm.
2. Party info: Phone `9800000001`, Name `Ramesh`, Address `Salt Lake, Kolkata`, State **West Bengal**, no GSTIN.

**Expect:** the hint under the fields reads **"Tax type: CGST + SGST (intra-state)"**.

3. Tender: **Cash** → Checkout.

**Expect on the invoice:**
- Tax table columns: HSN | Taxable | CGST% | CGST Amt | SGST% | SGST Amt | Total Tax
- Taxable `18999.00`, CGST `1709.91`, SGST `1709.91`, Total `₹22,419`
- Supply Type: **Intra-State (CGST + SGST)**
- Amount in words: *Twenty Two Thousand Four Hundred Nineteen Rupees Only*
- Address line shows `Salt Lake, Kolkata`
- Identifier column header reads **"Serial No. / IMEI"** (Electronics industry)

**Verify in Supabase:** `sales` has 1 row, `interstate = false`, `total = 22419`.

## TEST 5 — Inter-state sale (IGST)
Same as above, but customer GSTIN `27ABCDE1234F1Z5` (27 = Maharashtra).

**Expect:** hint flips to **"Tax type: IGST (inter-state)"** *as you type the GSTIN*, the state dropdown auto-jumps to Maharashtra, and the printed tax table shows only **IGST** columns.

**Verify:** `sales` row has `interstate = true`.

## TEST 6 — Stock decrement
Check the Motorola card now reads **8 left** (10 − 1 − 1).

**Verify in Supabase:** `items` → Motorola `stock = 8`.

> This proves the atomic `decrement_item_stock` RPC is working.

## TEST 7 — Dashboard
Go to **Dashboard**.

**Expect:** Total Orders `2`, revenue populated, donut chart drawn, **Orders & Sales Trend** chart shows a line with points on today's date, Recent Invoices lists both bills, Top Parties lists your customers. Switch the trend dropdown to **Last 7 Days** — chart redraws.

> Every one of these was a dead `0` before — if any still shows `0`, screenshot the console and tell me.

## TEST 8 — Reports & CSV
**Reports** → open each:
- **GSTR-1** — HSN rows with CGST/SGST/IGST columns. **The taxable + tax totals here must equal the sum of your two invoices.**
- **Stock Summary** — valuation at cost and selling price
- **Sales Daybook** — both invoices with a TOTAL row
- **Party Outstanding** — your customers

Click **Export CSV** on any report → a real `.csv` downloads and opens in Excel.

## TEST 9 — GST slab config
**Settings → Printer Hardware** tab → scroll to **GST Rate Slabs**.
1. Change to `0, 3, 5, 12, 18, 28, 40` → **Save GST Slabs**.
2. Go add a new product — the GST dropdown now offers **40%**.
3. **Critical:** reopen your earlier invoices — they must still show 18% and 3%. Historical bills never recalculate.

## TEST 10 — Printer settings
**Settings → Printer Hardware:**
- Switch **Primary Output Device** between the four options → the thermal-width selector shows only for Bluetooth Thermal.
- With A4 selected, make a sale → system print dialog opens.
- Bluetooth Thermal: click **Pair Bluetooth Printer** → Chrome's device picker appears (this alone proves Web Bluetooth works, even with no printer to hand). Cancel it — no error alert should appear.

## TEST 11 — Offline behaviour
1. DevTools → **Network** tab → set throttling to **Offline**.
2. Make a sale. It should complete and print normally.
3. Set back to **Online**, refresh.

**Verify in Supabase:** the offline sale eventually appears in `sales` (queue flushes on reconnect).

## TEST 12 — Tenant isolation (the security test — do not skip)
1. Open an **incognito window** → `http://localhost:3000`.
2. Register a *second* shop with a different email: `Priya Pharmacy`, industry Pharmacy.
3. In that window, check Items, Sales, Dashboard, Reports.

**Expect:** Priya's shop sees **zero** of Abhijit's items, invoices, or customers.

4. In Supabase → `shops` → set Abhijit's `status` to `revoked`.
5. Back in Abhijit's window, refresh.

**Expect:** locked out with an "account is revoked" message.
6. Set `status` back to `active` → access restored.

> If Priya can see *any* of Abhijit's data, **stop and tell me immediately** — that's an RLS failure and nothing else matters until it's fixed.

---

# PHASE 5 — AI purchase entry

This needs the Edge Function deployed (the API key must live server-side — it cannot go in the browser).

## 5.1 Get a Gemini API key
[ai.google.dev](https://ai.google.dev) → **Get API key** → create. Free tier is fine for testing.

## 5.2 Deploy the function
In the VS Code terminal, from the project root:
```bash
supabase login
# opens a browser to authorise

supabase link --project-ref YOUR-PROJECT-REF
# the ref is the subdomain in your Project URL

supabase secrets set GEMINI_API_KEY=paste_your_key_here

supabase functions deploy ai-invoice-parse
```

**Checkpoint:** Supabase Dashboard → **Edge Functions** → `ai-invoice-parse` listed as deployed.

## 5.3 TEST 13 — AI invoice reading
1. Take a **photo of any real supplier purchase bill** (or use a clear screenshot of one).
2. App → **Inward / Purchase** → AI dropzone → upload the image.
3. Wait — the label changes to "⏳ Reading invoice with AI…".

**Expect:** the staging table fills with **the actual items from your photo** — not Motorola/SanDisk/Gold Chain. (If you see those three, you're running an old cached `app.js` — hard-refresh with Ctrl+Shift+R.)

4. Review the rows, correct anything misread, click commit.

**Verify:** items appear in your inventory, and `ai_purchase_staging` in Supabase has a row with `status = pending`.

**If it fails:** Supabase → Edge Functions → `ai-invoice-parse` → **Logs**. Common causes: key not set (`GEMINI_API_KEY not set`), or the image was too blurry for the model.

---

# PHASE 6 — Git

## 6.1 First push
```bash
git init
git add .
git commit -m "Billnaw POS: GST billing, OTP auth, Supabase backend, AI purchase entry"
git branch -M main
```

Create an empty repo on [github.com/new](https://github.com/new) — **do not** tick "Add README". Then:
```bash
git remote add origin https://github.com/YOUR-USERNAME/billnaw.git
git push -u origin main
```

**Checkpoint:** refresh GitHub — your files are there. Confirm `.env` is **not** listed (`.gitignore` handles it).

## 6.2 Everyday updates — use VS Code's UI
1. Edit files.
2. **Source Control** sidebar (branch icon, Ctrl+Shift+G).
3. Type a message → **Commit** → **Sync Changes**.

Or terminal:
```bash
git add .
git commit -m "what changed"
git push
```

## 6.3 ⚠️ The one rule you must not forget
**Every time you change `app.js`, `index.html`, `styles.css`, `gstConfig.js`, or `supabaseClient.js`, bump the version in `sw.js` first:**
```js
const CACHE_NAME = 'billnaw-v8.0-offline';   // → v8.1, v8.2, ...
```
That string change is the *only* thing that makes existing users' browsers notice an update and show the "Update Now" banner. Forget it, and your users keep running the old app forever while you wonder why your fix didn't reach them.

---

# PHASE 7 — Deploy (needed for Android testing)

Any static host works. Fastest:

```bash
npm install -g vercel
vercel
```
Answer the prompts (accept defaults). You get an HTTPS URL like `https://billnaw.vercel.app`.

**Alternative — Netlify:** drag the folder onto [app.netlify.com/drop](https://app.netlify.com/drop).

**Then, back in Supabase:** Authentication → **URL Configuration** → add your new HTTPS URL to **Site URL** and **Redirect URLs**. Skip this and OTP email links will bounce.

---

# PHASE 8 — Android testing

**This must use the HTTPS URL from Phase 7, not localhost.** Web Bluetooth and PWA install both require a secure context; your phone hitting your PC's local IP is not one.

## TEST 14 — Install as an app
1. Open the HTTPS URL in **Chrome on Android**.
2. Menu (⋮) → **Add to Home screen** / **Install app**.
3. Launch from the home screen icon.

**Expect:** opens fullscreen with no browser address bar.

## TEST 15 — Mobile layout
- Sidebar is replaced by the bottom nav bar
- POS: catalog and cart stack vertically
- OTP boxes fit on one line without horizontal scrolling
- Dashboard KPI cards and charts fit the screen width
- No element requires sideways scrolling

## TEST 16 — Thermal printing (needs a real printer)
1. Turn on your Bluetooth thermal printer, pair it in Android Settings first.
2. App → Settings → Printer Hardware → **Bluetooth Thermal**, set roll width.
3. **Pair Bluetooth Printer** → pick it from Chrome's list.
4. **Test Print Receipt**.

**Expect:** a receipt prints; the status line turns green with the printer name.

5. Now switch the printer **off** and make a sale.

**Expect:** it falls back to the A4/PDF dialog within ~4 seconds and the status line explains why — it must not freeze the checkout.

## TEST 17 — The update flow
1. On your PC, make a small visible change (e.g. edit a heading in `index.html`).
2. **Bump `CACHE_NAME`** in `sw.js`.
3. `git push` and redeploy (`vercel --prod`).
4. On the Android device, close and reopen the installed app.

**Expect:** the "🔄 A new version is available" banner appears at the top. Tap **Update Now** → app reloads with your change and the old cache is cleared.

## TEST 18 — Real-device isolation re-check
Sign in as Priya on the phone while Abhijit is signed in on the PC. Ring up a sale on each. Confirm neither sees the other's data, and that **the two invoices have different invoice numbers**.

---

# Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `supabase is not defined` | CDN blocked / offline | Check connection; the SDK loads from jsdelivr |
| `Failed to fetch` on every action | Wrong `SUPABASE_URL` | Re-copy from Settings → API |
| `new row violates row-level security` | Profile row missing or shop revoked | Check `profiles` has a row for your user; check `shops.status = 'active'` |
| No OTP email | Rate limit or spam folder | Check spam; configure your own SMTP for heavy testing |
| Phone OTP errors | No SMS provider | Expected — configure Twilio, or use email OTP |
| AI returns the old Motorola/SanDisk list | Stale cached `app.js` | Ctrl+Shift+R hard refresh; bump `CACHE_NAME` |
| AI returns `GEMINI_API_KEY not set` | Secret missing | Re-run `supabase secrets set GEMINI_API_KEY=...` then redeploy |
| Bluetooth picker never opens | Not Chrome, or not HTTPS | Use Chrome; use the deployed HTTPS URL, not localhost, on mobile |
| Update banner never appears | `CACHE_NAME` unchanged | Bump it, redeploy |
| Invoice number collision | Two devices offline simultaneously | Reconciles on next online load; report if it persists |

---

# Known limits (be aware before going live)

1. **Not a GSTN e-filing integration.** GSTR-1 gives you correct HSN-wise numbers to read or re-key. It does not generate the portal's JSON or call any government API. E-invoice (IRN) and e-way bill generation are **not** built.
2. **The 4-digit PIN is a shift-lock, not security.** It's stored locally in plain text. The real boundary is the Supabase session + RLS. Anyone with devtools access to the device can read that PIN.
3. **Phone OTP needs a paid SMS provider** before it does anything.
4. **Purchase/vendor bill history is local-only** — not yet synced to Supabase.
5. **Reports read from local state**, not a live cloud query. Accurate on the device that made the sales; a second device needs a refresh to see them.
6. **Invoice-save and stock-decrement are two separate calls**, not one transaction. A connection drop between them can leave stock un-decremented for a saved invoice. Rare, but real.

---

# Quick reference

```bash
npx serve .                          # run locally
git add . && git commit -m "msg" && git push    # push update
vercel --prod                        # deploy
supabase functions deploy ai-invoice-parse      # redeploy AI function
supabase functions logs ai-invoice-parse        # debug AI
```

**Before every deploy:** bump `CACHE_NAME` in `sw.js`.
