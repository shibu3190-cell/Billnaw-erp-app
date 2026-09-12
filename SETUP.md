# Billnaw — Setup (Supabase backend)

## 1. Create the Supabase project
1. supabase.com → New Project. Note the **Project URL** and **anon public key**
   (Settings → API) — you'll need both in step 3.
2. Settings → Auth → disable "Confirm email" for now (dev convenience — turn
   it back on before real customers sign up, so bogus emails can't register).

## 2. Run the database migrations
1. Supabase Dashboard → SQL Editor → New query.
2. Paste the **entire contents** of `supabase/migrations/0001_init.sql`, run it.
3. New query again, paste `supabase/migrations/0002_stock_rpc.sql`, run it.
4. Repeat **in order** for each remaining migration — later ones depend on
   functions defined in earlier ones, so order matters:
   - `0003_atomic_invoice.sql` — atomic invoice commit + server invoice numbering
   - `0004_role_cost_visibility.sql` — cashiers can't read wholesale cost
   - `0005_sales_returns.sql` — credit notes, restock, GST reversal
   - `0006_alerts_logo_composition.sql` — logo, stock/expiry alerts, medicine composition
   - `0007_purchases_vendors.sql` — cloud purchase/vendor history, weighted-average cost
   - `0008_subscription_plans.sql` — subscription plans (currently: everyone on 'free', all features unlocked)

## Running the test suite
```bash
node tests/run-tests.js
node tests/shop-day-simulation.js
```
The second file runs a full register → sell (cash + credit + inter-state) →
return → dashboard-reconciliation sequence as one connected scenario, the
way a shop owner would actually use a day, rather than testing each
function in isolation.
31 tests covering tax arithmetic, GST place-of-supply, CGST/SGST splits,
round-off, returns/credit-note reversal, expiry parsing, composition
matching, XSS escaping, offline-queue ordering and weighted-average cost.
Exits non-zero on failure, so it drops straight into CI.
5. Table Editor → confirm you see: shops, profiles, items, customers, sales,
   sales_returns, ai_purchase_staging, audit_log.

## 3. Configure the frontend
Open `supabaseClient.js`, replace the two placeholder lines:
```js
const SUPABASE_URL = 'https://YOUR-PROJECT-REF.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR-ANON-PUBLIC-KEY';
```
with your actual values from step 1. The anon key is safe to commit — RLS
is what actually protects data, not secrecy of this key.

## 4. Deploy the AI Edge Function
Requires the Supabase CLI (`npm install -g supabase` or see supabase.com/docs/guides/cli).
```bash
supabase login
supabase link --project-ref YOUR-PROJECT-REF
supabase secrets set GEMINI_API_KEY=your_gemini_key_here
supabase functions deploy ai-invoice-parse
```
Get a Gemini API key free at ai.google.dev if you don't have one.

## 5. Make yourself Super-Admin (do this once, manually)
After you've registered your own shop through the app once:
1. Table Editor → `profiles` → find your row (by email in auth → Users).
2. Edit `role` from `owner` to `super_admin`.
Do this only for accounts you personally control — this role bypasses shop
isolation for support purposes and every read/write it makes is written to
`audit_log`.

## 6. Run locally
This is a static site — no build step. Any static server works:
```bash
npx serve .
# or: python3 -m http.server 8080
```
Open the printed URL, register a shop, sign in, make a test sale.

## 7. Test the isolation (do this before trusting it)
1. Register two different shops (two browsers/incognito windows, two emails).
2. Confirm Shop A cannot see Shop B's items/sales anywhere in the UI.
3. In Supabase Table Editor, set Shop B's `status` to `revoked`.
4. Shop B's browser should get kicked to the login screen with an
   "account is revoked" message on its next action.

## 8. Deploy to production hosting
Any static host works (Vercel, Netlify, Cloudflare Pages, GitHub Pages).
No server runtime needed — Supabase IS the backend.

---

## Ongoing update flow
Every time you change `app.js` / `index.html` / `styles.css`:
1. **Bump `CACHE_NAME` in `sw.js`** (e.g. `v7.1` → `v7.2`) — this is what
   triggers the in-app "Update Available" banner for existing users.
2. Commit, push, redeploy.

## What's still local-only (not yet in Supabase) — next increments
- Purchase/vendor bill history (currently local-state only)
- Full customer order-history detail (dues/LTV sync to cloud; per-order
  history array stays local for now)
- Reports (GSTR-1/Stock/Sales Daybook) read from local `APP_STATE`, not a
  live Supabase query — fine for a single device, will need a refresh-from-
  cloud button if you rely on multi-device reporting soon.
