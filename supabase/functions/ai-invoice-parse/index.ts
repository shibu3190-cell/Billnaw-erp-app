// ==========================================================================
// AI INVOICE PARSE — Supabase Edge Function (Deno runtime)
//
// Deploy:
//   supabase secrets set GEMINI_API_KEY=your_key
//   supabase functions deploy ai-invoice-parse
//
// This is the ONLY place the Gemini key exists. The browser calls this with
// a Supabase user JWT; it never sees the key. That boundary is the whole
// reason this runs server-side rather than in app.js.
//
// DESIGN NOTE — why this does more than "call Gemini and return JSON":
// A vision model will confidently return a grand_total that does not equal
// the sum of the line items it just extracted. Trusting that number would
// write a wrong purchase cost into inventory and a wrong ITC figure into
// GSTR-2. So every response is re-derived from the line items and any
// disagreement is reported to the client as a per-field confidence signal
// rather than silently accepted.
// ==========================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

const MODEL = "gemini-2.0-flash";
const MAX_IMAGE_BYTES = 12 * 1024 * 1024; // ~9MB of source image after base64

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// India GST slabs. Anything the model returns that isn't in this set is
// snapped to the nearest legal slab — a hallucinated "17%" would otherwise
// flow into an invoice and produce a tax figure that can never reconcile.
const LEGAL_GST_SLABS = [0, 0.25, 3, 5, 12, 18, 28];

/* --------------------------------------------------------------------------
   Response schema, enforced by Gemini's own structured-output mode rather
   than by asking politely in the prompt. This eliminates the single most
   common failure of LLM extraction: valid-looking prose wrapped around the
   JSON, or a renamed field.
   -------------------------------------------------------------------------- */
const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    bill_header: {
      type: "OBJECT",
      properties: {
        vendor_name: { type: "STRING", nullable: true },
        invoice_number: { type: "STRING", nullable: true },
        invoice_date: { type: "STRING", nullable: true },
        supplier_gstin: { type: "STRING", nullable: true },
      },
      required: ["vendor_name", "invoice_number", "invoice_date", "supplier_gstin"],
    },
    bill_items: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          product_name: { type: "STRING" },
          quantity: { type: "NUMBER" },
          unit_rate: { type: "NUMBER" },
          hsn_sac: { type: "STRING", nullable: true },
          gst_percentage: { type: "NUMBER" },
          tracking_metadata: {
            type: "OBJECT",
            properties: {
              serial_or_imei: { type: "ARRAY", items: { type: "STRING" } },
              batch_number: { type: "STRING", nullable: true },
              expiry_date: { type: "STRING", nullable: true },
              hudi_or_other_id: { type: "STRING", nullable: true },
            },
            required: ["serial_or_imei", "batch_number", "expiry_date", "hudi_or_other_id"],
          },
          line_total_inclusive: { type: "NUMBER" },
        },
        required: ["product_name", "quantity", "unit_rate", "hsn_sac",
                   "gst_percentage", "tracking_metadata", "line_total_inclusive"],
      },
    },
    bill_summary: {
      type: "OBJECT",
      properties: {
        total_before_tax: { type: "NUMBER" },
        total_tax_amount: { type: "NUMBER" },
        grand_total: { type: "NUMBER" },
      },
      required: ["total_before_tax", "total_tax_amount", "grand_total"],
    },
  },
  required: ["bill_header", "bill_items", "bill_summary"],
};

