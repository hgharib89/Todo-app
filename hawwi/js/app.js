/* Hawwi app core: router, guards, shell, ticker, shared flows */
(function () {
  'use strict';
  const H = (window.H = window.H || {});
  const U = H.U;
  const S = H.S;
  const esc = U.esc;
  const t = (k, v) => H.t(k, v);

  /* in-memory session state */
  H.mem = { returnTo: null, pendingPhone: null, prefillPhone: '', recentSearches: [], visited: {}, bizTab: {} };

  /* ---------- routes ---------- */
  const routes = [];
  H.route = function (pattern, view) {
    const keys = [];
    const re = new RegExp('^' + pattern.replace(/\//g, '\\/').replace(/:(\w+)/g, (m, k) => { keys.push(k); return '([^/]+)'; }) + '$');
    routes.push({ pattern, re, keys, view });
  };
  function match(path) {
    for (const r of routes) {
      const m = path.match(r.re);
      if (m) {
        const params = {};
        r.keys.forEach((k, i) => { try { params[k] = decodeURIComponent(m[i + 1]); } catch (e) { params[k] = m[i + 1]; } });
        return { route: r, params };
      }
    }
    return null;
  }

  /* ---------- navigation ---------- */
  const navStack = [];
  let lastDirection = 'fwd';
  H.go = function (hash, opts) {
    if (opts && opts.replace) { try { history.replaceState(null, '', hash); } catch (e) { /* ignore */ } navStack[navStack.length - 1] = hash; render({ dir: 'fwd' }); return; }
    if (location.hash === hash) render({ dir: 'fwd' }); else location.hash = hash;
  };
  H.back = function (fallback) {
    if (navStack.length > 1) history.back();
    else H.go(fallback || (S.prefs().ownerMode ? '#/owner/dashboard' : '#/home'), { replace: true });
  };
  H.requireLogin = function (returnTo) {
    H.mem.returnTo = returnTo || location.hash;
    H.go('#/login');
  };
  H.afterLogin = function () {
    const r = H.mem.returnTo; H.mem.returnTo = null;
    H.go(r && !/^#\/(login|otp|signup-name)/.test(r) ? r : '#/home', { replace: true });
  };

  /* ---------- language & theme ---------- */
  H.applyLang = function () {
    const l = S.lang();
    H.setLangInternal(l);
    document.documentElement.lang = l;
    document.documentElement.dir = l === 'ar' ? 'rtl' : 'ltr';
    document.title = t('app.name');
  };
  H.setLang = function (l) {
    S.setLang(l);
    H.applyLang();
    const sc = document.getElementById('scroller');
    const top = sc ? sc.scrollTop : 0;
    render({ keepScroll: true, noFocus: true });
    if (sc) sc.scrollTop = top;
  };
  H.toggleLang = () => H.setLang(S.lang() === 'ar' ? 'en' : 'ar');
  H.applyTheme = function () { document.documentElement.setAttribute('data-theme', S.prefs().theme || 'light'); };

  /* ---------- shell ---------- */
  let current = null; // {route, params, query, ctx}
  let renderToken = 0;

  function tabbarHtml(type, path) {
    if (type === 'customer') {
      const count = S.cartCount();
      const active = S.myOrders().filter((o) => S.STATUS_ACTIVE.indexOf(o.status) >= 0).length;
      const items = [
        ['🏠', 'nav.home', '#/home', /^\/home/],
        ['🔍', 'nav.explore', '#/search', /^\/(search|category)/],
        ['🛍️', 'nav.cart', '#/cart', /^\/cart/, count ? '<span class="count-badge cart-badge" aria-hidden="true">' + (count > 99 ? '99+' : count) + '</span>' : '', count ? t('nav.cartCount', { n: count }) : ''],
        ['🧾', 'nav.orders', '#/orders', /^\/orders/, active ? '<span class="count-badge dot-badge" aria-hidden="true">' + active + '</span>' : '', active ? t('nav.orders') + ' (' + active + ')' : ''],
        ['👤', 'nav.account', '#/profile', /^\/(profile|favorites)/]
      ];
      return renderTabs(items, path);
    }
    if (type === 'owner') {
      const p = S.prefs();
      const n = S.orders().filter((o) => o.businessId === p.ownerBusinessId && o.status === 'received').length;
      const items = [
        ['📊', 'owner.nav.dashboard', '#/owner/dashboard', /^\/owner\/dashboard/],
        ['📥', 'owner.nav.orders', '#/owner/orders', /^\/owner\/orders/, n ? '<span class="count-badge red-badge" aria-hidden="true">' + (n > 99 ? '99+' : n) + '</span>' : '', n ? t('owner.nav.orders') + ' (' + n + ')' : ''],
        ['🧺', 'owner.nav.products', '#/owner/products', /^\/owner\/products/],
        ['🏪', 'owner.nav.shop', '#/owner/profile', /^\/owner\/profile/]
      ];
      return renderTabs(items, path);
    }
    return '';
  }
  function renderTabs(items, path) {
    return items.map((it) => {
      const act = it[3].test(path);
      return '<a class="tab' + (act ? ' active' : '') + '" href="' + it[2] + '"' + (act ? ' aria-current="page"' : '') + (it[5] ? ' aria-label="' + esc(it[5]) + '"' : '') + '>' +
        '<span class="tab-ind" aria-hidden="true"></span><span class="tab-icon" aria-hidden="true">' + it[0] + (it[4] || '') + '</span><span class="tab-label">' + esc(t(it[1])) + '</span></a>';
    }).join('');
  }
  H.updateTabbar = function () {
    const nav = document.getElementById('tabbar');
    if (!nav || !current) return;
    const type = current.route.view.tabbar || null;
    nav.hidden = !type;
    nav.setAttribute('aria-label', t('nav.main'));
    if (type) nav.innerHTML = tabbarHtml(type, current.path);
    H.toastBottom(!!type);
  };
  H.bumpCart = function () {
    H.updateTabbar();
    const b = document.querySelector('.cart-badge');
    if (b && !U.reduced()) { b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); }
  };

  function render(opts) {
    opts = opts || {};
    const { path, query } = U.parseHash(location.hash);
    const prefs = S.prefs();
    if (path === '/' || path === '') { H.go('#/splash', { replace: true }); return; }
    const m = match(path);
    if (!m) { H.go(prefs.ownerMode ? '#/owner/dashboard' : '#/home', { replace: true }); return; }
    const view = m.route.view;
    if (view.auth && !S.user()) { H.mem.returnTo = location.hash; H.go('#/login', { replace: true }); return; }
    if (view.owner && !prefs.ownerMode) { H.go('#/profile', { replace: true }); return; }
    if (view.owner && prefs.ownerMode && !S.business(prefs.ownerBusinessId)) { H.go('#/owner/select', { replace: true }); return; }

    if (current && current.ctx && current.ctx.cleanup) { try { current.ctx.cleanup(); } catch (e) { console.warn(e); } }
    const token = ++renderToken;
    const el = document.getElementById('screen');
    const scroller = document.getElementById('scroller');
    const ctx = { params: m.params, query, path, el, token, cleanup: null };
    ctx.alive = () => token === renderToken;
    ctx.rerender = () => { if (ctx.alive()) renderView(view, ctx, false); };
    current = { route: m.route, params: m.params, query, path, ctx };
    document.getElementById('app').className = 'frame' + (view.cls ? ' ' + view.cls : '') + (prefs.ownerMode && view.owner ? ' owner' : '');
    H.updateTabbar();

    if (!opts.keepScroll) scroller.scrollTop = 0;
    if (!opts.keepScroll && !U.reduced()) {
      el.classList.remove('enter-fwd', 'enter-back'); void el.offsetWidth;
      el.classList.add(opts.dir === 'back' ? 'enter-back' : 'enter-fwd');
    }
    const firstVisit = view.skeleton && !H.mem.visited[m.route.pattern];
    if (firstVisit) {
      H.mem.visited[m.route.pattern] = true;
      el.setAttribute('aria-busy', 'true');
      el.innerHTML = view.skeleton(ctx);
      setTimeout(() => { if (ctx.alive()) { el.removeAttribute('aria-busy'); renderView(view, ctx, !opts.noFocus); } }, 400);
    } else {
      el.removeAttribute('aria-busy');
      renderView(view, ctx, !opts.noFocus);
    }
  }
  function renderView(view, ctx, focus) {
    if (ctx.cleanup) { try { ctx.cleanup(); } catch (e) { /* ignore */ } ctx.cleanup = null; }
    view.render(ctx);
    H.updateTabbar();
    if (focus) {
      const h1 = ctx.el.querySelector('h1');
      if (h1) {
        if (!h1.hasAttribute('tabindex')) h1.setAttribute('tabindex', '-1');
        try { h1.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
        const live = document.getElementById('live');
        if (live) live.textContent = h1.textContent;
      }
    }
  }
  H.rerender = function (keepScroll) {
    if (!current) return;
    const sc = document.getElementById('scroller');
    const top = sc.scrollTop;
    current.ctx.rerender();
    if (keepScroll !== false) sc.scrollTop = top;
  };
  H.current = () => current;

  window.addEventListener('hashchange', () => {
    const h = location.hash;
    let dir = 'fwd';
    if (navStack.length > 1 && navStack[navStack.length - 2] === h) { navStack.pop(); dir = 'back'; }
    else navStack.push(h);
    lastDirection = dir;
    render({ dir });
  });

  /* ---------- favourites ---------- */
  H.toggleFavorite = function (type, id, btn) {
    if (!S.user()) { H.requireLogin(location.hash); return; }
    const on = S.toggleFav(type, id);
    const obj = type === 'businesses' ? S.business(id) : S.product(id);
    const name = obj ? H.L(obj, 'name') : '';
    H.toast(t(on ? 'biz.favAdded' : 'biz.favRemoved', { name }), on ? {} : { action: { label: t('common.undo'), fn: () => { S.toggleFav(type, id); H.rerender(); } } });
    document.querySelectorAll('[data-fav="' + type + '"][data-id="' + CSS.escape(id) + '"]').forEach((b) => {
      b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); b.innerHTML = H.icon('heart', '', on);
    });
    if (current && current.route.view.onFavChange) current.route.view.onFavChange(current.ctx);
  };

  /* ---------- add to cart (one business per cart rule) ---------- */
  H.addToCart = async function (product, sel) {
    const cart = S.cart();
    const line = { productId: product.id, qty: sel.qty || 1, options: sel.options || {}, addons: sel.addons || {}, notes: sel.notes || '', unitPrice: S.unitPrice(product, sel.options, sel.addons) };
    if (cart.businessId && cart.businessId !== product.businessId && cart.lines.length) {
      const other = S.business(cart.businessId);
      const ok = await H.confirm({ title: t('cart.newCartTitle'), body: t('cart.newCartBody', { business: other ? H.L(other, 'name') : '' }), ok: t('cart.newCartConfirm'), danger: true });
      if (!ok) return false;
      S.startNewCart();
    }
    S.addLine(product.businessId, line);
    H.bumpCart();
    return true;
  };
  H.quickAdd = async function (pid) {
    const p = S.product(pid);
    if (!p || p.available === false) return;
    if (S.hasRequiredChoices(p)) { H.go('#/product/' + p.businessId + '/' + p.id); return; }
    const sel = S.defaultSelection(p);
    const ok = await H.addToCart(p, { qty: 1, options: sel.options, addons: sel.addons });
    if (ok) {
      H.toast(t('prod.addedNamed', { product: H.L(p, 'name') }), { type: 'success', action: { label: t('biz.viewCart'), fn: () => H.go('#/cart') } });
      if (current && current.route.view.onCartChange) current.route.view.onCartChange(current.ctx);
    }
  };

  /* ---------- review sheet (3.8) ---------- */
  H.openReviewSheet = function (bid, orderId, preset) {
    const u = S.user();
    if (!u) { H.requireLogin(location.hash); return; }
    let stars = preset || 0;
    const starsHtml = () => [1, 2, 3, 4, 5].map((n) => '<button type="button" role="radio" class="star-in' + (n <= stars ? ' on' : '') + '" aria-checked="' + (n === stars ? 'true' : 'false') + '" aria-label="' + esc(t('rev.stars', { n })) + '" data-star="' + n + '" tabindex="' + ((stars ? n === stars : n === 1) ? '0' : '-1') + '">★</button>').join('');
    const html = '<form class="form" novalidate data-rev-form>' +
      '<div class="field"><span class="label" id="rv-stars-l">' + esc(t('rev.yourRating')) + '</span><div class="star-input" role="radiogroup" aria-labelledby="rv-stars-l" data-stars>' + starsHtml() + '</div><p class="err" id="rv-stars-err" hidden></p></div>' +
      '<div class="field"><label class="label" for="rv-text">' + esc(t('rev.yourReview')) + '</label><textarea id="rv-text" class="input" rows="4" maxlength="300" placeholder="' + esc(t('rev.placeholder')) + '" aria-describedby="rv-text-err rv-count" aria-required="true"></textarea>' +
      '<div class="helper-row"><p class="err" id="rv-text-err" hidden></p><span class="counter" id="rv-count"><bdi>0/300</bdi></span></div></div>' +
      '<button type="submit" class="btn btn-primary btn-block btn-lg">' + esc(t('rev.submit')) + '</button></form>';
    H.sheet({
      title: t('rev.writeReview'), html,
      onMount(panel, sheet) {
        const box = panel.querySelector('[data-stars]');
        const setStars = (n) => { stars = n; box.innerHTML = starsHtml(); const b = box.querySelector('[data-star="' + n + '"]'); if (b) b.focus(); };
        box.addEventListener('click', (e) => { const b = e.target.closest('[data-star]'); if (b) setStars(+b.dataset.star); });
        box.addEventListener('keydown', (e) => {
          const rtl = document.documentElement.dir === 'rtl';
          let d = 0;
          if (e.key === 'ArrowRight') d = rtl ? -1 : 1; else if (e.key === 'ArrowLeft') d = rtl ? 1 : -1; else if (e.key === 'ArrowUp') d = 1; else if (e.key === 'ArrowDown') d = -1;
          if (d) { e.preventDefault(); setStars(Math.max(1, Math.min(5, (stars || 0) + d))); }
        });
        const ta = panel.querySelector('#rv-text');
        ta.addEventListener('input', () => { panel.querySelector('#rv-count').innerHTML = '<bdi>' + ta.value.length + '/300</bdi>'; });
        panel.querySelector('[data-rev-form]').addEventListener('submit', (e) => {
          e.preventDefault();
          const text = ta.value.trim();
          const se = panel.querySelector('#rv-stars-err'); const te = panel.querySelector('#rv-text-err');
          se.hidden = !!stars; se.textContent = t('rev.starsError');
          const bad = text.length < 10 || text.length > 300;
          te.hidden = !bad; te.textContent = t('rev.textError'); ta.setAttribute('aria-invalid', bad ? 'true' : 'false');
          if (!stars) { const b = box.querySelector('[data-star]'); if (b) b.focus(); return; }
          if (bad) { ta.focus(); return; }
          const l = S.lang();
          S.addReview({ id: U.uid('r'), businessId: bid, orderId: orderId || undefined, authorAr: u.name, authorEn: u.name, stars, lang: l, textAr: text, textEn: text, createdAt: new Date().toISOString() });
          sheet.close(true);
          H.toast(t('rev.thanks'), { type: 'success' });
          H.rerender();
        });
      }
    });
  };
  H.canReview = function (bid) {
    return S.myOrders().find((o) => o.businessId === bid && o.status === 'completed' && !o.reviewed) || null;
  };

  /* ---------- reorder (3.14) ---------- */
  H.reorder = async function (order) {
    const lines = [];
    let missing = false;
    order.lines.forEach((l) => {
      const p = S.product(l.productId);
      if (!p || p.hidden || p.available === false || p.businessId !== order.businessId) { missing = true; return; }
      const sel = S.defaultSelection(p);
      const options = Object.assign({}, sel.options);
      const addons = Object.assign({}, sel.addons);
      (p.groups || []).forEach((g) => {
        if (g.type === 'single' && l.options && l.options[g.id] && g.choices.some((c) => c.id === l.options[g.id])) options[g.id] = l.options[g.id];
        if (g.type === 'multi' && l.addons && Array.isArray(l.addons[g.id])) addons[g.id] = l.addons[g.id].filter((id) => g.choices.some((c) => c.id === id));
      });
      lines.push({ p, sel: { qty: l.qty, options, addons, notes: l.notes || '' } });
    });
    if (!lines.length) { H.toast(t('cart.unavailableItems'), { type: 'error' }); return; }
    const cart = S.cart();
    if (cart.businessId && cart.businessId !== order.businessId && cart.lines.length) {
      const other = S.business(cart.businessId);
      const ok = await H.confirm({ title: t('cart.newCartTitle'), body: t('cart.newCartBody', { business: other ? H.L(other, 'name') : '' }), ok: t('cart.newCartConfirm'), danger: true });
      if (!ok) return;
      S.startNewCart();
    }
    lines.forEach((x) => S.addLine(order.businessId, { productId: x.p.id, qty: x.sel.qty, options: x.sel.options, addons: x.sel.addons, notes: x.sel.notes, unitPrice: S.unitPrice(x.p, x.sel.options, x.sel.addons) }));
    if (missing) H.toast(t('cart.unavailableItems'));
    H.go('#/cart');
  };

  /* ---------- global delegated handlers ---------- */
  document.addEventListener('click', (e) => {
    const back = e.target.closest('[data-back]');
    if (back) { e.preventDefault(); if (current && current.route.view.onBack && current.route.view.onBack(current.ctx) === false) return; H.back(back.getAttribute('data-back')); return; }
    const fav = e.target.closest('[data-fav]');
    if (fav) { e.preventDefault(); H.toggleFavorite(fav.getAttribute('data-fav'), fav.getAttribute('data-id'), fav); return; }
    const qa = e.target.closest('[data-quick-add]');
    if (qa) { e.preventDefault(); H.quickAdd(qa.getAttribute('data-quick-add')); return; }
    const lg = e.target.closest('[data-act="login"]');
    if (lg) { e.preventDefault(); H.requireLogin(location.hash); return; }
    const sw = e.target.closest('.switch[role="switch"]');
    if (sw && !sw.hasAttribute('data-manual')) { const on = sw.getAttribute('aria-checked') !== 'true'; sw.setAttribute('aria-checked', on ? 'true' : 'false'); sw.dispatchEvent(new CustomEvent('toggle', { bubbles: true, detail: { on } })); }
  });
  /* tab/radiogroup keyboard: arrow keys with RTL rule */
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const tab = e.target.closest('[role="tab"]');
    if (!tab) return;
    const list = tab.closest('[role="tablist"]');
    if (!list) return;
    const tabs = Array.from(list.querySelectorAll('[role="tab"]:not([disabled])'));
    const i = tabs.indexOf(tab);
    const rtl = document.documentElement.dir === 'rtl';
    const nextKey = rtl ? 'ArrowLeft' : 'ArrowRight';
    const n = tabs[(i + (e.key === nextKey ? 1 : -1) + tabs.length) % tabs.length];
    if (n) { e.preventDefault(); n.focus(); n.click(); }
  });

  /* ---------- order ticker ---------- */
  function ticker() {
    let changed = [];
    try { changed = S.tick(Date.now()); } catch (e) { console.warn('hawwi tick', e); }
    if (changed.length) {
      const prefs = S.prefs();
      const u = S.user();
      changed.forEach((o) => {
        const viewing = current && /^\/track\//.test(current.path) && current.params.orderId === o.id;
        const mine = u && o.customer && o.customer.phone === u.phone;
        if (prefs.notifications && mine && !viewing && !prefs.ownerMode) {
          const b = S.business(o.businessId);
          H.toast(t('trk.statusToast', { business: b ? H.L(b, 'name') : '', status: H.statusLabel(o) }), { emoji: '🔔', action: { label: t('trk.track'), fn: () => H.go('#/track/' + o.id) } });
        }
      });
      H.updateTabbar();
    }
    if (current && current.route.view.onTick) { try { current.route.view.onTick(current.ctx, changed); } catch (e) { console.warn(e); } }
  }

  window.addEventListener('storage', (e) => {
    if (!e.key || e.key.indexOf('hawwi.') !== 0) return;
    if (e.key === 'hawwi.lang') { H.applyLang(); render({ keepScroll: true, noFocus: true }); return; }
    if (e.key === 'hawwi.prefs') H.applyTheme();
    H.updateTabbar();
    if (current && current.route.view.live) H.rerender();
  });

  /* ---------- boot ---------- */
  H.boot = function () {
    store_onError();
    S.init();
    H.applyLang();
    H.applyTheme();
    const flash = H.store.get('hawwi.flash', null);
    if (flash === 'reset') { H.store.remove('hawwi.flash'); setTimeout(() => H.toast(t('set.resetDone'), { type: 'success' }), 300); }
    navStack.push(location.hash || '#/splash');
    if (!location.hash || location.hash === '#' || location.hash === '#/') { try { history.replaceState(null, '', '#/splash'); } catch (e) { location.hash = '#/splash'; return; } navStack[0] = '#/splash'; }
    render({});
    setInterval(ticker, 1000);
  };
  function store_onError() {
    H.store.onError(() => setTimeout(() => H.toast(t('common.storageError'), { type: 'error' }), 600));
  }

  document.addEventListener('DOMContentLoaded', () => {
    try { H.boot(); } catch (e) {
      console.error(e);
      const el = document.getElementById('screen');
      if (el) el.innerHTML = H.empty({ emoji: '⚠️', title: t('common.notFound'), btn: { href: '#/home', label: t('common.goHome') } });
    }
  });
})();
