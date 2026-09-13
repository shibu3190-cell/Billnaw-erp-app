# Connecting Gemini to Purchase Entry

## 1. Get a Gemini API key
[ai.google.dev](https://ai.google.dev) → **Get API key** → create in a Google Cloud project.
Free tier covers roughly 1,500 requests/day — far more than a single shop
photographs in supplier bills.

## 2. Store the key as a Supabase secret
It goes on the **server**, never in `app.js`. Anything in the browser bundle is
readable by anyone who opens devtools, and a leaked key is billable to you.

```bash
supabase login
supabase link --project-ref YOUR-PROJECT-REF
supabase secrets set GEMINI_API_KEY=AIza...your_key_here
```

Verify it registered:
```bash
supabase secrets list
```

## 3. Deploy the function
```bashru
supabase functions deploy ai-invoice-parse
```

Confirm in Dashboard → **Edge Functions** that `ai-invoice-parse` shows as deployed.

## 4. Run the migrations it depends on
The function writes to `ai_purchase_staging` (migration `0001`) and the merge
writes to `purchases` / `vendors` (migration `0007`). Both must be applied or
the flow fails at the last step, after the AI work is already paid for.

## 5. Smoke-test before using a real bill

```bash
# Get a JWT: sign in to the app, then in the browser console:
#   (await window.SB.client.auth.getSession()).data.session.access_token

curl -X POST \
  "https://YOUR-PROJECT-REF.supabase.co/functions/v1/ai-invoice-parse" \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d "{\"image_base64\":\"$(base64 -w0 bill.jpg)\",\"mime_type\":\"image/jpeg\"}"
```

A healthy response has `bill_header`, `bill_items`, `bill_summary` and
`extraction_meta`.

## 6. Watch the logs while testing
```bash
supabase functions logs ai-invoice-parse --tail
```

---

# How the flow works

```
Photo/PDF  →  Edge Function  →  Gemini 2.0 Flash (structured output)
                    ↓
           normaliseAndReconcile()      ← arithmetic re-derived, not trusted
                    ↓
           ai_purchase_staging          ← written BEFORE responding
                    ↓
           Review screen (editable)     ← human confirms
                    ↓
           commitAiBill()
                    ↓
       stock in + purchases row + vendor payables   (one atomic RPC)
```

## Why it doesn't just trust Gemini

A vision model will return a `grand_total` that doesn't equal the sum of the
line items it just extracted. Accepting that writes a wrong cost into
inventory and a wrong ITC figure into GSTR-2.

So every response is re-derived server-side:

| Check | What happens on mismatch |
|---|---|
| Line total vs `qty × rate + GST` | Warning naming the product; derived value used if the model returned 0 |
| Bill total vs sum of lines | Warning; **derived total wins**, the model's reading is kept as `printed_grand_total` for the reviewer to compare |
| GST % not a legal Indian slab | Snapped to nearest of 0/0.25/3/5/12/18/28, with a warning |
| GSTIN fails the 15-char format | Discarded rather than written into a tax record |
| Serial count ≠ quantity | Warning — units would otherwise go untracked |
| Duplicate product rows | Merged; quantities summed, serial arrays unioned |

Warnings roll up into a `confidence` of high/medium/low, shown as a badge on
the review screen. **Low confidence is the signal to check against the paper
before merging.**

## Reliability details worth knowing

- **Structured output mode** (`responseSchema`) is used instead of asking for
  JSON in the prompt. This eliminates markdown fences and renamed fields — the
  two most common LLM extraction failures.
- **Temperature 0.05.** This is transcription, not writing. Creativity here is
  a hallucinated invoice number.
- **Dates are parsed explicitly as DD/MM/YYYY.** JavaScript's `Date`
  constructor assumes US MM/DD, which silently turned `05/09/2026` into 9 May
  instead of 5 September — an invoice filed into the wrong GST return period.
  Ten date formats are unit-tested.
- **Month-only expiry → last day of month.** A batch marked `09/26` is
  saleable through 30 September; treating it as the 1st would flag stock as
  expired up to a month early.
- **Staging row is written before the response returns**, so a dropped
  connection doesn't lose extraction work already paid for.
- **Cashiers are blocked** at the function, matching the RLS policy on
  `purchases` — purchase entry exposes supplier cost.
- **60-second client timeout** with a clear message, so a hung request doesn't
  leave the UI stuck.

## Cost

Gemini 2.0 Flash is roughly ₹0.01–0.03 per invoice at current pricing. A shop
entering 30 supplier bills a month spends under ₹1. Free tier likely covers it
entirely.

## When it fails

| Symptom | Cause | Fix |
|---|---|---|
| `GEMINI_API_KEY not set` | Secret missing | `supabase secrets set …` then redeploy |
| `AI quota exceeded` | Free tier daily cap | Wait, or enable billing |
| `too many line items` | Invoice exceeded token budget | Photograph in two halves |
| Everything `null` | Photo too blurry/skewed | Flat surface, even light, fill the frame |
| `Unauthorized` | JWT expired | Sign out and back in |
| Low confidence every time | Handwritten or carbon-copy bills | These genuinely don't OCR well — use Manual Entry |

## The limit to be honest about

This reads **printed** invoices well. Handwritten bills, faded carbon copies
and thermal supplier receipts that have already faded are unreliable — the
model will return `null` for illegible fields rather than guessing, which is
correct behaviour, but it means those bills still need manual entry. Don't
promise a shop 100% automation on handwritten kaccha bills.
