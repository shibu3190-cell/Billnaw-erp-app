/* ==========================================================================
   EXTRACTION PARITY TEST — Run: node tests/extraction-parity.js

   Phase 4 of MIGRATION_PLAN.md extracted settings.js, customers.js, and
   purchases.js out of app.js "verbatim, structural relocation only" (per
   each file's own header comment). Unlike the Phase 3 services (gst,
   export, alerts, printer), these three extractions shipped with no
   automated check that the claim is true — see docs/AUDIT_REPORT.md §9
   and docs/SECURITY_REPORT.md §5.

   This test closes that gap the same way gst-parity.js etc. do: it pulls
   the pre-extraction app.js from git history (commit 1f56ed1, the last
   commit before any of the three Phase 4 extractions began) and requires
   every function this test knows about to be byte-identical between the
   historical app.js body and the current standalone file. A failure here
   means either a real behavior change (investigate before trusting the
   "verbatim" claim) or that this test's function list needs updating
   because a genuine, reviewed change was made since.
   ========================================================================== */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e) { failed++; console.log(`  ✗ ${name}\n      ${e.message}`); }
}

const ROOT = path.join(__dirname, '..');
const PRE_EXTRACTION_COMMIT = '1f56ed1';

// Extracts `function <name>(...) { ... }` as balanced-brace text starting
// at the first occurrence of `function <name>(`.
function extractFunction(src, name) {
  const marker = `function ${name}(`;
  const start = src.indexOf(marker);
  if (start === -1) throw new Error(`marker "${marker}" not found`);
  // Skip past the parameter list before looking for the body's opening
  // brace — a destructured parameter (e.g. `function f({ a, b }) {`) has
  // its own `{` before the real one, which naive indexOf('{', start)
  // matches instead, silently truncating the extracted body to just the
  // parameter list. Match parens first, then find the body brace after.
  let i = src.indexOf('(', start);
  let pdepth = 1;
  i++;
  while (pdepth > 0) {
    if (src[i] === '(') pdepth++;
    else if (src[i] === ')') pdepth--;
    i++;
  }
  const braceStart = src.indexOf('{', i);
  if (braceStart === -1) throw new Error(`no opening brace after "${marker}"`);
  let depth = 0;
  for (let i = braceStart; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  throw new Error(`unbalanced braces for "${marker}"`);
}

let oldAppSrc;
try {
  oldAppSrc = execSync(`git show ${PRE_EXTRACTION_COMMIT}:app.js`, { cwd: ROOT, encoding: 'utf8' });
} catch (e) {
  console.log(`\n  SKIPPED — could not read historical app.js@${PRE_EXTRACTION_COMMIT}: ${e.message}`);
  console.log('  (shallow clone or missing history — this is an environment limitation, not a code failure)');
  process.exit(0);
}

const FILES = {
  'settings.js': [
    'applyIndustryLock', 'syncProfileToDOM', 'saveAllSettings', 'openSettingsHome',
    'openSettingsPanel', 'closeSettingsPanel', 'toggleAccordion', 'updateLivePreview',
    'loadComplianceSettingsIntoDOM', 'saveComplianceSettings', 'loadIndustrySettingsIntoDOM',
    'saveIndustrySettings',
  ],
  'customers.js': [
    'autoFillCustomer', 'handleCust360Search', 'selectCust360Result', 'toggleCurrentCustomerStar',
    'updateStarButton', 'openCustEditModal', 'saveCustEdit', 'renderCustomer360Profile',
    'exportCustomer360',
  ],
  'inventory.js': [
    'renderInventoryTable', 'openEditStockModal', 'closeEditStockModal', 'saveEditedStock',
    'deleteInventoryItemPrompt', 'resetCatalogPaging', 'loadMoreCatalog', 'renderPagerFooter',
    'renderCatalog', 'openNewProductModal', 'closeNewProdModal', 'saveNewProduct',
  ],
  'purchases.js': [
    'onPurVendorInput', 'openInwardPurchaseModal', 'closeInwardModal', 'toggleInwardMode',
    'populateRestockPicker', 'prefillFromExistingItem', 'saveManualPurchase',
    // recordPurchaseBill intentionally excluded: F4 (2026-09-15) added an
    // errorCode destructure/argument to its SB.savePurchase().then() callback
    // so isFatalSyncError() can check the Postgres SQLSTATE instead of
    // string-matching "duplicate key" — a genuine, reviewed, tested change,
    // not drift. Re-add it here (with a fresh baseline commit) only if it's
    // meant to go back to being a frozen, no-logic-changed extraction.
    'matchInventoryItem', 'renderAiBillHeader', 'renderAiStagingTable', 'editAiStagingField',
    'discardAiStagingItem', 'commitAiBill',
  ],
};

for (const [file, fns] of Object.entries(FILES)) {
  console.log(`\n${file}`);
  const newSrc = fs.readFileSync(path.join(ROOT, file), 'utf8');
  for (const fn of fns) {
    test(`${fn}() is byte-identical to its pre-extraction app.js body`, () => {
      const oldBody = extractFunction(oldAppSrc, fn);
      const newBody = extractFunction(newSrc, fn);
      if (oldBody !== newBody) {
        throw new Error(`bodies differ (old ${oldBody.length} chars, new ${newBody.length} chars) — extraction changed behavior, review before trusting`);
      }
    });
  }
}

console.log(`\n====================================================\n  ${passed} passed, ${failed} failed\n====================================================`);
process.exit(failed ? 1 : 0);