const SYSTEM_PROMPT = `You are a localized data-extraction engine for an offline-first B2B Indian GST accounting application. You process photographs and PDFs of SUPPLIER PURCHASE INVOICES and extract them into structured JSON for client-side storage and delayed network syncing.

CRITICAL CORE LOGIC:

1. PRECISION FIRST — Never hallucinate. If a field is missing, illegible, obscured, or you are not confident, return null (or an empty array for serial_or_imei). A null is correct and useful; an invented value corrupts the shop's inventory cost and their GST return. Do not infer a value from context if it is not printed on the document.

2. NAMING STANDARDIZATION — Indian supplier invoices label the same column many ways. Map them:
   - "Rate", "Price/Unit", "Unit Cost", "Unit Price", "Rate/Unit", "MRP/Unit", "Basic Rate" -> unit_rate
   - "Price", "Amount", "Net Total", "Taxable Value", "Value", "Total" -> use for line_total_inclusive
   - unit_rate must be the PRE-TAX rate for ONE unit. If only a post-tax rate is printed, divide it out using the line's GST percentage.

3. ENTITY GROUPING — If the same product name appears on multiple rows (common when each serial number gets its own line), emit it as ONE array element. Sum the quantities. Collect every serial/IMEI into the serial_or_imei array. Do NOT emit duplicate array elements for the same product.

4. GST BREAKDOWN — Extract the total GST percentage for each line (CGST + SGST combined, or IGST). If the invoice shows CGST 9% and SGST 9%, gst_percentage is 18. Valid Indian slabs are 0, 0.25, 3, 5, 12, 18 and 28 — if you read something else, pick the closest legal slab.

5. TRACKING METADATA — Capture these wherever printed, they are how the shop tracks individual units:
   - serial_or_imei: IMEI numbers (15 digits), serial numbers, device IDs. Array, one entry per physical unit.
   - batch_number: pharmaceutical/FMCG batch or lot codes.
   - expiry_date: normalise to YYYY-MM-DD. If only month/year is printed (e.g. "09/26", "SEP 2026"), use the LAST day of that month, because a batch is saleable through month end.
   - hudi_or_other_id: BIS HUID (jewellery hallmark, 6 alphanumeric chars) or any other unique identifier.

6. DATES — All dates as YYYY-MM-DD. Indian invoices are DD/MM/YYYY or DD-MM-YY; interpret accordingly. "05/09/2026" is 5 September, not 9 May.

7. NUMBERS — Strip currency symbols, commas and spaces. Indian digit grouping (1,23,456.78) means 123456.78. Never return a string where the schema expects a number.

Return ONLY the JSON object. No markdown fences, no commentary, no explanation.`;

