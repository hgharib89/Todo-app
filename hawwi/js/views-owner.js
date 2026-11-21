/* Hawwi views: owner mode (select, dashboard, orders, order detail) */
(function () {
  'use strict';
  const H = window.H;
  const U = H.U;
  const S = H.S;
  const esc = U.esc;
  const t = (k, v) => H.t(k, v);

  H.ownerBiz = () => S.business(S.prefs().ownerBusinessId);
  H.exitOwner = function () { S.setPrefs({ ownerMode: false }); H.go('#/home', { replace: true }); };

  /* owner app bar (4 intro) */
  H.ownerBar = function (b, title) {
    const acc = b.acceptingOrders !== false;
    return '<header class="owner-bar"><div class="ob-top">' + H.bizLogo(b, 'logo-40') + '<div class="grow"><strong class="ob-name" dir="auto">' + esc(H.L(b, 'name')) + '</strong><span class="pill owner-pill">' + esc(t('own.mode')) + '</span></div>' +
      '<button type="button" class="btn btn-ghost btn-sm" data-exit-owner>' + esc(t('own.backToShopping')) + '</button></div>' +
      '<div class="ob-accept"><span id="acc-l">' + esc(t('own.accepting')) + '</span>' + H.sw({ on: acc, data: ' data-accepting aria-labelledby="acc-l"' }) + '<span class="muted" data-acc-state>' + esc(t(acc ? 'own.acceptingOn' : 'own.acceptingOff')) + '</span></div>' +
      '<h1 class="appbar-title owner-title" tabindex="-1">' + esc(title) + '</h1></header>';
  };
  /* shared owner bar handlers (delegated, bound once) */
  document.addEventListener('click', (e) => { if (e.target.closest('[data-exit-owner]')) { e.preventDefault(); H.exitOwner(); } });
  document.addEventListener('toggle', (e) => {
    const sw = e.target.closest && e.target.closest('[data-accepting]');
    if (!sw) return;
    const b = H.ownerBiz(); if (!b) return;
    S.saveBusinessOverride(b.id, { acceptingOrders: e.detail.on });
    const st = document.querySelector('[data-acc-state]'); if (st) st.textContent = t(e.detail.on ? 'own.acceptingOn' : 'own.acceptingOff');
    H.toast(e.detail.on ? t('own.accepting') + ' ✓' : t('own.pausedNote'));
  });

  /* ---------- owner actions ---------- */
  H.ownerAction = function (id, action, reason) {
    const o = S.order(id);
    if (!o) return false;
    const map = { accept: ['received', 'preparing', 'own.accepted'], reject: ['received', 'rejected', 'own.rejected'], ready: ['preparing', 'ready', 'own.markedReady'], complete: ['ready', 'completed', 'own.completed'] };
    const m = map[action];
    if (!m || o.status !== m[0]) return false;
    S.setStatus(id, m[1], { byOwner: true, reason });
    H.toast(t(m[2], { id: '#' + id }), { type: 'success' });
    H.updateTabbar();
    return true;
  };
  H.rejectSheet = function (id, onDone) {
    const reasons = ['stock', 'busy', 'area', 'other'];
    H.sheet({
      title: t('own.rejectTitle'),
      html: '<form class="form" data-f novalidate><div class="chip-wrap" role="radiogroup" aria-label="' + esc(t('own.rejectTitle')) + '">' + reasons.map((r, i) => '<label class="chip radio-chip"><input type="radio" name="reason" value="' + r + '"' + (i === 0 ? ' checked' : '') + '> ' + esc(t('own.reason.' + r)) + '</label>').join('') + '</div>' +
        '<div class="field" data-other hidden><label class="label" for="rj-text">' + esc(t('own.reason.other')) + '</label><textarea id="rj-text" class="input" rows="2" maxlength="140" placeholder="' + esc(t('own.reasonPlaceholder')) + '"></textarea></div>' +
        '<button type="submit" class="btn btn-danger btn-block btn-lg">' + esc(t('own.reject')) + '</button></form>',
      onMount(panel, sheet) {
        const f = panel.querySelector('[data-f]');
        f.addEventListener('change', () => { panel.querySelector('[data-other]').hidden = f.reason.value !== 'other'; });
        f.addEventListener('submit', (e) => {
          e.preventDefault();
          const r = f.reason.value;
          let reason = t('own.reason.' + r);
          if (r === 'other') { const tx = panel.querySelector('#rj-text').value.trim(); if (tx) reason = tx; }
          else { const ar = H.STR['own.reason.' + r]; reason = ar[0] + ' / ' + ar[1]; }
          sheet.close(true);
          if (H.ownerAction(id, 'reject', reason) && onDone) onDone();
        });
      }
    });
  };

  /* ---------- 4.2 Owner select ---------- */
  H.route('/owner/select', {
    auth: true,
    render(ctx) {
      const all = S.businesses();
      ctx.el.innerHTML = '<main>' + H.appbar({ title: t('own.selectTitle'), back: '#/profile' }) + '<div class="pad"><p class="info-strip">🧪 ' + esc(t('own.selectNote')) + '</p>' +
        H.SEED.emirates.map((em) => {
          const list = all.filter((b) => b.emirate === em);
          if (!list.length) return '';
          return '<h2 class="h3 mt">' + esc(t('em.' + em)) + '</h2><ul class="list">' + list.map((b) => '<li class="card biz-row">' +
            '<span class="biz-row-main">' + H.bizLogo(b, 'logo-56') + '<span class="biz-row-text"><span class="biz-row-name" dir="auto">' + esc(H.L(b, 'name')) + '</span><span class="meta">' + H.ratingCompact(b) + ' · <span dir="auto">' + esc(H.L(b, 'owner')) + '</span> · ' + esc(H.L(b, 'area')) + '</span></span></span>' +
            '<button type="button" class="btn btn-secondary btn-sm" data-manage="' + esc(b.id) + '">' + esc(t('own.manage')) + '</button></li>').join('') + '</ul>';
        }).join('') + '</div></main>';
      ctx.el.querySelector('main').addEventListener('click', (e) => {
        const m = e.target.closest('[data-manage]');
        if (!m) return;
        const b = S.business(m.dataset.manage);
        S.setPrefs({ ownerMode: true, ownerBusinessId: b.id });
        H.toast(t('own.welcome', { name: H.L(b, 'owner') }), { type: 'success' });
        H.go('#/owner/dashboard', { replace: true });
      });
    }
  });

  /* ---------- 4.3 Dashboard ---------- */
  const counted = (o) => o.status !== 'rejected' && o.status !== 'cancelled';
  function dayStats(orders, date) {
    const list = orders.filter((o) => counted(o) && U.sameDay(o.createdAt, date));
    return { n: list.length, rev: U.round2(list.reduce((s, o) => s + o.total, 0)) };
  }
  function ownerOrderRow(o) {
    const items = o.lines.map((l) => l.qty + '× ' + H.lineName(l)).join(H.lang() === 'ar' ? '، ' : ', ');
    return '<li><a class="card order-row" href="#/owner/orders/' + esc(o.id) + '"><div class="oc-head"><bdi dir="ltr" class="strong">#' + esc(o.id) + '</bdi><span class="grow"></span>' + H.statusBadge(o) + '</div>' +
      '<p class="meta">' + esc(H.customerName(o.customer)) + ' · ' + esc(U.dateTime(o.createdAt)) + '</p><p class="oc-items" dir="auto">' + esc(items) + '</p><div class="oc-foot">' + U.price(o.total) + '</div></a></li>';
  }
  H.route('/owner/dashboard', {
    auth: true, owner: true, tabbar: 'owner', live: true,
    skeleton() { return '<main><div class="owner-bar">' + H.skel('skel-line w60') + '</div><div class="pad"><div class="stat-grid">' + [1, 2, 3, 4].map(() => H.skel('skel-stat')).join('') + '</div>' + H.skel('skel-chart') + '</div></main>'; },
    onTick(ctx) {
      const b = H.ownerBiz(); if (!b) return;
      const sig = S.orders().filter((o) => o.businessId === b.id).map((o) => o.id + o.status).join();
      if (ctx.sig !== undefined && ctx.sig !== sig) H.rerender();
    },
    render(ctx) {
      const b = H.ownerBiz();
      const orders = S.orders().filter((o) => o.businessId === b.id);
      ctx.sig = orders.map((o) => o.id + o.status).join();
      const now = new Date();
      const td = dayStats(orders, now); const yd = dayStats(orders, U.addDays(now, -1));
      const dn = td.n - yd.n;
      const deltaN = dn > 0 ? '<span class="delta up">▲<bdi>' + dn + '</bdi> ' + esc(t('own.vsYesterday')) + '</span>' : dn < 0 ? '<span class="delta down">▼<bdi>' + (-dn) + '</bdi> ' + esc(t('own.vsYesterday')) + '</span>' : '<span class="delta">— ' + esc(t('own.vsYesterday')) + '</span>';
      let deltaR = '';
      if (yd.rev > 0) { const pc = Math.round(((td.rev - yd.rev) / yd.rev) * 100); deltaR = pc > 0 ? '<span class="delta up">▲ <bdi>' + pc + '%</bdi></span>' : pc < 0 ? '<span class="delta down">▼ <bdi>' + (-pc) + '%</bdi></span>' : '<span class="delta">—</span>'; }
      const pending = orders.filter((o) => o.status === 'received').length;
      // last 7 days, oldest first
      const days = []; for (let i = 6; i >= 0; i--) { const d = U.addDays(now, -i); days.push({ d, v: dayStats(orders, d).rev }); }
      const max = Math.max.apply(null, days.map((x) => x.v));
      const shortDays = H.DAY_SHORT[H.lang()];
      const aria = t('own.sales7Aria', { list: days.map((x) => U.dayName(x.d) + ' ' + U.fmtPrice(x.v)).join(H.lang() === 'ar' ? '، ' : ', ') });
      const chart = max > 0
        ? '<div class="chart" role="img" aria-label="' + esc(aria) + '">' + days.map((x, i) => '<div class="bar-col"><span class="bar-val"><bdi>' + esc(U.num(Math.round(x.v))) + '</bdi></span><span class="bar' + (i === 6 ? ' today' : '') + '" style="--v:' + x.v + ';--max:' + max + ';--i:' + i + '"></span><span class="bar-day">' + esc(shortDays[U.satIndex(x.d)]) + '</span></div>').join('') + '</div>'
        : '<div class="chart empty-chart" role="img" aria-label="' + esc(t('own.noData')) + '"><span>' + esc(t('own.noData')) + '</span></div>';
      // best sellers 30 days
      const since = now.getTime() - 30 * U.DAY;
      const agg = {};
      orders.filter((o) => counted(o) && new Date(o.createdAt).getTime() >= since).forEach((o) => o.lines.forEach((l) => {
        const a = agg[l.productId] || (agg[l.productId] = { qty: 0, rev: 0, l });
        a.qty += l.qty; a.rev += l.lineTotal;
      }));
      const best = Object.keys(agg).map((k) => agg[k]).sort((a, c) => c.qty - a.qty || c.rev - a.rev).slice(0, 3);
      const recent = orders.slice().sort((a, c) => new Date(c.createdAt) - new Date(a.createdAt)).slice(0, 3);
      const g = U.greetingKey();
      ctx.el.innerHTML = '<main>' + H.ownerBar(b, t('owner.nav.dashboard')) + '<div class="pad">' +
        '<p class="h2">' + esc(t('own.greeting', { greeting: t(g[0]), name: H.L(b, 'owner') })) + ' <span aria-hidden="true">' + g[1] + '</span></p>' +
        '<div class="stat-grid">' +
        '<div class="card stat"><span class="stat-label">' + esc(t('own.todayOrders')) + '</span><span class="stat-val"><bdi>' + td.n + '</bdi></span>' + deltaN + '</div>' +
        '<div class="card stat"><span class="stat-label">' + esc(t('own.todayRevenue')) + '</span><span class="stat-val">' + U.price(td.rev) + '</span>' + deltaR + '</div>' +
        '<a class="card stat" href="#/owner/orders?tab=new"><span class="stat-label">' + esc(t('own.pending')) + '</span><span class="stat-val"><bdi>' + pending + '</bdi> ' + H.icon('chevron', 'sm') + '</span></a>' +
        '<div class="card stat"><span class="stat-label">' + esc(t('own.rating')) + '</span><span class="stat-val"><span aria-hidden="true">⭐</span> <bdi>' + esc(Number(b.rating).toFixed(1)) + '</bdi></span><span class="delta">' + esc(t('biz.reviewsCount', { n: b.reviewCount })) + '</span></div></div>' +
        '<section class="sec-block"><h2 class="h3">' + esc(t('own.sales7')) + '</h2><div class="card">' + chart + '</div></section>' +
        '<section class="sec-block"><h2 class="h3">' + esc(t('own.bestSellers')) + '</h2>' + (best.length ? '<ol class="card best">' + best.map((x, i) => '<li><bdi>' + (i + 1) + '.</bdi> <span aria-hidden="true">' + esc(x.l.emoji) + '</span> <span class="grow" dir="auto">' + esc(H.lineName(x.l)) + '</span><bdi class="muted" dir="ltr">×' + x.qty + '</bdi>' + U.price(x.rev) + '</li>').join('') + '</ol>' : '<p class="card muted">' + esc(t('own.noSales')) + '</p>') + '</section>' +
        '<section class="sec-block"><div class="sec-head"><h2 class="h3">' + esc(t('own.recentOrders')) + '</h2><a class="link" href="#/owner/orders">' + esc(t('common.seeAll')) + '</a></div>' +
        (recent.length ? '<ul class="list">' + recent.map(ownerOrderRow).join('') + '</ul>' : '<p class="card muted">' + esc(t('own.noData')) + '</p>') + '</section></div></main>';
    }
  });

  /* ---------- 4.4 Incoming orders ---------- */
  const TABS = { new: ['received'], progress: ['preparing'], ready: ['ready'], done: ['completed', 'rejected', 'cancelled'] };
  const TAB_EMPTY = { new: ['📭', 'own.empty.new'], progress: ['🍳', 'own.empty.progress'], ready: ['📦', 'own.empty.ready'], done: ['🗂️', 'own.empty.done'] };
  let ownerTab = 'new';
  let knownIds = null;
  const sinceTxt = (o) => { const s = Math.max(0, Math.floor((Date.now() - new Date(o.createdAt).getTime()) / 1000)); const m = Math.floor(s / 60); return m >= 60 ? Math.floor(m / 60) + ':' + U.pad(m % 60) + ':' + U.pad(s % 60) : m + ':' + U.pad(s % 60); };
  function actionButtons(o) {
    if (o.status === 'received') return '<button type="button" class="btn btn-danger-outline" data-act-o="reject" data-id="' + esc(o.id) + '">' + esc(t('own.reject')) + '</button><button type="button" class="btn btn-primary" data-act-o="accept" data-id="' + esc(o.id) + '">' + esc(t('own.accept')) + ' ✓</button>';
    if (o.status === 'preparing') return '<button type="button" class="btn btn-primary" data-act-o="ready" data-id="' + esc(o.id) + '">' + esc(t('own.markReady')) + '</button>';
    if (o.status === 'ready') return '<button type="button" class="btn btn-primary" data-act-o="complete" data-id="' + esc(o.id) + '">' + esc(t(o.fulfilment === 'delivery' ? 'own.markDelivered' : 'own.markPicked')) + '</button>';
    return '';
  }
  function incomingCard(o, flash) {
    const sched = o.slot && o.slot.type === 'scheduled';
    return '<li class="card in-card' + (flash ? ' flash' : '') + '" data-card="' + esc(o.id) + '"><div class="oc-head"><a href="#/owner/orders/' + esc(o.id) + '" class="strong"><bdi dir="ltr">#' + esc(o.id) + '</bdi></a> · ' + (o.fulfilment === 'delivery' ? '🛵 ' + esc(t('cart.delivery')) : '🏃 ' + esc(t('cart.pickup'))) +
      '<span class="grow"></span>' + (S.STATUS_ACTIVE.indexOf(o.status) >= 0 ? '<span class="timer" aria-label="' + esc(t('own.timerLabel')) + '">⏱ <bdi data-since="' + esc(o.createdAt) + '">' + sinceTxt(o) + '</bdi></span>' : H.statusBadge(o)) + '</div>' +
      '<p class="meta">' + esc(H.customerName(o.customer)) + ' · ' + (sched ? '<span class="badge badge-info">' + esc(t('ord.scheduled')) + '</span> ' + esc(H.slotText(o)) : esc(U.dateTime(o.createdAt))) + '</p>' +
      '<ul class="in-lines">' + o.lines.map((l) => '<li><bdi dir="ltr">' + l.qty + '×</bdi> <span dir="auto">' + esc(H.lineName(l)) + '</span>' + (H.lineOpts(l) ? ' <span class="muted">(' + esc(H.lineOpts(l)) + ')</span>' : '') + (l.notes ? ' · <span class="line-notes">"' + esc(l.notes) + '"</span>' : '') + '</li>').join('') + '</ul>' +
      (o.address ? '<p class="meta">📍 ' + esc(H.addrText(o.address)) + '</p>' : '') +
      (o.rejectReason && o.status === 'rejected' ? '<p class="meta">' + esc(t('trk.reason', { reason: o.rejectReason })) + '</p>' : '') +
      '<div class="oc-foot"><span>' + esc(H.payText(o.payment)) + '</span><span class="grow"></span>' + U.price(o.total) + '</div>' +
      (actionButtons(o) ? '<div class="in-actions">' + actionButtons(o) + '</div>' : '') + '</li>';
  }
  function runAction(btn, ctx) {
    const id = btn.dataset.id; const act = btn.dataset.actO;
    const card = btn.closest('[data-card]');
    const after = () => {
      if (card && !U.reduced() && ctx.path === '/owner/orders') { card.classList.add('leaving'); setTimeout(() => H.rerender(), 260); } else H.rerender();
    };
    if (act === 'reject') { H.rejectSheet(id, after); return; }
    if (H.ownerAction(id, act)) after();
  }
  H.route('/owner/orders', {
    auth: true, owner: true, tabbar: 'owner', live: true,
    onTick(ctx) {
      ctx.el.querySelectorAll('[data-since]').forEach((el) => { el.textContent = sinceTxt({ createdAt: el.dataset.since }); });
      const b = H.ownerBiz(); if (!b) return;
      const sig = S.orders().filter((o) => o.businessId === b.id).map((o) => o.id + o.status).join();
      if (ctx.sig !== undefined && ctx.sig !== sig && !ctx.el.querySelector('.leaving')) H.rerender();
    },
    render(ctx) {
      if (ctx.query.tab && TABS[ctx.query.tab]) { ownerTab = ctx.query.tab; try { history.replaceState(null, '', '#/owner/orders'); } catch (e) { /* ignore */ } ctx.query = {}; }
      const b = H.ownerBiz();
      const mine = S.orders().filter((o) => o.businessId === b.id);
      ctx.sig = mine.map((o) => o.id + o.status).join();
      const cutoff = Date.now() - 30 * U.DAY;
      const byTab = {};
      Object.keys(TABS).forEach((k) => { byTab[k] = mine.filter((o) => TABS[k].indexOf(o.status) >= 0 && (k !== 'done' || new Date(o.createdAt).getTime() >= cutoff)); });
      byTab.new.sort((a, c) => new Date(a.createdAt) - new Date(c.createdAt));
      ['progress', 'ready', 'done'].forEach((k) => byTab[k].sort((a, c) => new Date(c.createdAt) - new Date(a.createdAt)));
      const ids = mine.map((o) => o.id);
      const fresh = knownIds && knownIds.bid === b.id ? ids.filter((id) => knownIds.ids.indexOf(id) < 0) : [];
      knownIds = { bid: b.id, ids };
      const list = byTab[ownerTab];
      const em = TAB_EMPTY[ownerTab];
      ctx.el.innerHTML = '<main>' + H.ownerBar(b, t('owner.nav.orders')) + '<div class="pad">' +
        '<div class="seg seg-4" role="tablist" aria-label="' + esc(t('owner.nav.orders')) + '">' + Object.keys(TABS).map((k) => '<button type="button" role="tab" class="seg-btn" aria-selected="' + (k === ownerTab) + '" data-otab="' + k + '">' + esc(t('own.tab.' + k)) + (k !== 'done' ? ' <bdi class="seg-count">' + byTab[k].length + '</bdi>' : '') + '</button>').join('') + '</div>' +
        '<div role="tabpanel">' + (list.length ? '<ul class="list">' + list.map((o) => incomingCard(o, fresh.indexOf(o.id) >= 0)).join('') + '</ul>' : H.empty({ emoji: em[0], title: t(em[1]) })) + '</div></div></main>';
      const main = ctx.el.querySelector('main');
      main.addEventListener('click', (e) => {
        const tb = e.target.closest('[data-otab]');
        if (tb) { ownerTab = tb.dataset.otab; H.rerender(); const a = ctx.el.querySelector('[data-otab="' + ownerTab + '"]'); if (a) a.focus(); return; }
        const ab = e.target.closest('[data-act-o]');
        if (ab) runAction(ab, ctx);
      });
    }
  });

  /* ---------- Owner order detail ---------- */
  H.route('/owner/orders/:orderId', {
    auth: true, owner: true, live: true,
    onTick(ctx) {
      ctx.el.querySelectorAll('[data-since]').forEach((el) => { el.textContent = sinceTxt({ createdAt: el.dataset.since }); });
      const o = S.order(ctx.params.orderId);
      const sig = o ? o.status : 'x';
      if (ctx.sig !== undefined && ctx.sig !== sig) H.rerender();
    },
    render(ctx) {
      const o = S.order(ctx.params.orderId);
      const b = H.ownerBiz();
      ctx.sig = o ? o.status : 'x';
      if (!o || o.businessId !== b.id) { H.notFound(ctx, '🧾', 'trk.notFound'); return; }
      ctx.el.innerHTML = '<main>' + H.appbar({ title: t('own.orderDetail'), back: '#/owner/orders', actions: '<bdi dir="ltr" class="muted order-id">#' + esc(o.id) + '</bdi>' }) + '<div class="pad">' +
        '<div class="card"><div class="oc-head"><strong>' + esc(t('own.customer')) + '</strong><span class="grow"></span>' + H.statusBadge(o) + '</div>' +
        '<p>' + esc(H.customerName(o.customer)) + '</p><p class="meta"><bdi dir="ltr">' + esc(U.maskPhone(o.customer.phone)) + '</bdi></p>' +
        '<p class="meta">' + (o.fulfilment === 'delivery' ? '🛵 ' + esc(t('cart.delivery')) : '🏃 ' + esc(t('cart.pickup'))) + ' · ' + esc(H.slotText(o)) + ' · ' + esc(t('trk.eta', { time: U.fmtTime(o.etaAt) })) + '</p>' +
        (o.address ? '<p class="meta">📍 ' + esc(t('em.' + o.address.emirate)) + ' · ' + esc(H.addrText(o.address)) + (o.address.notes ? ' · "' + esc(o.address.notes) + '"' : '') + '</p>' : '') +
        '<p class="meta">' + esc(H.payText(o.payment)) + '</p>' +
        (S.STATUS_ACTIVE.indexOf(o.status) >= 0 ? '<p class="timer">⏱ <bdi data-since="' + esc(o.createdAt) + '">' + sinceTxt(o) + '</bdi></p>' : '') + '</div>' +
        '<section class="sec-block"><h2 class="h3">' + esc(t('own.items')) + '</h2><div class="card"><ul class="sum-lines">' + o.lines.map((l) => '<li><span><bdi dir="ltr">' + l.qty + '×</bdi> <span aria-hidden="true">' + esc(l.emoji) + '</span> ' + esc(H.lineName(l)) + (H.lineOpts(l) ? '<span class="line-opts">' + esc(H.lineOpts(l)) + '</span>' : '') + (l.notes ? '<span class="line-notes">"' + esc(l.notes) + '"</span>' : '') + '</span>' + U.price(l.lineTotal) + '</li>').join('') + '</ul>' +
        '<dl class="totals"><div><dt>' + esc(t('cart.subtotal')) + '</dt><dd>' + U.price(o.subtotal) + '</dd></div>' + (o.fulfilment === 'delivery' ? '<div><dt>' + esc(t('cart.deliveryFee')) + '</dt><dd>' + U.price(o.deliveryFee) + '</dd></div>' : '') +
        (o.discount ? '<div class="disc"><dt>' + esc(t('cart.discount', { code: o.promo })) + '</dt><dd>' + U.minus(o.discount) + '</dd></div>' : '') + '<div class="grand"><dt>' + esc(t('cart.total')) + '</dt><dd>' + U.price(o.total) + '</dd></div></dl></div></section>' +
        '<section class="sec-block"><h2 class="h3">' + esc(t('own.history')) + '</h2><ol class="card timeline">' + (o.history || []).map((h) => '<li><span class="vdot done" aria-hidden="true">✓</span><span class="grow">' + esc(H.statusLabel(o, h.status)) + '</span><bdi class="muted">' + esc(U.dateTime(h.at)) + '</bdi></li>').join('') + '</ol>' +
        (o.rejectReason ? '<p class="info-strip">' + esc(t('trk.reason', { reason: o.rejectReason })) + '</p>' : '') + '</section>' +
        (actionButtons(o) ? '<div class="in-actions">' + actionButtons(o) + '</div>' : '') + '</div></main>';
      ctx.el.querySelector('main').addEventListener('click', (e) => { const ab = e.target.closest('[data-act-o]'); if (ab) runAction(ab, ctx); });
    }
  });
})();
