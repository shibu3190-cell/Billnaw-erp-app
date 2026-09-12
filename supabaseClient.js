/* ==========================================================================
   BILLNAW — SUPABASE INTEGRATION LAYER
   Loaded before app.js. Exposes a single `SB` namespace so app.js can call
   SB.signIn(), SB.saveSale(), etc. without every function in app.js needing
   to know Supabase's API shape directly.

   >>> FILL THESE IN from your Supabase project (Settings -> API) <<<
   The anon key is SAFE to expose in client code — it has no power on its
   own; every table is protected by the RLS policies in 0001_init.sql, so
   the anon key can only ever do what a signed-in user's role/shop allows.
   Never put the service_role key anywhere in this file or in git.
   ========================================================================== */
const SUPABASE_URL = 'https://tuygowqsavsvanpqngih.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_ZXUHlyyfHWx1ViZl1EWDlw_kD5gFNUb';

const _sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const SB = {
  client: _sb,

  /* ---------------- AUTH ---------------- */

  async signUpShop({ email, password, shopName, phone, address, gstin, industry }) {
    const { data: authData, error: authErr } = await _sb.auth.signUp({ email, password });
    if (authErr) return { error: authErr.message };
    const userId = authData.user?.id;
    if (!userId) return { error: 'Signup succeeded but no user id returned — check email confirmation settings.' };

    const stateCode = gstin && gstin.length >= 2 ? gstin.slice(0, 2) : null;

    const { data: shop, error: shopErr } = await _sb
      .from('shops')
      .insert({ name: shopName, phone, address, gstin, state_code: stateCode, industry, is_locked: industry !== 'All' })
      .select()
      .single();
    if (shopErr) return { error: shopErr.message };

    const { error: profileErr } = await _sb
      .from('profiles')
      .insert({ id: userId, shop_id: shop.id, role: 'owner', full_name: shopName });
    if (profileErr) return { error: profileErr.message };

    return { shop };
  },

  async signIn(email, password) {
    const { data, error } = await _sb.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { session: data.session, user: data.user };
  },

  async signOut() { await _sb.auth.signOut(); },

  /* ---------------- OTP (email + phone) ---------------- */

  // Email OTP. `shouldCreateUser: false` on the login path prevents someone
  // typing a typo'd address from silently creating an orphan account with
  // no shop attached — they'd get a code, verify it, and land in a broken
  // state. Signup verification passes true.
  async sendEmailOtp(email, allowCreate = false) {
    const { error } = await _sb.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: allowCreate }
    });
    return { error: error?.message };
  },

  async verifyEmailOtp(email, token) {
    const { data, error } = await _sb.auth.verifyOtp({ email, token, type: 'email' });
    return { session: data?.session, error: error?.message };
  },

  async sendPhoneOtp(phone, allowCreate = false) {
    const { error } = await _sb.auth.signInWithOtp({
      phone,
      options: { shouldCreateUser: allowCreate }
    });
    return { error: error?.message };
  },

  async verifyPhoneOtp(phone, token) {
    const { data, error } = await _sb.auth.verifyOtp({ phone, token, type: 'sms' });
    return { session: data?.session, error: error?.message };
  },

  async getSessionAndProfile() {
    const { data: { session } } = await _sb.auth.getSession();
    if (!session) return { session: null, profile: null, shop: null };

    const { data: profile } = await _sb
      .from('profiles').select('*').eq('id', session.user.id).maybeSingle();
    if (!profile) return { session, profile: null, shop: null };

    const { data: shop } = await _sb
      .from('shops').select('*').eq('id', profile.shop_id).maybeSingle();

    return { session, profile, shop: shop || null };
  },

  async signInWithGoogle() {
    const { error } = await _sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + window.location.pathname }
    });
    return { error: error?.message };
  },

  // Called after OTP verification, when the auth user exists but has no
  // shop yet. Deliberately not called earlier: creating the shop before
  // verification leaves orphan rows for every abandoned signup.
  async createShopForCurrentUser({ shopName, ownerName, phone, email, address, gstin, stateCode, industry }) {
    const { data: { session } } = await _sb.auth.getSession();
    if (!session) return { error: 'Session expired. Please sign in again.' };

    const resolvedState = stateCode || (gstin && gstin.length >= 2 ? gstin.slice(0, 2) : null);

    const { data: shop, error: shopErr } = await _sb
      .from('shops')
      .insert({
        name: shopName, owner_name: ownerName, phone, email: email || null,
        address, gstin: gstin || null, state_code: resolvedState,
        industry, is_locked: industry !== 'All'
      })
      .select().single();
    if (shopErr) return { error: shopErr.message };

    const { error: profileErr } = await _sb
      .from('profiles')
      .insert({ id: session.user.id, shop_id: shop.id, role: 'owner', full_name: ownerName || shopName });
    if (profileErr) return { error: profileErr.message };

    return { shop };
  },

  async updateShopSettings(shopId, patch) {
    const { error } = await _sb.from('shops').update(patch).eq('id', shopId);
    return { error: error?.message };
  },

  async fetchShopStaff(shopId) {
    const { data, error } = await _sb
      .from('profiles').select('full_name, role, id').eq('shop_id', shopId).order('role');
    return { data: data || [], error: error?.message };
  },

  /* ---------------- ITEMS ---------------- */

  // Routed through an RPC rather than a direct table select so the server
  // can null out `cost` for cashiers. A direct select would ship the whole
  // cost book to any staff device.
  async fetchItems(shopId) {
    const { data, error } = await _sb.rpc('fetch_items_for_role', { p_shop_id: shopId });
    return { data: data || [], error: error?.message };
  },

  async saveItem(item) {
    // item.id absent -> insert, present -> upsert-by-id
    const { data, error } = await _sb.from('items').upsert(item).select().single();
    return { data, error: error?.message };
  },

  async decrementStock(itemId, qty) {
    const { error } = await _sb.rpc('decrement_item_stock', { p_item_id: itemId, p_qty: qty });
    return { error: error?.message };
  },

  /* ---------------- CUSTOMERS ---------------- */

  async upsertCustomer(shopId, customer) {
    const { data, error } = await _sb
      .from('customers')
      .upsert({ shop_id: shopId, ...customer }, { onConflict: 'shop_id,phone' })
      .select().single();
    return { data, error: error?.message };
  },

  async fetchCustomers(shopId) {
    const { data, error } = await _sb.from('customers').select('*').eq('shop_id', shopId).order('name');
    return { data: data || [], error: error?.message };
  },

  /* ---------------- SALES ---------------- */

  // Single atomic call: inserts the invoice, decrements every line's stock,
  // and upserts the customer inside ONE Postgres transaction. Previously
  // these were three separate network calls — a drop between them could
  // save an invoice whose stock never moved.
  async saveSale(shopId, invoice) {
    const { data, error } = await _sb.rpc('create_invoice_atomic', {
      p_shop_id: shopId,
      p_invoice: {
        invoice_no: invoice.invoiceNo,
        idempotency_key: invoice.idempotency_key,
        customer_snapshot: invoice.customer,
        tender: invoice.tender,
        taxable: invoice.taxable,
        gst_total: invoice.gstTotal,
        round_off: invoice.roundOff,
        total: invoice.total,
        interstate: invoice.interstate,
        place_of_supply: invoice.placeOfSupply || null,
        industry: invoice.industry || null,
        items: invoice.items
      }
    });
    return { data, error: error?.message };
  },

  async nextInvoiceNumber(shopId, prefix = 'INV') {
    const { data, error } = await _sb.rpc('next_invoice_number', {
      p_shop_id: shopId, p_prefix: prefix
    });
    return { data, error: error?.message };
  },

  async fetchSales(shopId, limit = 200) {
    const { data, error } = await _sb.rpc('fetch_sales_for_role', { p_shop_id: shopId, p_limit: limit });
    return { data: data || [], error: error?.message };
  },

  // Owner-only; the server raises for cashiers rather than trusting the UI.
  async fetchProfitSummary(shopId, from, to) {
    const { data, error } = await _sb.rpc('shop_profit_summary', {
      p_shop_id: shopId, p_from: from || null, p_to: to || null
    });
    return { data, error: error?.message };
  },

  /* ---------------- PURCHASES / VENDORS ---------------- */

  async savePurchase(shopId, purchase) {
    const { data, error } = await _sb.rpc('create_purchase_atomic', {
      p_shop_id: shopId,
      p_purchase: {
        idempotency_key: purchase.idempotency_key,
        vendor: purchase.vendor || {},
        bill_no: purchase.billNo || '',
        bill_date: purchase.billDate || '',
        taxable: purchase.taxable || 0,
        gst_total: purchase.gstTotal || 0,
        round_off: purchase.roundOff || 0,
        total: purchase.total || 0,
        interstate: !!purchase.interstate,
        place_of_supply: purchase.placeOfSupply || '',
        payment_status: purchase.paymentStatus || 'unpaid',
        amount_paid: purchase.amountPaid || 0,
        source: purchase.source || 'manual',
        items: purchase.items || []
      }
    });
    return { data, error: error?.message };
  },

  async fetchPurchases(shopId, limit = 200) {
    const { data, error } = await _sb
      .from('purchases').select('*').eq('shop_id', shopId)
      .order('created_at', { ascending: false }).limit(limit);
    return { data: data || [], error: error?.message };
  },

  async fetchVendors(shopId) {
    const { data, error } = await _sb
      .from('vendors').select('*').eq('shop_id', shopId).order('name');
    return { data: data || [], error: error?.message };
  },

  async fetchStockAlerts(shopId) {
    const { data, error } = await _sb.rpc('shop_stock_alerts', { p_shop_id: shopId });
    return { data, error: error?.message };
  },

  /* ---------------- RETURNS / CREDIT NOTES ---------------- */

  async fetchReturnableLines(shopId, saleId) {
    const { data, error } = await _sb.rpc('returnable_lines', {
      p_shop_id: shopId, p_sale_id: saleId
    });
    return { data: data || [], error: error?.message };
  },

  // Atomic: credit note + restock + identifier restore + ledger credit +
  // parent invoice status, all in one Postgres transaction.
  async processReturn(shopId, saleId, ret) {
    const { data, error } = await _sb.rpc('process_sales_return_atomic', {
      p_shop_id: shopId,
      p_sale_id: saleId,
      p_return: {
        credit_note_no: ret.creditNoteNo,
        idempotency_key: ret.idempotency_key,
        reason: ret.reason || null,
        restock: ret.restock !== false,
        taxable: ret.taxable,
        gst_total: ret.gstTotal,
        round_off: ret.roundOff,
        total: ret.total,
        items: ret.items
      }
    });
    return { data, error: error?.message };
  },

  async fetchReturns(shopId, limit = 200) {
    const { data, error } = await _sb
      .from('sales_returns').select('*').eq('shop_id', shopId)
      .order('created_at', { ascending: false }).limit(limit);
    return { data: data || [], error: error?.message };
  },

  /* ---------------- AI INVOICE OCR ---------------- */

  // Returns the full reconciled bill object from the Edge Function:
  // { bill_header, bill_items, bill_summary, extraction_meta, staging_id }
  async parseInvoiceImage(file) {
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const { data: { session } } = await _sb.auth.getSession();
    if (!session) return { error: 'Not signed in.' };

    // A large photo over a shop's mobile data can legitimately take a while;
    // 60s is generous enough not to kill a slow-but-working request, and
    // short enough that a hung call doesn't leave the UI stuck forever.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/ai-invoice-parse`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ image_base64: base64, mime_type: file.type || 'image/jpeg' }),
      });

      const json = await resp.json();
      if (!resp.ok) return { error: json.error || `AI parse failed (${resp.status})` };
      return { bill: json };
    } catch (err) {
      if (err.name === 'AbortError') {
        return { error: 'The AI took too long to respond. Try a smaller or clearer photo.' };
      }
      return { error: err.message || 'Network error reaching the AI service.' };
    } finally {
      clearTimeout(timeout);
    }
  },

  /* ---------------- SUBSCRIPTION ---------------- */

  async fetchSubscription(shopId) {
    const { data, error } = await _sb.rpc('get_shop_subscription', { p_shop_id: shopId });
    return { data, error: error?.message };
  },

  async fetchAllPlans() {
    const { data, error } = await _sb
      .from('subscription_plans').select('*').order('display_order');
    return { data: data || [], error: error?.message };
  },

  /* ---------------- SUPER-ADMIN CROSS-SHOP ACCESS ---------------- */
  // Every call here is a deliberate elevation: logs first, then reads.
  // Matches the "time-boxed, audit-logged elevation" model from earlier —
  // there is no standing cross-shop query path anywhere else in this file.

  async adminListShops() {
    const { data, error } = await _sb.from('shops').select('*').order('created_at', { ascending: false });
    return { data: data || [], error: error?.message };
  },

  async adminViewShopSales(shopId, reason) {
    await _sb.rpc('log_super_admin_access', { p_shop_id: shopId, p_action: 'view_sales', p_meta: { reason } });
    const { data, error } = await _sb.from('sales').select('*').eq('shop_id', shopId).order('created_at', { ascending: false }).limit(200);
    return { data: data || [], error: error?.message };
  },

  async adminSetShopStatus(shopId, status, reason) {
    await _sb.rpc('log_super_admin_access', { p_shop_id: shopId, p_action: `set_status:${status}`, p_meta: { reason } });
    const { error } = await _sb.from('shops').update({ status }).eq('id', shopId);
    return { error: error?.message };
  },
};

window.SB = SB;