/* -------------------------------------------------------------------------- */

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    if (!GEMINI_API_KEY) return json({ error: "Server misconfigured: GEMINI_API_KEY not set" }, 500);

    /* ---- 1. Authenticate + authorise ---- */
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);

    const { data: profile } = await supabase
      .from("profiles").select("shop_id, role").eq("id", userData.user.id).maybeSingle();

    if (!profile?.shop_id) return json({ error: "No shop associated with this account" }, 403);

    // Purchase entry reveals supplier cost — the one thing cashiers must not
    // see. Same boundary the purchases table enforces in RLS.
    if (profile.role === "cashier") {
      return json({ error: "Purchase entry is restricted to the shop owner" }, 403);
    }

    const { data: shop } = await supabase
      .from("shops").select("status").eq("id", profile.shop_id).maybeSingle();
    if (!shop || shop.status !== "active") return json({ error: "Shop access is not active" }, 403);

    /* ---- 1.5. Rate limit ---- */
    // Checked before the (expensive, billed) Gemini call, not after — the
    // whole point is to stop the request from reaching Gemini at all once
    // a shop is over quota. See migration 0013 for the counter design.
    const { data: rateLimit, error: rateLimitErr } = await supabase
      .rpc("check_ai_rate_limit", { p_shop_id: profile.shop_id });
    if (rateLimitErr) {
      // Fail open, not closed: a broken rate-limit check must not take
      // down a legitimate shop's ability to scan bills. Logged for
      // visibility, not surfaced to the caller as an error.
      console.error("Rate limit check failed (failing open):", rateLimitErr.message);
    } else if (rateLimit && !rateLimit.allowed) {
      return json({
        error: `AI parsing limit reached for this hour (${rateLimit.count}/${rateLimit.limit}). ` +
          `Try again after ${new Date(rateLimit.window_resets_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}, or enter this bill manually.`,
      }, 429);
    }

    /* ---- 2. Validate input ---- */
    const body = await req.json().catch(() => null);
    if (!body?.image_base64) return json({ error: "image_base64 is required" }, 400);

    const mimeType = body.mime_type || "image/jpeg";
    if (!/^(image\/(jpeg|png|webp|heic)|application\/pdf)$/.test(mimeType)) {
      return json({ error: `Unsupported file type: ${mimeType}` }, 400);
    }
    if (body.image_base64.length > MAX_IMAGE_BYTES) {
      return json({ error: "File too large — compress below ~9MB and retry" }, 413);
    }

    /* ---- 3. Call Gemini with structured output ---- */
    const geminiResp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{
            role: "user",
            parts: [
              { text: "Extract this supplier purchase invoice." },
              { inline_data: { mime_type: mimeType, data: body.image_base64 } },
            ],
          }],
          generationConfig: {
            // Near-zero temperature: this is transcription, not writing.
            // Any creativity here is a hallucinated invoice number.
            temperature: 0.05,
            topP: 0.1,
            maxOutputTokens: 8192,
            responseMimeType: "application/json",
            responseSchema: RESPONSE_SCHEMA,
          },
        }),
      }
    );

    if (!geminiResp.ok) {
      const detail = await geminiResp.text();
      console.error("Gemini error:", geminiResp.status, detail);
      return json({
        error: geminiResp.status === 429
          ? "AI quota exceeded — try again shortly, or enter the bill manually."
          : "AI provider error",
        detail: detail.slice(0, 500),
      }, 502);
    }

    const geminiJson = await geminiResp.json();

    const finishReason = geminiJson?.candidates?.[0]?.finishReason;
    if (finishReason === "MAX_TOKENS") {
      return json({
        error: "This invoice has too many line items to extract in one pass. Photograph it in two halves.",
      }, 422);
    }
    if (finishReason === "SAFETY" || finishReason === "RECITATION") {
      return json({ error: "The AI declined to process this image." }, 422);
    }

    const rawText = geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) return json({ error: "AI returned an empty response" }, 502);

    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      return json({ error: "AI returned unparseable output", raw: rawText.slice(0, 500) }, 502);
    }

    /* ---- 4. Normalise, validate, reconcile ---- */
    const result = normaliseAndReconcile(parsed);

    /* ---- 5. Stage server-side ---- */
    // Written before the response is returned so a dropped connection or a
    // closed tab doesn't lose the extraction — the owner can pick it back up
    // from the Inward Purchase screen.
    const { data: staged, error: stageErr } = await supabase
      .from("ai_purchase_staging")
      .insert({
        shop_id: profile.shop_id,
        extracted: result,
        status: "pending",
        created_by: userData.user.id,
      })
      .select("id")
      .maybeSingle();

    if (stageErr) console.error("Staging write failed (non-fatal):", stageErr.message);

    return json({ ...result, staging_id: staged?.id ?? null }, 200);

  } catch (err) {
    console.error("Unhandled:", err);
    return json({ error: "Internal error", detail: String(err).slice(0, 300) }, 500);
  }
});

/* ==========================================================================
   NORMALISATION + ARITHMETIC RECONCILIATION
   The model's own totals are treated as a claim to be checked, never as
   truth. Where its summary disagrees with the sum of its line items, the
   derived figure wins and the discrepancy is surfaced so the human
   reviewing the staging table knows which bills need a closer look.
   ========================================================================== */
