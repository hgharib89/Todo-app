/* Hawwi store: the single persistence module (section 9) plus data accessors */
(function () {
  'use strict';
  const H = (window.H = window.H || {});
  const U = H.U;
  const SEED = H.SEED;
  const VERSION = 1;

  /* ---------- 9.1 storage wrapper ---------- */
  let storageErrorCb = null;
  let storageErrorPending = false;
  function notifyStorageErrorOnce() {
    if (storageErrorPending === 'done') return;
    if (storageErrorCb) { storageErrorPending = 'done'; storageErrorCb(); } else storageErrorPending = true;
  }

  const store = (() => {
    const mem = new Map();
    let useMem = false;
    try { const k = '__hawwi_test__'; localStorage.setItem(k, '1'); localStorage.removeItem(k); } catch (e) { useMem = true; }
    return {
      get(key, fallback) {
        try {
          const raw = useMem ? mem.get(key) : localStorage.getItem(key);
          return raw == null ? fallback : JSON.parse(raw);
        } catch (e) { console.warn('hawwi: bad value for', key, e); notifyStorageErrorOnce(); return fallback; }
      },
      set(key, value) {
        let raw;
        try { raw = JSON.stringify(value); } catch (e) { console.warn('hawwi: cannot serialise', key, e); return; }
        try { if (useMem) mem.set(key, raw); else localStorage.setItem(key, raw); } catch (e) { useMem = true; mem.set(key, raw); }
      },
      remove(key) {
        try { if (useMem) mem.delete(key); else localStorage.removeItem(key); } catch (e) { mem.delete(key); }
      },
      keys() {
        try {
          if (useMem) return Array.from(mem.keys());
          const out = [];
          for (let i = 0; i < localStorage.length; i++) out.push(localStorage.key(i));
          return out;
        } catch (e) { return Array.from(mem.keys()); }
      },
      isMemory: () => useMem,
      onError(cb) { storageErrorCb = cb; if (storageErrorPending === true) { storageErrorPending = 'done'; cb(); } }
    };
  })();
  H.store = store;

  const K = {
    version: 'hawwi.version', lang: 'hawwi.lang', onb: 'hawwi.onboardingSeen', user: 'hawwi.user', prefs: 'hawwi.prefs',
    cart: 'hawwi.cart', orders: 'hawwi.orders', seq: 'hawwi.orderSeq', fav: 'hawwi.favorites', pov: 'hawwi.productOverrides',
    custom: 'hawwi.customProducts', bov: 'hawwi.businessOverrides', reviews: 'hawwi.reviews', seededAt: 'hawwi.seededAt', flash: 'hawwi.flash'
  };

  const DEFAULT_PREFS = { emirate: 'all', area: null, notifications: true, autoAdvance: true, theme: 'light', ownerMode: false, ownerBusinessId: null };
  const emptyCart = (fulfilment) => ({ businessId: null, lines: [], fulfilment: fulfilment || 'pickup', slot: { type: 'asap' }, promo: null, updatedAt: new Date().toISOString() });

  const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
  /* typed getters: fall back to defaults if the stored shape is wrong */
  function getObj(key, fb) { const v = store.get(key, fb); if (!isObj(v)) { if (v != null && v !== fb) { console.warn('hawwi: wrong shape for', key); notifyStorageErrorOnce(); } return fb; } return v; }
  function getArr(key) { const v = store.get(key, []); if (!Array.isArray(v)) { console.warn('hawwi: wrong shape for', key); notifyStorageErrorOnce(); return []; } return v; }

  const S = {};
  S.K = K;

  /* ---------- prefs, user, lang ---------- */
  S.lang = () => (store.get(K.lang, 'ar') === 'en' ? 'en' : 'ar');
  S.setLang = (l) => store.set(K.lang, l === 'en' ? 'en' : 'ar');
  S.onboardingSeen = () => store.get(K.onb, false) === true;
  S.setOnboardingSeen = () => store.set(K.onb, true);
  S.prefs = () => Object.assign({}, DEFAULT_PREFS, getObj(K.prefs, {}));
  S.setPrefs = (patch) => { const p = Object.assign(S.prefs(), patch); store.set(K.prefs, p); return p; };
  S.user = () => { const u = store.get(K.user, null); return isObj(u) && u.phone ? Object.assign({ addresses: [] }, u) : null; };
  S.setUser = (u) => (u ? store.set(K.user, u) : store.remove(K.user));

  /* ---------- businesses ---------- */
  S.bizOverrides = () => getObj(K.bov, {});
  S.businesses = function () {
    const ov = S.bizOverrides();
    return SEED.businesses.map((b) => Object.assign({}, b, ov[b.id] || {}));
  };
  S.business = (id) => S.businesses().find((b) => b.id === id) || null;
  S.saveBusinessOverride = function (bid, patch) {
    const ov = S.bizOverrides();
    ov[bid] = Object.assign({}, ov[bid] || {}, patch);
    store.set(K.bov, ov);
  };
  S.gradient = (b) => SEED.gradients[b && b.colors] || SEED.gradients.sand;
  S.category = (id) => SEED.categories.find((c) => c.id === id) || SEED.categories[0];

  /* ---------- products ---------- */
  S.prodOverrides = () => getObj(K.pov, {});
  S.customProducts = () => getArr(K.custom);
  S.allProducts = function () {
    const ov = S.prodOverrides();
    return SEED.products.concat(S.customProducts())
      .map((p) => Object.assign({}, p, ov[p.id] || {}))
      .filter((p) => !p.deleted);
  };
  /* products for a business; customer view hides owner-hidden */
  S.products = function (bid, opts) {
    const all = S.allProducts().filter((p) => p.businessId === bid);
    return opts && opts.all ? all : all.filter((p) => !p.hidden);
  };
  S.product = (pid) => S.allProducts().find((p) => p.id === pid) || null;
  S.saveProduct = function (pid, data) {
    const custom = S.customProducts();
    const idx = custom.findIndex((p) => p.id === pid);
    if (idx >= 0) { custom[idx] = Object.assign({}, custom[idx], data); store.set(K.custom, custom); return; }
    const ov = S.prodOverrides();
    ov[pid] = Object.assign({}, ov[pid] || {}, data);
    store.set(K.pov, ov);
  };
  S.addProduct = function (p) { const custom = S.customProducts(); custom.push(p); store.set(K.custom, custom); };
  S.deleteProduct = function (pid) {
    const custom = S.customProducts();
    const idx = custom.findIndex((p) => p.id === pid);
    if (idx >= 0) { custom.splice(idx, 1); store.set(K.custom, custom); }
    else S.saveProduct(pid, { deleted: true });
  };
  S.sections = function (bid) {
    const seen = {}; const out = [];
    S.products(bid, { all: true }).forEach((p) => { const k = p.section && p.section.ar; if (k && !seen[k]) { seen[k] = 1; out.push(p.section); } });
    return out;
  };

  /* ---------- pricing ---------- */
  S.defaultSelection = function (p) {
    const options = {}; const addons = {};
    (p.groups || []).forEach((g) => {
      if (g.type === 'single' && g.required && g.choices.length) options[g.id] = g.choices[0].id;
      if (g.type === 'multi') addons[g.id] = [];
    });
    return { options, addons };
  };
  S.hasRequiredChoices = (p) => (p.groups || []).some((g) => g.type === 'single' && g.required && g.choices.length > 1);
  S.unitPrice = function (p, options, addons) {
    let u = Number(p.price) || 0;
    (p.groups || []).forEach((g) => {
      if (g.type === 'single') {
        const c = g.choices.find((x) => x.id === (options || {})[g.id]);
        if (c) u += Number(c.delta) || 0;
      } else {
        const sel = (addons || {})[g.id] || [];
        g.choices.forEach((c) => { if (sel.indexOf(c.id) >= 0) u += Number(c.delta) || 0; });
      }
    });
    return U.round2(u);
  };
  S.optionLabels = function (p, options, addons) {
    const ar = []; const en = [];
    (p.groups || []).forEach((g) => {
      if (g.type === 'single') {
        const c = g.choices.find((x) => x.id === (options || {})[g.id]);
        if (c && g.choices.length > 1) { ar.push(c.nameAr); en.push(c.nameEn); }
      } else {
        const sel = (addons || {})[g.id] || [];
        g.choices.forEach((c) => { if (sel.indexOf(c.id) >= 0) { ar.push('+ ' + c.nameAr); en.push('+ ' + c.nameEn); } });
      }
    });
    return { ar, en };
  };

  /* ---------- favourites ---------- */
  S.favorites = function () { const f = getObj(K.fav, {}); return { businesses: Array.isArray(f.businesses) ? f.businesses : [], products: Array.isArray(f.products) ? f.products : [] }; };
  S.isFav = (type, id) => S.favorites()[type].indexOf(id) >= 0;
  S.toggleFav = function (type, id) {
    const f = S.favorites();
    const i = f[type].indexOf(id);
    if (i >= 0) f[type].splice(i, 1); else f[type].unshift(id);
    store.set(K.fav, f);
    return i < 0;
  };

  /* ---------- reviews ---------- */
  S.seededAt = () => new Date(store.get(K.seededAt, new Date().toISOString()));
  S.userReviews = () => getArr(K.reviews);
  S.reviews = function (bid) {
    const anchor = S.seededAt().getTime();
    const seed = SEED.reviews.filter((r) => r.businessId === bid).map((r) => Object.assign({}, r, { createdAt: new Date(anchor - r.daysAgo * U.DAY).toISOString() }));
    const mine = S.userReviews().filter((r) => r.businessId === bid);
    return mine.concat(seed).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  };
  S.addReview = function (rev) {
    const list = S.userReviews(); list.push(rev); store.set(K.reviews, list);
    const b = S.business(rev.businessId);
    const count = (b.reviewCount || 0) + 1;
    const rating = Math.round((((b.rating || 0) * (b.reviewCount || 0)) + rev.stars) / count * 10) / 10;
    S.saveBusinessOverride(b.id, { rating, reviewCount: count });
    if (rev.orderId) S.updateOrder(rev.orderId, (o) => { o.reviewed = true; });
  };
  S.starDist = function (rating) {
    const keys = Object.keys(SEED.starDist).map(Number);
    let best = keys[0];
    keys.forEach((k) => { if (Math.abs(k - rating) < Math.abs(best - rating)) best = k; });
    return SEED.starDist[best];
  };

  /* ---------- cart ---------- */
  S.cart = function () {
    const c = getObj(K.cart, null);
    if (!c || !Array.isArray(c.lines)) return emptyCart();
    return Object.assign(emptyCart(), c);
  };
  S.saveCart = (c) => { c.updatedAt = new Date().toISOString(); if (!c.lines.length) { c.businessId = null; c.promo = null; } store.set(K.cart, c); };
  S.clearCart = function () { const c = S.cart(); S.saveCart(emptyCart(c.fulfilment)); };
  S.cartCount = () => S.cart().lines.reduce((s, l) => s + (l.qty || 0), 0);
  S.sameLine = (a, b) => a.productId === b.productId && JSON.stringify(a.options || {}) === JSON.stringify(b.options || {}) &&
    JSON.stringify(a.addons || {}) === JSON.stringify(b.addons || {}) && (a.notes || '') === (b.notes || '');
  S.addLine = function (bid, line) {
    const c = S.cart();
    if (c.businessId && c.businessId !== bid) return false;
    c.businessId = bid;
    const ex = c.lines.find((l) => S.sameLine(l, line));
    if (ex) ex.qty = Math.min(20, ex.qty + line.qty);
    else c.lines.push(Object.assign({ lineId: U.uid('l') }, line));
    const b = S.business(bid);
    if (b && !b.delivery) c.fulfilment = 'pickup';
    else if (b && !b.pickup) c.fulfilment = 'delivery';
    S.saveCart(c);
    return true;
  };
  S.startNewCart = function () { const c = S.cart(); S.saveCart(emptyCart(c.fulfilment)); };

  /* Promo rules (3.10) */
  S.PROMOS = ['HAWWI10', 'WELCOME15', 'FREEDEL'];
  S.checkPromo = function (code, subtotal, fulfilment) {
    code = String(code || '').trim().toUpperCase();
    if (S.PROMOS.indexOf(code) < 0) return { ok: false, err: H.t('cart.promoInvalid') };
    if (code === 'WELCOME15' && subtotal < 60) return { ok: false, err: H.t('cart.promoMin', { amount: U.fmtPrice(60) }) };
    if (code === 'FREEDEL' && fulfilment !== 'delivery') return { ok: false, err: H.t('cart.promoDeliveryOnly') };
    return { ok: true, code };
  };

  /* Recompute the cart from current product data. Removes lines whose product is gone. */
  S.computeCart = function () {
    const c = S.cart();
    const biz = c.businessId ? S.business(c.businessId) : null;
    const removed = [];
    let changed = false;
    if (c.businessId && !biz) { c.lines.forEach((l) => removed.push(l)); c.lines = []; changed = true; }
    const lines = [];
    c.lines = c.lines.filter((l) => {
      const p = S.product(l.productId);
      if (!p || p.hidden || p.available === false || p.businessId !== c.businessId) { removed.push(l); changed = true; return false; }
      const unit = S.unitPrice(p, l.options, l.addons);
      if (l.unitPrice !== unit) { l.unitPrice = unit; changed = true; }
      lines.push({ line: l, product: p, unit, total: U.round2(unit * l.qty) });
      return true;
    });
    if (biz) {
      if (c.fulfilment === 'delivery' && !biz.delivery) { c.fulfilment = 'pickup'; changed = true; }
      if (c.fulfilment === 'pickup' && !biz.pickup) { c.fulfilment = 'delivery'; changed = true; }
    }
    const subtotal = U.round2(lines.reduce((s, x) => s + x.total, 0));
    let deliveryFee = c.fulfilment === 'delivery' && biz ? (Number(biz.deliveryFee) || 0) : 0;
    let discount = 0;
    let promoRemoved = false;
    if (c.promo) {
      const chk = S.checkPromo(c.promo, subtotal, c.fulfilment);
      if (!chk.ok || !lines.length) { c.promo = null; promoRemoved = lines.length > 0; changed = true; }
      else if (c.promo === 'HAWWI10') discount = Math.min(U.round2(subtotal * 0.1), 30);
      else if (c.promo === 'WELCOME15') discount = Math.min(15, subtotal);
      else if (c.promo === 'FREEDEL') deliveryFee = 0;
    }
    discount = U.round2(discount);
    const total = U.round2(Math.max(0, subtotal + deliveryFee - discount));
    if (changed) S.saveCart(c);
    const removedNames = removed.map((l) => { const p = S.product(l.productId); return p ? H.L(p, 'name') : ''; });
    return { cart: c, biz, lines, removed, removedNames, promoRemoved, subtotal, deliveryFee, discount, total, count: lines.reduce((s, x) => s + x.line.qty, 0) };
  };

  /* ---------- orders ---------- */
  S.STATUS_ACTIVE = ['received', 'preparing', 'ready'];
  S.STATUS_TERMINAL = ['completed', 'rejected', 'cancelled'];
  S.orders = () => getArr(K.orders);
  S.saveOrders = (list) => store.set(K.orders, list);
  S.order = (id) => S.orders().find((o) => o.id === id) || null;
  S.updateOrder = function (id, fn) {
    const list = S.orders();
    const o = list.find((x) => x.id === id);
    if (!o) return null;
    fn(o);
    S.saveOrders(list);
    return o;
  };
  S.myOrders = function () {
    const u = S.user();
    if (!u) return [];
    return S.orders().filter((o) => o.customer && o.customer.phone === u.phone).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  };
  S.durationAfter = function (status, o) {
    if (status === 'received') return 8000;
    if (status === 'preparing') return 20000;
    if (status === 'ready') return o.fulfilment === 'delivery' ? 15000 : 12000;
    return null;
  };
  S.NEXT = { received: 'preparing', preparing: 'ready', ready: 'completed' };
  /* Set status: owner actions set simulate=false */
  S.setStatus = function (id, status, opts) {
    opts = opts || {};
    return S.updateOrder(id, (o) => {
      o.status = status;
      const at = opts.at || Date.now();
      o.history = (o.history || []).concat([{ status, at: new Date(at).toISOString() }]);
      if (opts.byOwner) o.simulate = false;
      const d = S.durationAfter(status, o);
      o.nextAt = d == null ? null : at + d;
      if (opts.reason) o.rejectReason = opts.reason;
    });
  };
  /* Advance simulated orders (one step per order per tick). Returns changed orders. */
  S.tick = function (now) {
    now = now || Date.now();
    const list = S.orders();
    const changed = [];
    list.forEach((o) => {
      if (!o.simulate || S.STATUS_TERMINAL.indexOf(o.status) >= 0 || !o.nextAt || now < o.nextAt) return;
      const ns = S.NEXT[o.status];
      if (!ns) return;
      o.status = ns;
      o.history = (o.history || []).concat([{ status: ns, at: new Date(now).toISOString() }]);
      const d = S.durationAfter(ns, o);
      o.nextAt = d == null ? null : now + d;
      changed.push(o);
    });
    if (changed.length) S.saveOrders(list);
    return changed;
  };
  S.nextOrderId = function () {
    const seq = (Number(store.get(K.seq, 1084)) || 1084) + 1;
    store.set(K.seq, seq);
    return 'HW-' + seq;
  };
  S.buildOrderLines = function (cc) {
    return cc.lines.map((x) => {
      const lbl = S.optionLabels(x.product, x.line.options, x.line.addons);
      return { productId: x.product.id, nameAr: x.product.nameAr, nameEn: x.product.nameEn, emoji: x.product.emoji, qty: x.line.qty,
        optionLabels: lbl, options: x.line.options, addons: x.line.addons, notes: x.line.notes || '', unitPrice: x.unit, lineTotal: x.total };
    });
  };
  S.placeOrder = function (cc, extra) {
    const now = Date.now();
    const prefs = S.prefs();
    const u = S.user();
    const biz = cc.biz;
    const slot = cc.cart.slot || { type: 'asap' };
    const etaAt = slot.type === 'asap'
      ? now + ((biz.prep || 30) + (cc.cart.fulfilment === 'delivery' ? 15 : 0)) * U.MIN
      : (slot.at || now);
    const o = {
      id: S.nextOrderId(), businessId: biz.id, customer: { name: u ? u.name : '', phone: u ? u.phone : '' },
      lines: S.buildOrderLines(cc), fulfilment: cc.cart.fulfilment, address: extra.address || null, slot,
      etaAt: new Date(etaAt).toISOString(), payment: extra.payment,
      subtotal: cc.subtotal, deliveryFee: cc.deliveryFee, discount: cc.discount, total: cc.total, promo: cc.cart.promo || null,
      status: 'received', history: [{ status: 'received', at: new Date(now).toISOString() }],
      simulate: prefs.autoAdvance !== false, nextAt: now + 8000, createdAt: new Date(now).toISOString()
    };
    const list = S.orders(); list.push(o); S.saveOrders(list);
    const c = S.cart(); S.saveCart(emptyCart(c.fulfilment));
    return o;
  };

  /* ---------- 8.5 seed orders ---------- */
  function seedOrders(now) {
    const out = [];
    const today = U.startOfDay(now);
    SEED.businesses.forEach((b, i) => {
      const prods = SEED.products.filter((p) => p.businessId === b.id && p.available && !p.hidden);
      const mk = (k, createdAt, status, picks, fulfilment, payment) => {
        const n = i * 6 + k;
        const cust = SEED.customers[n % 6];
        const lines = picks.map(([idx, qty]) => {
          const p = prods[idx % prods.length];
          const sel = S.defaultSelection(p);
          const unit = S.unitPrice(p, sel.options, sel.addons);
          return { productId: p.id, nameAr: p.nameAr, nameEn: p.nameEn, emoji: p.emoji, qty, optionLabels: S.optionLabels(p, sel.options, sel.addons),
            options: sel.options, addons: sel.addons, notes: '', unitPrice: unit, lineTotal: U.round2(unit * qty) };
        });
        const ful = fulfilment === 'delivery' && b.delivery ? 'delivery' : 'pickup';
        const subtotal = U.round2(lines.reduce((s, l) => s + l.lineTotal, 0));
        const fee = ful === 'delivery' ? b.deliveryFee : 0;
        const ct = createdAt.getTime();
        const hist = [{ status: 'received', at: new Date(ct).toISOString() }];
        if (status === 'completed') {
          hist.push({ status: 'preparing', at: new Date(ct + 3 * U.MIN).toISOString() });
          hist.push({ status: 'ready', at: new Date(ct + b.prep * U.MIN).toISOString() });
          hist.push({ status: 'completed', at: new Date(ct + (b.prep + 15) * U.MIN).toISOString() });
        } else if (status === 'rejected') {
          hist.push({ status: 'rejected', at: new Date(ct + 4 * U.MIN).toISOString() });
        }
        out.push({
          id: 'HW-' + (1001 + n), businessId: b.id,
          customer: { name: cust[0] + ' / ' + cust[1], nameAr: cust[0], nameEn: cust[1], phone: '+97150000' + (1000 + n) },
          lines, fulfilment: ful,
          address: ful === 'delivery' ? { id: 'seed', label: 'home', emirate: b.emirate, area: b.areaAr, areaEn: b.areaEn, street: '12', unit: String(3 + k) } : null,
          slot: { type: 'asap' }, etaAt: new Date(ct + (b.prep + (ful === 'delivery' ? 15 : 0)) * U.MIN).toISOString(),
          payment: payment, subtotal, deliveryFee: fee, discount: 0, total: U.round2(subtotal + fee), promo: null,
          status, history: hist, simulate: false, nextAt: null, seed: true, createdAt: new Date(ct).toISOString(),
          rejectReason: status === 'rejected' ? 'مشغولين حالياً / Too busy' : undefined
        });
      };
      const at = (dayOff, h, m) => { const d = U.addDays(today, dayOff); d.setHours(h, m, 0, 0); return d; };
      let k1 = new Date(now.getTime() - 3 * 3600000);
      if (k1 < today) k1 = new Date(Math.min(now.getTime() - 25 * U.MIN, today.getTime() + 9 * 3600000));
      if (k1 < today) k1 = new Date(today.getTime() + 60000);
      mk(0, new Date(now.getTime() - 20 * U.MIN), 'received', [[0, 1]], 'delivery', { method: 'card', brand: 'visa', last4: '4242' });
      mk(1, k1, 'completed', [[1, 2]], 'pickup', { method: 'cash' });
      mk(2, at(-1, 13, 0), 'completed', [[0, 1], [2, 1]], 'delivery', { method: 'applepay' });
      mk(3, at(-2, 19, 0), 'completed', [[3, 2]], 'pickup', { method: 'card', brand: 'mastercard', last4: '1881' });
      mk(4, at(-4, 12, 30), 'completed', [[0, 3]], 'delivery', { method: 'cash' });
      mk(5, at(-6, 18, 15), 'rejected', [[1, 1]], 'pickup', { method: 'card', brand: 'visa', last4: '4242' });
    });
    return out;
  }

  /* ---------- boot / reset ---------- */
  S.resetKeys = function () {
    store.keys().forEach((k) => { if (k && k.indexOf('hawwi.') === 0 && k !== K.lang && k !== K.onb) store.remove(k); });
  };
  S.init = function () {
    const v = store.get(K.version, null);
    if (v !== null && v !== VERSION) S.resetKeys();
    store.set(K.version, VERSION);
    let seeded = store.get(K.seededAt, null);
    if (!seeded || isNaN(new Date(seeded).getTime())) { seeded = new Date().toISOString(); store.set(K.seededAt, seeded); }
    const rawOrders = store.get(K.orders, null);
    if (!Array.isArray(rawOrders)) {
      store.set(K.orders, seedOrders(new Date()));
      store.set(K.seq, 1084);
    }
  };
  S.resetDemo = function () { S.resetKeys(); S.init(); };

  H.S = S;
})();
