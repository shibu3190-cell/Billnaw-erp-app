/* ==========================================================================
   BILLNAW — SHOP LOGO, ALERT CENTRE & SUBSCRIPTION PANEL
   Extracted verbatim from app.js (Phase 4 of the modernization migration —
   structural relocation only, no logic changed). Shop logo upload/remove/
   apply (downscaled to 256x256 before storage — see comment below), the
   alert-centre UI (renders low-stock/expiry alerts computed by
   src/services/alerts logic, already extracted in Phase 3; this is just
   the render/toggle/save glue), and the Subscription & Billing panel
   (reads subscription_plans from Supabase; currentPlanUnlocksAll() is
   explicitly documented as a client-side convenience only, never the real
   enforcement point — see its own comment below).

   Depends on globals defined elsewhere, resolved at call time via the
   shared top-level lexical scope all these classic <script> tags sit in —
   same mechanism every other extracted engine file already relies on.
   Load order relative to app.js does not matter for that reason; this
   loads alongside the other extracted engines before app.js by convention.
   ========================================================================== */


/* ==========================================================================
   SHOP LOGO
   Downscaled to 256×256 and re-encoded before storage. An unprocessed phone
   photo is 3–8MB of base64 — that would be written to localStorage on every
   persistState(), shipped in every shop row, and re-parsed on every load.
   256px is beyond what either A4 print (≈20mm) or a 58/80mm thermal head
   (≈384px wide, 1-bit) can resolve, so nothing visible is lost.
   ========================================================================== */
const LOGO_MAX_PX = 256;

function handleLogoUpload(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
    setTxt('logoStatus', 'Use a PNG, JPG or WebP image.');
    return;
  }
  if (file.size > 8 * 1024 * 1024) {
    setTxt('logoStatus', 'That image is over 8MB — pick a smaller one.');
    return;
  }

  setTxt('logoStatus', 'Processing…');
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(LOGO_MAX_PX / img.width, LOGO_MAX_PX / img.height, 1);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);

      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      // White matte behind transparent PNGs: a thermal printer and a printed
      // A4 both render transparency as black, turning a clean logo into a blob.
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      APP_STATE.tenantProfile.logo = dataUrl;
      persistState();
      applyShopLogo();
      setTxt('logoStatus', `Saved · ${w}×${h}px · ${Math.round(dataUrl.length / 1024)}KB`);

      if (APP_STATE.cloudSession && APP_STATE.tenantProfile.shopId) {
        SB.updateShopSettings(APP_STATE.tenantProfile.shopId, { logo: dataUrl });
      }
    };
    img.onerror = () => setTxt('logoStatus', "That file couldn't be read as an image.");
    // readAsDataURL always resolves reader.result to a string (never
    // ArrayBuffer, which only happens with readAsArrayBuffer) — cast
    // reflects that guarantee rather than changing it.
    img.src = /** @type {string} */ (reader.result);
  };
  reader.onerror = () => setTxt('logoStatus', 'Could not read the file.');
  reader.readAsDataURL(file);
}

function removeShopLogo() {
  APP_STATE.tenantProfile.logo = '';
  persistState();
  applyShopLogo();
  setTxt('logoStatus', 'Logo removed.');
  if (APP_STATE.cloudSession && APP_STATE.tenantProfile.shopId) {
    SB.updateShopSettings(APP_STATE.tenantProfile.shopId, { logo: null });
  }
}

// Paints the logo everywhere it appears, with a clean initial-letter
// fallback so a shop that never uploads one still looks finished.
function applyShopLogo() {
  const p = APP_STATE.tenantProfile;
  const logo = p.logo || '';
  const initial = (p.shopName || 'B').trim().slice(0, 2).toUpperCase();

  const preview = $id('logoPreview');
  if (preview) {
    preview.innerHTML = logo
      ? `<img src="${logo}" alt="Shop logo">`
      : esc(initial);
  }
  const removeBtn = $id('logoRemoveBtn');
  if (removeBtn) removeBtn.style.display = logo ? 'inline-flex' : 'none';

  const pLogo = $id('pLogo');
  if (pLogo) {
    if (logo) { pLogo.src = logo; pLogo.style.display = 'block'; }
    else { pLogo.style.display = 'none'; }
  }

  const sidebarLogo = $id('sidebarLogoBox');
  if (sidebarLogo) {
    sidebarLogo.innerHTML = logo
      ? `<img src="${logo}" alt="" style="width:100%; height:100%; object-fit:cover; border-radius:inherit;">`
      : esc(initial.slice(0, 1));
  }
}

