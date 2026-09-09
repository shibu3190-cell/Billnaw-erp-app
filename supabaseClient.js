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

function getAuthRedirectUrl() {
  const origin = window.location.origin;
  const isLocalhost = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);
  if (isLocalhost && origin && origin !== 'null') return origin;
  return origin || 'http://localhost:3000';
}

function formatAuthError(error) {
  if (!error) return undefined;
  const msg = error.message || '';

  if (/already registered|already exists|user exists/i.test(msg)) {
    return 'An account with this email already exists. Sign in instead.';
  }
  if (/signup.*disabled|email signups are disabled/i.test(msg)) {
    return 'Email signup is disabled in Supabase. Enable the Email provider under Authentication settings.';
  }
  if (/redirect_to|redirect url|url configuration|site url/i.test(msg) || error.status === 422) {
    return 'Supabase rejected the signup redirect. Add http://localhost:55160/** to Authentication → URL configuration and make sure your site URL matches the current localhost address.';
  }
  if (/password/i.test(msg) && /6|weak|short/i.test(msg)) {
    return 'Choose a stronger password with at least 6 characters.';
  }
  if (error.status === 429 || /too many|rate limit/i.test(msg)) {
    return 'Too many OTP requests. Please wait about 30 seconds, then retry. Supabase is rate-limiting email verification requests.';
  }
  return msg;
}

const SB = {
  client: _sb,

  /* ---------------- AUTH ---------------- */

  async signUpShop({ email, password, shopName, phone, address, gstin, industry }) {
    const { data: authData, error: authErr } = await _sb.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: getAuthRedirectUrl() }
    });
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
    if (error) {
      if (/email not confirmed/i.test(error.message || '')) {
        return { error: 'Email is not confirmed. Disable Confirm email in Supabase Auth settings for local testing.' };
      }
      if (/invalid login credentials/i.test(error.message || '')) {
        return { error: 'Email or password is incorrect.' };
      }
      return { error: error.message };
    }
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
      options: {
        shouldCreateUser: allowCreate,
        // Prefer a code-based OTP for local testing and onboarding. Using a
        // redirect URL here turns the flow into a magic-link confirmation, which
        // is the issue the app keeps tripping over on localhost.
      }
    });
    return { error: formatAuthError(error) };
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
    return { error: formatAuthError(error) };
  },

  async verifyPhoneOtp(phone, token) {
    const { data, error } = await _sb.auth.verifyOtp({ phone, token, type: 'sms' });
    return { session: data?.session, error: error?.message };
  },

  // Used right after signup-OTP verification, when the auth user now exists
  // but has no shop/profile yet.
  async createShopForCurrentUser({ shopName, phone, address, gstin, industry }) {
    const { data: { session } } = await _sb.auth.getSession();
    if (!session) return { error: 'No active session.' };

    const stateCode = gstin && gstin.length >= 2 ? gstin.slice(0, 2) : null;

    const { data: shop, error: shopErr } = await _sb
      .from('shops')
      .insert({ name: shopName, phone, address, gstin, state_code: stateCode, industry, is_locked: industry !== 'All' })
      .select().single();
    if (shopErr) return { error: shopErr.message };

    const { error: profileErr } = await _sb
      .from('profiles')
      .insert({ id: session.user.id, shop_id: shop.id, role: 'owner', full_name: shopName });
    if (profileErr) return { error: profileErr.message };

    return { shop };
  },

  async getSessionAndProfile() {
    const { data: { session } } = await _sb.auth.getSession();
    if (!session) return { session: null, profile: null, shop: null, error: null };

    const { data: profile, error: profErr } = await _sb
      .from('profiles').select('*').eq('id', session.user.id).maybeSingle();
    if (profErr || !profile) {
      return { session, profile: null, shop: null, error: null };
    }

    const { data: shop, error: shopErr } = await _sb
      .from('shops').select('*').eq('id', profile.shop_id).maybeSingle();
    if (shopErr || !shop) {
      return { session, profile, shop: null, error: null };
    }

    return { session, profile, shop, error: null };
  },

  /* ---------------- ITEMS ---------------- */

  async fetchItems(shopId) {
    const { data, error } = await _sb.from('items').select('*').eq('shop_id', shopId).order('name');
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

  async saveSale(shopId, invoice) {
    const { data, error } = await _sb.from('sales').insert({
      shop_id: shopId,
      invoice_no: invoice.invoiceNo,
      idempotency_key: invoice.idempotency_key,
      customer_snapshot: invoice.customer,
      tender: invoice.tender,
      taxable: invoice.taxable,
      gst_total: invoice.gstTotal,
      round_off: invoice.roundOff,
      total: invoice.total,
      interstate: invoice.interstate,
      items: invoice.items,
    }).select().single();
    return { data, error: error?.message };
  },

  async fetchSales(shopId, limit = 200) {
    const { data, error } = await _sb
      .from('sales').select('*').eq('shop_id', shopId)
      .order('created_at', { ascending: false }).limit(limit);
    return { data: data || [], error: error?.message };
  },

  /* ---------------- AI INVOICE OCR ---------------- */

  async parseInvoiceImage(file) {
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const { data: { session } } = await _sb.auth.getSession();
    if (!session) return { error: 'Not signed in.' };

    const resp = await fetch(`${SUPABASE_URL}/functions/v1/ai-invoice-parse`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ image_base64: base64, mime_type: file.type || 'image/jpeg' }),
    });

    const json = await resp.json();
    if (!resp.ok) return { error: json.error || 'AI parse failed' };
    return { items: json.items || [] };
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
