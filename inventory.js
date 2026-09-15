/* ==========================================================================
   BILLNAW — INVENTORY (STOCK MASTER) TABLE ENGINE
   Extracted verbatim from app.js (Phase 4 of the modernization migration —
   structural relocation only, no logic changed). Full stock-master table
   render, the per-item edit-in-place modal, and delete-item (with the
   in-stock guard and cloud-delete follow-through).

   Depends on globals defined elsewhere, resolved at call time via the
   shared top-level lexical scope all these classic <script> tags sit in —
   same mechanism every other extracted engine file already relies on.
   Load order relative to app.js does not matter for that reason; this
   loads alongside the other extracted engines before app.js by convention.
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

window.renderInventoryTable = renderInventoryTable;
window.openEditStockModal = openEditStockModal;
window.closeEditStockModal = closeEditStockModal;
window.saveEditedStock = saveEditedStock;
window.deleteInventoryItemPrompt = deleteInventoryItemPrompt;
