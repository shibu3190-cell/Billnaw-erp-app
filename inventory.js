/* ==========================================================================
   BILLNAW — INVENTORY / CATALOGUE ENGINE
   Extracted verbatim from app.js (Phase 4 continuation of the modernization
   migration — structural relocation only, no logic changed). Stock-master
   table render + edit-in-place, catalogue grid render + pagination, and
   new-product creation.

   Deliberately excludes openItemModal/commitModalItem/showAlternativesFor/
   selectAlternative — those look like inventory code but are actually the
   POS add-to-cart flow (staging an item for sale, serial/HUID/batch
   selection at checkout), so they stay in app.js with the rest of
   POS/checkout, which remains the last and highest-coupling piece to
   extract per docs/ARCHITECTURE_TARGET.md's own ordering.

   Depends on globals defined elsewhere and relies on the fact that classic
   (non-module) <script> tags share one top-level lexical scope across the
   whole page — APP_STATE, $id/$qa (dom.js), esc/fmtCost/showSaasToast/
   persistState/syncItemToCloud/renderAlertCentre/getAlertThresholds/
   getExpiryAlerts/openItemModal (app.js), SB (supabaseClient.js) are all
   resolved at call time, same as every other extracted engine file.

   Load order relative to app.js does not matter for that reason, but this
   loads alongside the other extracted engines (before app.js) to keep the
   convention consistent and easy to scan in index.html.
   ========================================================================== */

/* ==========================================================================
   STOCK MASTER — full table render + edit-in-place
   invTableBody was never populated by any function — this screen has been
   silently dead since the table markup was written. Fixed properly: a real
   render, an edit modal reusing the same fields the New Product modal
   already validates, and every save syncs to Supabase the same way
   commitModalItem's cart-add path does.
   ========================================================================== */