function normaliseAndReconcile(parsed: any) {
  const warnings: string[] = [];
  const round2 = (n: number) => {
    if (!isFinite(n)) return 0;
    const sign = n < 0 ? -1 : 1;
    return sign * Math.round((Math.abs(n) + Number.EPSILON) * 100) / 100;
  };
  const num = (v: any) => {
    if (v === null || v === undefined) return 0;
    const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[₹,\s]/g, ""));
    return isFinite(n) ? n : 0;
  };
  const str = (v: any) => {
    const s = (v ?? "").toString().trim();
    return s === "" || s.toLowerCase() === "null" || s.toLowerCase() === "n/a" ? null : s;
  };

  const snapGst = (rate: number) => {
    if (LEGAL_GST_SLABS.includes(rate)) return rate;
    const nearest = LEGAL_GST_SLABS.reduce((a, b) =>
      Math.abs(b - rate) < Math.abs(a - rate) ? b : a);
    warnings.push(`GST ${rate}% is not a legal Indian slab — snapped to ${nearest}%.`);
    return nearest;
  };

  // Indian invoices are DD/MM/YYYY. JavaScript's Date constructor assumes
  // US MM/DD/YYYY, so "05/09/2026" silently became 9 May instead of
  // 5 September — an invoice filed into the wrong GST return period.
  // Slash/dot/dash numeric forms are therefore parsed explicitly, and only
  // unambiguous formats are handed to Date().
  const normDate = (v: any) => {
    const s = str(v);
    if (!s) return null;

    // Already ISO.
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

    // Month-only: a batch is saleable through the END of the month.
    const ym = s.match(/^(\d{4})[-\/](\d{1,2})$/);
    if (ym) return isoOrNull(new Date(+ym[1], +ym[2], 0));

    // MM/YY or MM/YYYY (common on pharma strips).
    const my = s.match(/^(\d{1,2})[-\/](\d{2}|\d{4})$/);
    if (my) {
      const mo = +my[1];
      if (mo >= 1 && mo <= 12) {
        const yr = my[2].length === 2 ? 2000 + +my[2] : +my[2];
        return isoOrNull(new Date(yr, mo, 0));
      }
    }

    // DD/MM/YYYY, DD-MM-YY, DD.MM.YYYY — day first, always.
    const dmy = s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2}|\d{4})$/);
    if (dmy) {
      let [, d, m, y] = dmy;
      let day = +d, mon = +m;
      // If the first field can't be a day but the second can, the source
      // was MM/DD after all — swap rather than produce an invalid date.
      if (day > 31 || (day > 12 && mon > 12)) return null;
      if (day <= 12 && mon > 12) { const t = day; day = mon; mon = t; }
      const year = y.length === 2 ? 2000 + +y : +y;
      if (mon < 1 || mon > 12 || day < 1 || day > 31) return null;
      return isoOrNull(new Date(year, mon - 1, day));
    }

    // Textual forms ("5 Sep 2026", "Sep 5, 2026") are unambiguous — Date
    // handles these correctly.
    const d = new Date(s);
    return isoOrNull(d);
  };

  function isoOrNull(d: Date) {
    if (!d || isNaN(d.getTime())) return null;
    // Local-time components, not toISOString(), which would shift the date
    // backwards for any timezone east of UTC — including all of India.
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  /* ---- header ---- */
  const h = parsed.bill_header || {};
  const gstin = str(h.supplier_gstin)?.toUpperCase() ?? null;
  // A GSTIN is exactly 15 chars in a fixed pattern. Anything else is a
  // misread and is better dropped than written into a tax record.
  const validGstin = gstin && /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstin);
  if (gstin && !validGstin) warnings.push(`Supplier GSTIN "${gstin}" failed format validation and was discarded.`);

  const bill_header = {
    vendor_name: str(h.vendor_name),
    invoice_number: str(h.invoice_number),
    invoice_date: normDate(h.invoice_date),
    supplier_gstin: validGstin ? gstin : null,
  };

  /* ---- items: group duplicates defensively ---- */
  // The prompt asks the model to group by product name, but a second pass
  // here makes it guaranteed rather than hoped-for.
  const grouped = new Map<string, any>();

  (Array.isArray(parsed.bill_items) ? parsed.bill_items : []).forEach((raw: any) => {
    const name = str(raw.product_name);
    if (!name) { warnings.push("Dropped a line item with no readable product name."); return; }

    const qty = Math.max(0, num(raw.quantity));
    if (qty === 0) warnings.push(`"${name}" has quantity 0 — verify before merging.`);

    const tm = raw.tracking_metadata || {};
    const serials = (Array.isArray(tm.serial_or_imei) ? tm.serial_or_imei : [])
      .map((x: any) => str(x)).filter(Boolean) as string[];

    const key = name.toLowerCase().replace(/\s+/g, " ");
    const existing = grouped.get(key);

    if (existing) {
      existing.quantity = round2(existing.quantity + qty);
      existing.line_total_inclusive = round2(existing.line_total_inclusive + num(raw.line_total_inclusive));
      // Union of serials — never lose a unit identifier during a merge.
      serials.forEach(sn => { if (!existing.tracking_metadata.serial_or_imei.includes(sn)) existing.tracking_metadata.serial_or_imei.push(sn); });
      existing.tracking_metadata.batch_number ??= str(tm.batch_number);
      existing.tracking_metadata.expiry_date ??= normDate(tm.expiry_date);
      existing.tracking_metadata.hudi_or_other_id ??= str(tm.hudi_or_other_id);
      return;
    }

    grouped.set(key, {
      product_name: name,
      quantity: round2(qty),
      unit_rate: round2(num(raw.unit_rate)),
      hsn_sac: str(raw.hsn_sac),
      gst_percentage: snapGst(num(raw.gst_percentage)),
      tracking_metadata: {
        serial_or_imei: serials,
        batch_number: str(tm.batch_number),
        expiry_date: normDate(tm.expiry_date),
        hudi_or_other_id: str(tm.hudi_or_other_id),
      },
      line_total_inclusive: round2(num(raw.line_total_inclusive)),
    });
  });

  const bill_items = Array.from(grouped.values());

  /* ---- per-line arithmetic check ---- */
  bill_items.forEach(it => {
    const derivedPreTax = round2(it.unit_rate * it.quantity);
    const derivedInclusive = round2(derivedPreTax * (1 + it.gst_percentage / 100));

    // If the model gave no line total, derive it rather than storing zero.
    if (it.line_total_inclusive === 0 && derivedInclusive > 0) {
      it.line_total_inclusive = derivedInclusive;
    } else if (Math.abs(it.line_total_inclusive - derivedInclusive) > 1) {
      warnings.push(
        `"${it.product_name}": printed total ₹${it.line_total_inclusive.toFixed(2)} ` +
        `≠ ${it.quantity} × ₹${it.unit_rate.toFixed(2)} + ${it.gst_percentage}% ` +
        `(₹${derivedInclusive.toFixed(2)}). Check rate and quantity.`
      );
    }

    // Serial count vs quantity — a mismatch means units will go untracked.
    const sc = it.tracking_metadata.serial_or_imei.length;
    if (sc > 0 && sc !== it.quantity) {
      warnings.push(`"${it.product_name}": ${sc} serial(s) captured for ${it.quantity} unit(s).`);
    }
  });

  /* ---- summary: derive, then compare against the model's claim ---- */
  const derivedPreTax = round2(bill_items.reduce((s, it) => s + it.unit_rate * it.quantity, 0));
  const derivedTax = round2(bill_items.reduce(
    (s, it) => s + (it.unit_rate * it.quantity * it.gst_percentage / 100), 0));
  const derivedGrand = round2(derivedPreTax + derivedTax);

  const claimed = parsed.bill_summary || {};
  const claimedGrand = round2(num(claimed.grand_total));

  // Tolerance of ₹1 absorbs the supplier's own round-off line; anything
  // larger is a genuine extraction error worth a human's eyes.
  if (claimedGrand > 0 && Math.abs(claimedGrand - derivedGrand) > 1) {
    warnings.push(
      `Invoice grand total ₹${claimedGrand.toFixed(2)} does not match the sum of ` +
      `extracted lines (₹${derivedGrand.toFixed(2)}). A line may be missing or misread.`
    );
  }

  const confidence =
    warnings.length === 0 ? "high" :
    warnings.length <= 2 ? "medium" : "low";

  return {
    bill_header,
    bill_items,
    bill_summary: {
      // Derived values are authoritative — they are the ones that will be
      // written into stock cost and the GST ledger.
      total_before_tax: derivedPreTax,
      total_tax_amount: derivedTax,
      grand_total: derivedGrand,
      // The model's own reading, kept for the reviewer to compare against.
      printed_grand_total: claimedGrand || null,
    },
    extraction_meta: {
      confidence,
      warnings,
      item_count: bill_items.length,
      model: MODEL,
      extracted_at: new Date().toISOString(),
    },
  };
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}