/* Stock/expiry alert calculations live in alertEngine.js (loaded first). */

function renderAlertCentre() {
  const low = getLowStockItems();
  const exp = getExpiryAlerts();
  const total = low.length + exp.length;

  const badge = $id('alertBadge');
  if (badge) {
    badge.innerText = total > 99 ? '99+' : String(total);
    badge.style.display = total ? 'inline-flex' : 'none';
  }

  const panel = $id('alertPanelBody');
  if (!panel) return;

  if (!total) {
    panel.innerHTML = `<div class="empty-state" style="padding:26px;">
      <div class="es-ico">✓</div><h4>Nothing needs attention</h4>
      <p>Stock levels and batch expiry all look healthy.</p></div>`;
    return;
  }

  let html = '';

  if (exp.length) {
    const expired = exp.filter(e => e.expired).length;
    html += `<div class="alert-group">
      <h5>Expiry${expired ? ` · ${expired} already expired` : ''}</h5>` +
      exp.slice(0, 15).map(e => `
        <button class="alert-row" onclick="switchView('inventory')">
          <span class="alert-ico ${e.expired ? 'danger' : 'warn'}">${e.expired ? '!' : '⏱'}</span>
          <span class="alert-body">
            <strong>${esc(e.name)}</strong>
            <small>Batch ${esc(e.batch || '—')} · ${e.expired
              ? `expired ${Math.abs(e.days)} day(s) ago`
              : `expires in ${e.days} day(s)`} · ${e.stock} in stock</small>
          </span>
        </button>`).join('') + `</div>`;
  }

  if (low.length) {
    const { lowStock } = getAlertThresholds();
    html += `<div class="alert-group">
      <h5>Low stock · threshold ${lowStock}</h5>` +
      low.slice(0, 15).map(i => `
        <button class="alert-row" onclick="switchView('inventory')">
          <span class="alert-ico ${i.stock === 0 ? 'danger' : 'warn'}">${i.stock === 0 ? '0' : i.stock}</span>
          <span class="alert-body">
            <strong>${esc(i.name)}</strong>
            <small>${i.stock === 0 ? 'Out of stock' : `${i.stock} left`} · reorder level ${
              Number.isFinite(i.lowStockLevel) ? i.lowStockLevel : lowStock}</small>
          </span>
        </button>`).join('') + `</div>`;
  }

  panel.innerHTML = html;
}

function toggleAlertPanel() {
  const panel = $id('alertPanel');
  if (!panel) return;
  const opening = !panel.classList.contains('open');
  panel.classList.toggle('open', opening);
  if (opening) renderAlertCentre();
}

function saveAlertSettings() {
  const p = APP_STATE.tenantProfile;
  const low = parseInt($id('cfgLowStock')?.value, 10);
  const days = parseInt($id('cfgExpiryDays')?.value, 10);
  p.lowStockThreshold = Number.isFinite(low) && low >= 0 ? low : 5;
  p.expiryWarnDays = Number.isFinite(days) && days >= 0 ? days : 30;
  persistState();
  renderAlertCentre();
  renderDashboard();
  showSaasToast('Alert thresholds saved.', 2500);
}

/* ==========================================================================
   SUBSCRIPTION & BILLING PANEL
   Plan, price and feature list are read from subscription_plans in
   Supabase, never hardcoded — the "app is free for now" state is a row
   (id='free', all_features_unlocked=true), not an absence of gating logic.
   Changing what a shop is allowed to do later is a database update from
   the backend, not a client deploy.
   ========================================================================== */
