/* ==========================================================================
   HTML/JS ESCAPING (typed extraction)

   Ported from esc()/escJs() in app.js — the app's only defense against
   stored XSS from user-controlled strings (item/customer names, addresses,
   reasons) interpolated into innerHTML. See SECURITY_REPORT.md finding F2:
   app.js has ~99 innerHTML call sites and only these two escaping helpers,
   applied manually. This extraction doesn't fix that coverage gap by
   itself — it exists because printerEngine's buildEscPosPayload extraction
   (src/services/printer) depends on esc(), and a real ES module shouldn't
   reach for an implicit window global the way the classic script does.

   app.js's esc()/escJs() remain the deployed implementation (unchanged).
   tests/escape-parity.js keeps this module and app.js's copy provably
   identical, the same guard pattern used for the GST extraction.
   ========================================================================== */

export function esc(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Escapes a value for safe use as a SINGLE-QUOTED JS STRING LITERAL embedded
// inside an HTML attribute (e.g. an inline onclick="...") — a different job
// from esc(). The browser HTML-decodes an attribute's entities BEFORE the JS
// engine parses that attribute's text as a handler, so escape order matters:
// JS-string-literal escaping first (backslash, then quote), THEN HTML-escape
// the result — reversing the order re-escapes the JS-level backslash.
export function escJs(v: unknown): string {
  if (v === null || v === undefined) return '';
  const jsSafe = String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  return jsSafe.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
