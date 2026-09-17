/* ==========================================================================
   BILLNAW — CATALOG, PAGINATION & NEW PRODUCT ENGINE
   Extracted verbatim from app.js (Phase 4 of the modernization migration —
   structural relocation only, no logic changed). Chunked catalog rendering
   (a shop with thousands of SKUs would otherwise repaint every item on
   every add-to-cart — see PAGE_SIZE comment below), the New Product modal,
   sector/search filtering, and exportData() (a Khata-ledger CSV export
   distinct from the Reports feature's exports — currently has no caller
   anywhere in the codebase, relocated verbatim as found rather than
   removed, since dead-code cleanup wasn't part of this structural pass).

   Found and fixed the same load-order hazard again here: a top-level
   `APP_STATE.catalogPage = 1;` statement sat right above this section.
   Folded into the APP_STATE object literal in app.js (same pattern as the
   Khata/Returns fields in prior commits).

   Depends on globals defined elsewhere, resolved at call time via the
   shared top-level lexical scope all these classic <script> tags sit in —
   same mechanism every other extracted engine file already relies on.
   Load order relative to app.js does not matter for that reason; this
   loads alongside the other extracted engines before app.js by convention.
   ========================================================================== */

/* ==========================================================================
   PAGINATION  (P2 #11)
   A shop with 4,000 SKUs was rendering 4,000 DOM nodes on every catalog
   repaint — which is every add-to-cart. On a mid-range Android that is a
   visible freeze at the counter. Chunked rendering with a "load more" keeps
   the first paint bounded regardless of catalogue size, without pulling in
   a virtual-list library.
   ========================================================================== */
const PAGE_SIZE = 60;

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

function filterSector(sec, el) {
  APP_STATE.activeSector = sec;
  $qa('.sector-chip').forEach(c => c.classList.remove('active'));
  if (el) el.classList.add('active');
  renderCatalog();
}

function handleSearch(q) {
  const cards = $qa('.catalog-card');
  cards.forEach(c => { c.style.display = c.innerText.toLowerCase().includes(q.toLowerCase()) ? 'flex' : 'none'; });
}

function handleGlobalSearch(q) {
  if (!q) return;
  const found = APP_STATE.inventory.find(i => 
    i.name.toLowerCase().includes(q.toLowerCase()) || 
    i.barcode === q.trim() ||
    (Array.isArray(i.serials) && i.serials.includes(q.trim()))
  );
  if (found) { switchView('pos'); openItemModal(found); }
}

/* downloadCSV lives in exportEngine.js (loaded before this file). */

function exportData(type) {
  if (type === 'khata') {
    const rows = [['Name', 'Category', 'Phone', 'GSTIN', 'Closing Due (₹)', 'Lifetime Value (₹)']];
    APP_STATE.customers.forEach(c => {
      rows.push([c.name, c.category || 'Retail', c.phone, c.gstin || '', (c.dues || 0).toFixed(2), (c.totalOrdersVal || 0).toFixed(2)]);
    });
    downloadCSV(`khata-ledger-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  }
}

window.resetCatalogPaging = resetCatalogPaging;
window.loadMoreCatalog = loadMoreCatalog;
window.renderPagerFooter = renderPagerFooter;
window.renderCatalog = renderCatalog;
window.openNewProductModal = openNewProductModal;
window.closeNewProdModal = closeNewProdModal;
window.saveNewProduct = saveNewProduct;
window.filterSector = filterSector;
window.handleSearch = handleSearch;
window.handleGlobalSearch = handleGlobalSearch;
window.exportData = exportData;
