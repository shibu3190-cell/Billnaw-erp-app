// ==========================================================================
// AI INVOICE PARSE — Supabase Edge Function (Deno runtime)
// Deploy with: supabase functions deploy ai-invoice-parse
// Requires secret: supabase secrets set GEMINI_API_KEY=your_key_here
//
// This is the ONLY place the AI API key exists. The frontend calls this
// function with a Supabase user JWT; it never sees the key. That's the
// boundary we discussed earlier — client JS cannot hold this key safely.
// ==========================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    if (!GEMINI_API_KEY) {
      return json({ error: "Server misconfigured: GEMINI_API_KEY not set" }, 500);
    }

    // Authenticate the caller — reject unless they hold a valid Supabase
    // session AND belong to an active shop. This function does real work
    // (an external paid API call) so it must not be open to anyone with
    // the anon key alone.
    const authHeader = req.headers.get("Authorization") || "";
    const supabase = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      return json({ error: "Unauthorized" }, 401);
    }

    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("shop_id, role")
      .eq("id", userData.user.id)
      .single();

    if (profileErr || !profile?.shop_id) {
      return json({ error: "No shop associated with this account" }, 403);
    }

    const { data: shop } = await supabase
      .from("shops")
      .select("status")
      .eq("id", profile.shop_id)
      .single();

    if (!shop || shop.status !== "active") {
      return json({ error: "Shop access is not active" }, 403);
    }

    // Expect: { image_base64: "...", mime_type: "image/jpeg" }
    const body = await req.json();
    const { image_base64, mime_type } = body;
    if (!image_base64) {
      return json({ error: "image_base64 is required" }, 400);
    }

    const prompt = `You are reading a supplier purchase invoice photo for an Indian retail/wholesale
business. Extract every line item as JSON only, no prose, matching exactly this shape:

{"items":[{"name":string,"hsn":string,"gst_rate":number,"qty":number,"unit_cost":number,
"identifier":string|null}]}

Rules:
- gst_rate must be one of: 0, 0.25, 3, 5, 12, 18, 28 (India GST slabs).
- identifier is an IMEI/serial/HUID/batch number if visible on the line, else null.
- If a value is not legible, use your best estimate rather than omitting the field.
- Return ONLY the JSON object, no markdown fences, no commentary.`;

    const geminiResp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                { inline_data: { mime_type: mime_type || "image/jpeg", data: image_base64 } },
              ],
            },
          ],
          generationConfig: { temperature: 0.1, responseMimeType: "application/json" },
        }),
      }
    );

    if (!geminiResp.ok) {
      const errText = await geminiResp.text();
      return json({ error: "AI provider error", detail: errText }, 502);
    }

    const geminiJson = await geminiResp.json();
    const rawText = geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      return json({ error: "AI returned unparseable output", raw: rawText }, 502);
    }

    const items = Array.isArray(parsed.items) ? parsed.items : [];

    // Stage the result server-side too (not just return it) so a flaky
    // client connection doesn't lose the OCR work — the owner can review
    // it from the Inward Purchase screen even if this response never
    // reaches the browser.
    const { error: insertErr } = await supabase.from("ai_purchase_staging").insert({
      shop_id: profile.shop_id,
      extracted: items,
      status: "pending",
      created_by: userData.user.id,
    });
    if (insertErr) {
      // Non-fatal: still return the items to the client even if staging failed.
      console.error("Failed to write ai_purchase_staging:", insertErr.message);
    }

    return json({ items }, 200);
  } catch (err) {
    console.error(err);
    return json({ error: "Internal error", detail: String(err) }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}