async function loadSubscriptionPanel() {
  const block = $id('currentPlanBlock');
  if (!APP_STATE.cloudSession || !APP_STATE.tenantProfile.shopId) {
    setTxt('planName', 'Not signed in');
    setDisplay('planFreeBanner', 'none');
    return;
  }

  const [{ data: sub, error: subErr }, { data: plans }] = await Promise.all([
    SB.fetchSubscription(APP_STATE.tenantProfile.shopId),
    SB.fetchAllPlans()
  ]);

  if (subErr || !sub?.plan) {
    setTxt('planName', 'Free Access');
    setTxt('planPrice', '₹0 / month');
    showSaasToast('Could not load live plan details — showing defaults.', 3500, 'err');
    return;
  }

  const plan = sub.plan;
  const usage = sub.usage || {};

  setTxt('planName', plan.name);
  setTxt('planPrice', plan.price_monthly > 0
    ? `₹${Number(plan.price_monthly).toLocaleString('en-IN')} / month`
    : 'Free');

  const pill = $id('planStatusPill');
  if (pill) { pill.className = 'pill paid'; pill.innerText = 'Active'; }

  setTxt('planInvoiceUsage', plan.max_invoices_monthly
    ? `${usage.invoices_this_month || 0} / ${plan.max_invoices_monthly}`
    : `${usage.invoices_this_month || 0} (unlimited)`);
  setTxt('planStaffUsage', plan.max_staff_accounts
    ? `${usage.staff_accounts || 0} / ${plan.max_staff_accounts}`
    : `${usage.staff_accounts || 0} (unlimited)`);

  const featureList = $id('planFeatureList');
  if (featureList) {
    const features = Array.isArray(plan.features) ? plan.features : [];
    featureList.innerHTML = features.map(f => `
      <li style="display:flex; align-items:center; gap:8px;">
        <span style="color:${f.included ? 'var(--mint-ink)' : 'var(--text-faint)'}; font-weight:800;">${f.included ? '✓' : '—'}</span>
        <span style="color:${f.included ? 'var(--text-dark)' : 'var(--text-faint)'};">${esc(f.label)}</span>
      </li>`).join('');
  }

  setDisplay('planFreeBanner', plan.all_features_unlocked ? 'block' : 'none');

  // Other plans, shown but never clickable — is_purchasable stays false
  // until the backend flips it, and this screen never fakes a checkout.
  const otherList = $id('otherPlansList');
  if (otherList) {
    const others = (plans || []).filter(p => p.id !== plan.id);
    otherList.innerHTML = others.length
      ? others.map(p => `
          <div style="border:1px solid var(--border); border-radius:11px; padding:13px 15px; display:flex; justify-content:space-between; align-items:center; gap:10px;">
            <div>
              <strong style="font-size:0.9rem;">${esc(p.name)}</strong>
              <p style="font-size:0.78rem; color:var(--text-muted); margin-top:2px;">
                ${p.price_monthly > 0 ? `₹${Number(p.price_monthly).toLocaleString('en-IN')}/month` : 'Free'}
                ${p.max_staff_accounts ? ` · ${p.max_staff_accounts} staff` : ''}
                ${p.max_invoices_monthly ? ` · ${p.max_invoices_monthly} invoices/mo` : ''}
              </p>
            </div>
            <span class="pill draft">${p.is_purchasable ? 'Available' : 'Coming soon'}</span>
          </div>`).join('')
      : `<p class="settings-hint">No other plans published yet.</p>`;
  }
}

// Client-side convenience check for future use — mirrors shop_has_feature()
// server-side, which is the real enforcement point. This local copy is for
// instant UI decisions (e.g. greying out a button) and must never be the
// only gate on anything that touches money or data.
function currentPlanUnlocksAll() {
  return APP_STATE.subscriptionCache?.all_features_unlocked !== false; // default open while free
}

window.handleLogoUpload = handleLogoUpload;
window.removeShopLogo = removeShopLogo;
window.applyShopLogo = applyShopLogo;
window.renderAlertCentre = renderAlertCentre;
window.toggleAlertPanel = toggleAlertPanel;
window.saveAlertSettings = saveAlertSettings;
window.loadSubscriptionPanel = loadSubscriptionPanel;
window.currentPlanUnlocksAll = currentPlanUnlocksAll;