function renderInventoryTable() {
  const tbody = $id('invTableBody');
  if (!tbody) return;

  const { lowStock } = getAlertThresholds();
  const canSeeCost = APP_STATE.isOwner !== false;

  if (!APP_STATE.inventory.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:30px; color:var(--text-muted);">
      No products yet. Use "+ Add Product" or Inward Purchase to add your first item.</td></tr>`;
    return;
  }

  tbody.innerHTML = [...APP_STATE.inventory].sort((a, b) => a.name.localeCompare(b.name)).map(it => {
    const threshold = Number.isFinite(it.lowStockLevel) ? it.lowStockLevel : lowStock;
    const isOut = it.stock <= 0, isLow = !isOut && it.stock <= threshold;
    const stockPill = isOut ? 'overdue' : (isLow ? 'pending' : 'paid');

    const ids = [
      ...(it.serials || []), ...(it.huids || []),
      ...(it.batches || []).map(b => `${b.batch}${b.expiry ? ` (exp ${b.expiry})` : ''}`)
    ];
    const idText = ids.length
      ? (ids.length <= 2 ? ids.map(esc).join(', ') : `${esc(ids[0])} +${ids.length - 1} more`)
      : '<span style="color:var(--text-faint);">untracked</span>';

    return `<tr>
      <td>
        <strong>${esc(it.name)}</strong>
        ${it.meta?.composition ? `<br><small style="color:var(--brand); font-style:italic;">${esc(it.meta.composition)}</small>` : ''}
      </td>
      <td>${esc(it.category)}</td>
      <td><code>${esc(it.barcode || it.hsn || '—')}</code></td>
      <td style="font-size:0.78rem;">${idText}</td>
      <td style="text-align:center;">${it.gst}%</td>
      <td style="text-align:right;">
        ₹${it.price.toFixed(2)}
        ${canSeeCost ? `<br><small style="color:var(--text-muted);">cost ${fmtCost(it.cost)}</small>` : ''}
      </td>
      <td style="text-align:center;"><span class="pill ${stockPill}">${it.stock}</span></td>
      <td style="text-align:center;">
        <button class="btn-pill secondary admin-only" style="padding:5px 11px; font-size:0.74rem;" onclick="openEditStockModal('${it.id}')">Edit</button>
      </td>
    </tr>`;
  }).join('');
}

function openEditStockModal(itemId) {
  const item = APP_STATE.inventory.find(i => i.id === itemId);
  if (!item) return;
  APP_STATE.editingItemId = itemId;

  setVal('editItemName', item.name);
  setVal('editItemCategory', item.category);
  setVal('editItemBarcode', item.barcode || '');
  setVal('editItemHsn', item.hsn || '');
  setVal('editItemGst', String(item.gst));
  setVal('editItemPrice', item.price);
  setVal('editItemCost', item.cost || '');
  setVal('editItemStock', item.stock);
  setVal('editItemLowStockLevel', item.lowStockLevel ?? '');
  setVal('editItemComposition', item.meta?.composition || item.composition || '');

  const costRow = $id('editItemCostRow');
  if (costRow) costRow.style.display = APP_STATE.isOwner === false ? 'none' : 'block';

  $id('editStockModal')?.classList.add('open');
}

function closeEditStockModal() {
  $id('editStockModal')?.classList.remove('open');
  APP_STATE.editingItemId = null;
}

function saveEditedStock() {
  const item = APP_STATE.inventory.find(i => i.id === APP_STATE.editingItemId);
  if (!item) return;

  const name = $id('editItemName')?.value.trim();
  if (!name) { showSaasToast('Product name is required.', 3000, 'err'); return; }

  const newStock = parseInt($id('editItemStock')?.value, 10);
  if (!Number.isFinite(newStock) || newStock < 0) {
    showSaasToast('Stock quantity must be a valid non-negative number.', 3500, 'err');
    return;
  }

  item.name = name;
  item.category = $id('editItemCategory')?.value || item.category;
  item.barcode = $id('editItemBarcode')?.value.trim() || '';
  item.hsn = $id('editItemHsn')?.value.trim() || item.hsn;
  item.gst = parseFloat($id('editItemGst')?.value) || item.gst;
  item.price = parseFloat($id('editItemPrice')?.value) || 0;
  item.stock = newStock;

  const lowLevel = $id('editItemLowStockLevel')?.value;
  item.lowStockLevel = lowLevel !== '' ? parseInt(lowLevel, 10) : undefined;

  if (APP_STATE.isOwner !== false) {
    const cost = parseFloat($id('editItemCost')?.value);
    if (Number.isFinite(cost)) item.cost = cost;
  }

  if (item.category === 'Pharmacy') {
    const composition = $id('editItemComposition')?.value.trim() || '';
    const nextMeta = /** @type {Record<string, any>} */ ({ ...(item.meta || {}) });
    if (composition) nextMeta.composition = composition;
    else delete nextMeta.composition;
    item.meta = /** @type {any} */ (nextMeta);
    item.composition = composition;
  }

  persistState();
  syncItemToCloud(item); // same cloud path every other stock write already uses
  renderInventoryTable();
  renderCatalog();
  renderAlertCentre();
  closeEditStockModal();
  showSaasToast(`${item.name} updated.`, 2500);
}

function deleteInventoryItemPrompt() {
  const item = APP_STATE.inventory.find(i => i.id === APP_STATE.editingItemId);
  if (!item) return;
  if (item.stock > 0) {
    showSaasToast(`Cannot delete "${item.name}" — it still has ${item.stock} unit(s) in stock. Set stock to 0 first.`, 5000, 'err');
    return;
  }
  if (!confirm(`Remove "${item.name}" from your catalogue? This cannot be undone from here.`)) return;

  APP_STATE.inventory = APP_STATE.inventory.filter(i => i.id !== item.id);
  persistState();
  renderInventoryTable();
  renderCatalog();
  closeEditStockModal();
  showSaasToast(`${item.name} removed.`, 2500);

  if (APP_STATE.cloudSession) {
    SB.client.from('items').delete().eq('id', item.id).then(({ error }) => {
      if (error) console.warn('Cloud delete failed:', error.message);
    });
  }
}

/* ==========================================================================
   PAGINATION  (P2 #11)
   A shop with 4,000 SKUs was rendering 4,000 DOM nodes on every catalog
   repaint — which is every add-to-cart. On a mid-range Android that is a
   visible freeze at the counter. Chunked rendering with a "load more" keeps
   the first paint bounded regardless of catalogue size, without pulling in
   a virtual-list library.
   ========================================================================== */
const PAGE_SIZE = 60;
// initial APP_STATE.catalogPage = 1 is set by app.js's initAppStateDefaults()
// (it calls resetCatalogPaging(), defined next), after the IndexedDB boot
// load resolves — see that function's comment in app.js for why the timing
// matters.

function resetCatalogPaging() { APP_STATE.catalogPage = 1; }

function loadMoreCatalog() {
  APP_STATE.catalogPage++;
  renderCatalog();
}

function renderPagerFooter(container, shown, total, onMoreFnName) {
  if (shown >= total) return;
  const footer = document.createElement('div');
  footer.className = 'pager-footer';
  footer.innerHTML = `
    <span>Showing ${shown} of ${total}</span>
    <button class="btn-pill secondary" onclick="${onMoreFnName}()">Load ${Math.min(PAGE_SIZE, total - shown)} more</button>`;
  container.appendChild(footer);
}

function renderCatalog() {
  const container = $id('catalogGrid');
  if (!container) return;
  container.innerHTML = '';
  const filtered = APP_STATE.inventory.filter(i => APP_STATE.activeSector === 'All' || i.category === APP_STATE.activeSector);

  const totalMatching = filtered.length;
  const pageLimit = APP_STATE.catalogPage * PAGE_SIZE;
  const visible = filtered.slice(0, pageLimit);

  const { lowStock } = getAlertThresholds();
  const expiryByItem = {};
  getExpiryAlerts().forEach(e => {
    // Keep only the most urgent batch per product for the card badge.
    if (!expiryByItem[e.itemId] || e.days < expiryByItem[e.itemId].days) expiryByItem[e.itemId] = e;
  });

  visible.forEach(it => {
    const card = document.createElement('div');
    const threshold = Number.isFinite(it.lowStockLevel) ? it.lowStockLevel : lowStock;
    const isOut = it.stock <= 0;
    const isLow = !isOut && it.stock <= threshold;
    const exp = expiryByItem[it.id];

    card.className = `catalog-card${isOut ? ' is-out' : ''}${isLow ? ' is-low' : ''}`;
    card.onclick = () => openItemModal(it);

    const tag = it.barcode ? `Barcode: ${esc(it.barcode)}` : `HSN: ${esc(it.hsn)}`;
    const comp = it.meta?.composition || it.composition || '';

    const badges = [
      isOut ? `<span class="mini-badge danger">Out of stock</span>` : '',
      isLow ? `<span class="mini-badge warn">Low · ${it.stock} left</span>` : '',
      exp ? `<span class="mini-badge ${exp.expired ? 'danger' : 'warn'}">${
        exp.expired ? `Expired ${Math.abs(exp.days)}d ago` : `Expires in ${exp.days}d`}</span>` : ''
    ].filter(Boolean).join('');

    card.innerHTML = `
      <div>
        <div class="name">${esc(it.name)}</div>
        <div class="meta">${tag} &bull; ${it.gst}% GST</div>
        ${comp ? `<div class="meta comp">${esc(comp)}</div>` : ''}
        ${badges ? `<div class="card-badges">${badges}</div>` : ''}
      </div>
      <div class="bottom">
        <span class="price">₹${it.price.toFixed(2)}</span>
        <span class="stock-tag ${isOut ? 'out' : (isLow ? 'low' : '')}">${it.stock} left</span>
      </div>
    `;
    container.appendChild(card);
  });

  renderPagerFooter(container, visible.length, totalMatching, 'loadMoreCatalog');
}

function openNewProductModal() { $id('newProdModal')?.classList.add('open'); }
function closeNewProdModal() { $id('newProdModal')?.classList.remove('open'); }

function saveNewProduct() {
  const name = $id('npName')?.value.trim();
  const category = $id('npCategory')?.value || 'Electronics';
  const barcode = $id('npBarcode')?.value.trim() || '';
  const hsn = $id('npHsn')?.value.trim() || '8517';
  const gst = parseInt($id('npGst')?.value, 10) || 18;
  const price = parseFloat($id('npPrice')?.value) || 0;
  const stock = parseInt($id('npStock')?.value, 10) || 0;
  const rawIds = $id('npIdentifiers')?.value || '';
  const idArray = rawIds.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);

  if (!name) return alert("Product name is required!");

  const metaByCategory = {
    Electronics: { imei: '', warranty: '' },
    Jewelry: { karat: '22K', netWt: 0, grossWt: 0, making: 0 },
    Pharmacy: { batch: idArray[0] || '', expiry: '2027-12' },
    Grocery: { pack: '' }
  };

  const newItem = {
    id: crypto.randomUUID(),
    name,
    category,
    barcode,
    hsn,
    gst,
    price,
    cost: price * 0.8,
    stock,
    serials: category === 'Electronics' ? idArray : [],
    huids: category === 'Jewelry' ? idArray : [],
    batches: category === 'Pharmacy' && idArray.length ? [{ batch: idArray[0], expiry: '2027-12', stock }] : [],
    meta: metaByCategory[category] || { pack: '' }
  };
  APP_STATE.inventory.push(newItem);

  persistState();
  syncItemToCloud(newItem);
  closeNewProdModal();
  renderCatalog();
}
