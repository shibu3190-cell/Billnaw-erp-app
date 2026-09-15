/* ==========================================================================
   BILLNAW — EXPORT ENGINE (typed extraction, partial)

   Ported from exportEngine.js. Only escXml() is extracted here — it's the
   one pure function in that file. downloadCSV(), exportToExcel(), and
   exportCurrentViewToExcel() are deliberately NOT ported yet: they create
   Blob/URL/<a> objects, touch document.body, and read APP_STATE and DOM
   helpers ($q/$qa/$id, showSaasToast) directly. Porting them without a way
   to verify identical output (the parity-test pattern used elsewhere in
   this migration) would just be an unverified rewrite of code that
   generates the CSV/Excel files shops file with their accountants — the
   Golden Rule's "preserve business behavior" bar isn't met by "it
   typechecks." They move to src/features/reports/ in Phase 4/8, once the
   feature they belong to is actually being migrated and can be tested
   against real exported files, not left as a standalone port here.

   exportEngine.js remains UNCHANGED and is still what index.html loads.
   ========================================================================== */

export function escXml(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
