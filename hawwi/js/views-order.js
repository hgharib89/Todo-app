/* Hawwi views: cart, checkout, order placed, tracking */
(function () {
  'use strict';
  const H = window.H;
  const U = H.U;
  const S = H.S;
  const esc = U.esc;
  const t = (k, v) => H.t(k, v);

  /* ---------- slot resolution ---------- */
  function resolveSlot(biz, cart) {
    const asapOk = U.asapAvailable(biz);
    const today = U.slots(biz, 0);
    const tom = U.slots(biz, 1);
    const sched = (s, day) => ({ type: 'scheduled', day, start: s.start, date: s.date, at: s.at });
    let slot = cart.slot || { type: 'asap' };
    let valid;
    if (slot.type === 'asap') valid = asapOk;
    else { const list = slot.day === 'today' ? today : tom; const m = list.find((s) => s.start === slot.start && s.date === slot.date); valid = !!m; if (m) slot = sched(m, slot.day); }
    if (!valid) slot = asapOk ? { type: 'asap' } : today[0] ? sched(today[0], 'today') : tom[0] ? sched(tom[0], 'tomorrow') : null;
    return { slot, asapOk, today, tom, sched };
  }
  H.resolveSlot = resolveSlot;

  function lineOptsHtml(product, line) {
    const lbl = S.optionLabels(product, line.options, line.addons)[H.lang()];
    return (lbl.length ? '<span class="line-opts" dir="auto">' + esc(lbl.join('، ')) + '</span>' : '') + (line.notes ? '<span class="line-notes" dir="auto">"' + esc(line.notes) + '"</span>' : '');
  }

  function totalsHtml(cc) {
    return '<dl class="totals"><div><dt>' + esc(t('cart.subtotal')) + '</dt><dd>' + U.price(cc.subtotal) + '</dd></div>' +
      (cc.cart.fulfilment === 'delivery' ? '<div><dt>' + esc(t('cart.deliveryFee')) + '</dt><dd>' + (cc.cart.promo === 'FREEDEL' ? '<s>' + U.price(cc.biz.deliveryFee) + '</s> ' + esc(t('biz.freeDelivery')) : U.price(cc.deliveryFee)) + '</dd></div>' : '') +
      (cc.discount > 0 ? '<div class="disc"><dt>' + esc(t('cart.discount', { code: cc.cart.promo })) + '</dt><dd>' + U.minus(cc.discount) + '</dd></div>' : '') +
      '<div class="grand"><dt>' + esc(t('cart.total')) + '</dt><dd>' + U.price(cc.total) + '</dd></div></dl>' +
      '<p class="vat muted">' + esc(t('cart.vatNote')) + '</p>';
  }
  H.totalsHtml = totalsHtml;

  /* ---------- 3.10 Cart ---------- */
  let lastRemoved = null;
  let viewDay = null;
  H.route('/cart', {
    tabbar: 'customer',
    cls: 'has-footer-tab',
    onTick(ctx) {
      // refresh slots when the minute changes
      const m = new Date().getMinutes();
      const typing = document.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
      if (ctx.minute !== undefined && ctx.minute !== m && !typing && !document.querySelector('.overlay')) H.rerender();
      ctx.minute = m;
    },
    render(ctx) {
      const cc = S.computeCart();
      if (cc.removed.length) H.toast(t('cart.unavailableItems'), { type: 'error' });
      if (cc.promoRemoved) H.toast(t('cart.promoRemoved'));
      if (!cc.lines.length || !cc.biz) {
        ctx.el.innerHTML = '<main>' + H.appbar({ title: t('cart.title') }) + H.empty({ emoji: '🛍️', title: t('cart.empty'), body: t('cart.emptyHint'), btn: { href: '#/home', label: t('cart.browse') } }) + '</main>';
        return;
      }
      const biz = cc.biz;
      const cart = cc.cart;
      const rs = resolveSlot(biz, cart);
      if (JSON.stringify(rs.slot) !== JSON.stringify(cart.slot) && rs.slot) { cart.slot = rs.slot; S.saveCart(cart); }
      const slot = rs.slot;
      if (!viewDay || (viewDay === 'today' && !rs.today.length)) viewDay = slot && slot.type === 'scheduled' ? slot.day : (rs.today.length ? 'today' : 'tomorrow');
      if (slot && slot.type === 'scheduled') viewDay = slot.day;
      const paused = biz.acceptingOrders === false;
      const closedBoth = !rs.asapOk && !rs.today.length && !rs.tom.length;
      const minFail = cart.fulfilment === 'delivery' && cc.subtotal < (biz.minOrder || 0);
      const blocked = paused || closedBoth || minFail || !slot;
      const asapMins = (biz.prep || 0) + (cart.fulfilment === 'delivery' ? 15 : 0);
      const daySlots = viewDay === 'today' ? rs.today : rs.tom;

      let ful;
      if (biz.pickup && biz.delivery) {
        ful = H.seg('ful', [
          { value: 'pickup', html: '🏃 ' + esc(t('cart.pickup')) },
          { value: 'delivery', html: '🛵 ' + esc(t('cart.delivery')) + (biz.deliveryFee > 0 ? ' <bdi>+' + esc(U.num(biz.deliveryFee)) + '</bdi>' : '') }
        ], cart.fulfilment, t('cart.fulfilment'));
      } else {
        ful = '<p class="info-row">' + (biz.pickup ? '🏃 ' + esc(t('cart.onlyPickup')) : '🛵 ' + esc(t('cart.onlyDelivery'))) + '</p>';
      }

      let timeHtml;
      if (paused) timeHtml = '<p class="info-strip danger">⏸️ ' + esc(t('cart.paused')) + '</p>';
      else if (closedBoth) timeHtml = '<p class="info-strip danger">🌙 ' + esc(t('cart.closedBoth')) + '</p>';
      else {
        timeHtml = '<div class="radio-list" role="radiogroup" aria-label="' + esc(t('cart.time')) + '">' +
          '<label class="radio-row' + (rs.asapOk ? '' : ' disabled') + '"><input type="radio" name="when" value="asap"' + (slot.type === 'asap' ? ' checked' : '') + (rs.asapOk ? '' : ' disabled') + '><span>⚡ ' + esc(t('cart.asap', { n: asapMins })) + '</span></label>' +
          '<label class="radio-row"><input type="radio" name="when" value="scheduled"' + (slot.type === 'scheduled' ? ' checked' : '') + '><span>🗓️ ' + esc(t('cart.schedule')) + '</span></label></div>' +
          (slot.type === 'scheduled' ? '<div class="sched">' + H.seg('day', [
            { value: 'today', html: esc(t('biz.today')), disabled: !rs.today.length, title: rs.today.length ? '' : t('cart.noSlotsToday') },
            { value: 'tomorrow', html: esc(t('biz.tomorrow')), disabled: !rs.tom.length, title: rs.tom.length ? '' : t('biz.closed') }
          ], viewDay, t('cart.schedule')) +
          (!rs.today.length ? '<p class="helper">' + esc(t('cart.noSlotsToday')) + '</p>' : '') +
          '<div class="chip-wrap slots" role="radiogroup" aria-label="' + esc(t('cart.time')) + '">' + daySlots.map((s) => {
            const on = slot.type === 'scheduled' && slot.start === s.start && slot.date === s.date;
            return '<button type="button" role="radio" class="chip' + (on ? ' on' : '') + '" aria-checked="' + on + '" data-slot="' + s.start + '" data-date="' + s.date + '"><bdi>' + esc(U.fmtTimeStr(s.start)) + '</bdi></button>';
          }).join('') + '</div></div>' : '');
      }

      const promoHtml = cart.promo
        ? '<div class="promo-chip"><span>🏷️ <bdi dir="ltr">' + esc(cart.promo) + '</bdi> ✓</span><button type="button" class="icon-btn sm" data-promo-remove aria-label="' + esc(t('cart.removePromo')) + '">' + H.icon('close') + '</button></div>'
        : '<form class="promo-form" data-promo novalidate><label class="sr-only" for="promo">' + esc(t('cart.promoPlaceholder')) + '</label><span aria-hidden="true">🏷️</span>' +
          '<input id="promo" class="input" dir="ltr" autocapitalize="characters" autocomplete="off" placeholder="' + esc(t('cart.promoPlaceholder')) + '" aria-describedby="promo-err">' +
          '<button type="submit" class="btn btn-secondary">' + esc(t('cart.apply')) + '</button></form><p class="err" id="promo-err" hidden></p>';

      ctx.el.innerHTML = '<main class="cart">' + H.appbar({ title: t('cart.title'), actions: '<button type="button" class="btn btn-ghost" data-clear>' + esc(t('cart.clear')) + '</button>' }) +
        '<div class="pad"><a class="card biz-link" href="#/business/' + esc(biz.id) + '">' + H.bizLogo(biz, 'logo-40') + '<span class="grow" dir="auto"><strong>' + esc(H.L(biz, 'name')) + '</strong><span class="meta">' + U.openBadge(biz) + '</span></span>' + H.icon('chevron') + '</a>' +
        '<ul class="lines">' + cc.lines.map((x) => '<li class="line" data-line="' + esc(x.line.lineId) + '">' + H.prodTile(x.product, 'tile-48') +
          '<div class="grow"><span class="line-name" dir="auto">' + esc(H.L(x.product, 'name')) + '</span>' + lineOptsHtml(x.product, x.line) +
          '<div class="line-foot">' + U.price(x.total) + '<span class="grow"></span>' + H.stepper(x.line.qty, { min: 0, max: 20 }) +
          '<button type="button" class="icon-btn" data-trash aria-label="' + esc(t('cart.removeLine', { name: H.L(x.product, 'name') })) + '">' + H.icon('trash') + '</button></div></div></li>').join('') + '</ul>' +
        '<section class="sec-block"><h2 class="h3">' + esc(t('cart.fulfilment')) + '</h2>' + ful +
        (minFail ? '<p class="info-strip warning">' + esc(t('cart.minDelivery', { amount: U.fmtPrice(biz.minOrder) })) + '</p>' : '') + '</section>' +
        '<section class="sec-block"><h2 class="h3">' + esc(t('cart.time')) + '</h2>' + timeHtml + '</section>' +
        '<section class="sec-block">' + promoHtml + '</section>' +
        '<section class="sec-block">' + totalsHtml(cc) + '</section></div>' +
        '<div class="footer-bar"><button type="button" class="btn btn-primary btn-lg btn-block split" data-checkout' + (blocked ? ' disabled aria-disabled="true"' : '') + '><span>' + esc(t('cart.checkout')) + '</span>' + U.price(cc.total) + '</button></div></main>';

      const main = ctx.el.querySelector('main');
      const setLineQty = (lineId, qty) => {
        const c = S.cart();
        const i = c.lines.findIndex((l) => l.lineId === lineId);
        if (i < 0) return;
        if (qty <= 0) {
          const removed = c.lines.splice(i, 1)[0];
          const bid = c.businessId; const promo = c.promo;
          lastRemoved = { line: removed, index: i, bid, promo };
          S.saveCart(c);
          const p = S.product(removed.productId);
          H.toast(t('cart.removed', { product: p ? H.L(p, 'name') : '' }), { action: { label: t('common.undo'), fn: () => {
            if (!lastRemoved) return;
            const c2 = S.cart();
            if (c2.businessId && c2.businessId !== lastRemoved.bid) return;
            c2.businessId = lastRemoved.bid;
            c2.lines.splice(Math.min(lastRemoved.index, c2.lines.length), 0, lastRemoved.line);
            if (!c2.promo && lastRemoved.promo) c2.promo = lastRemoved.promo;
            S.saveCart(c2); lastRemoved = null; H.updateTabbar(); if (H.current().path === '/cart') H.rerender();
          } } });
        } else c.lines[i].qty = Math.min(20, qty);
        S.saveCart(c);
        H.updateTabbar();
        H.rerender();
      };
      main.addEventListener('click', async (e) => {
        const step = e.target.closest('[data-step]');
        if (step && !step.disabled) {
          const li = step.closest('[data-line]');
          const l = S.cart().lines.find((x) => x.lineId === li.dataset.line);
          if (l) setLineQty(l.lineId, l.qty + Number(step.dataset.step));
          return;
        }
        const tr = e.target.closest('[data-trash]');
        if (tr) { setLineQty(tr.closest('[data-line]').dataset.line, 0); return; }
        const segBtn = e.target.closest('[data-seg] [data-value]');
        if (segBtn && !segBtn.disabled) {
          const name = segBtn.closest('[data-seg]').dataset.seg;
          const c = S.cart();
          if (name === 'ful') { c.fulfilment = segBtn.dataset.value; S.saveCart(c); }
          if (name === 'day') {
            viewDay = segBtn.dataset.value;
            const list = viewDay === 'today' ? rs.today : rs.tom;
            if (list[0]) { c.slot = rs.sched(list[0], viewDay); S.saveCart(c); }
          }
          H.rerender();
          const again = ctx.el.querySelector('[data-seg="' + name + '"] [data-value="' + segBtn.dataset.value + '"]'); if (again) again.focus();
          return;
        }
        const sl = e.target.closest('[data-slot]');
        if (sl) {
          const list = viewDay === 'today' ? rs.today : rs.tom;
          const s = list.find((x) => x.start === sl.dataset.slot && x.date === sl.dataset.date);
          if (s) { const c = S.cart(); c.slot = rs.sched(s, viewDay); S.saveCart(c); H.rerender(); const again = ctx.el.querySelector('[data-slot="' + s.start + '"][data-date="' + s.date + '"]'); if (again) again.focus(); }
          return;
        }
        if (e.target.closest('[data-promo-remove]')) { const c = S.cart(); c.promo = null; S.saveCart(c); H.rerender(); return; }
        if (e.target.closest('[data-clear]')) {
          if (await H.confirm({ title: t('cart.clearConfirm'), ok: t('cart.clear'), danger: true })) { S.clearCart(); H.updateTabbar(); H.rerender(); }
          return;
        }
        if (e.target.closest('[data-checkout]')) {
          if (blocked) return;
          H.go('#/checkout');
        }
      });
      main.addEventListener('change', (e) => {
        if (e.target.name === 'when') {
          const c = S.cart();
          if (e.target.value === 'asap') c.slot = { type: 'asap' };
          else { const list = rs.today.length ? rs.today : rs.tom; viewDay = rs.today.length ? 'today' : 'tomorrow'; if (list[0]) c.slot = rs.sched(list[0], viewDay); }
          S.saveCart(c); H.rerender();
          const again = ctx.el.querySelector('input[name="when"][value="' + e.target.value + '"]'); if (again) again.focus();
        }
      });
      const pf = ctx.el.querySelector('[data-promo]');
      if (pf) {
        const inp = pf.querySelector('#promo');
        inp.addEventListener('input', () => { const p = inp.selectionStart; inp.value = inp.value.toUpperCase(); try { inp.setSelectionRange(p, p); } catch (x) { /* ignore */ } });
        pf.addEventListener('submit', (e) => {
          e.preventDefault();
          const chk = S.checkPromo(inp.value, cc.subtotal, S.cart().fulfilment);
          const err = ctx.el.querySelector('#promo-err');
          if (!chk.ok) { err.hidden = false; err.textContent = chk.err; inp.setAttribute('aria-invalid', 'true'); inp.focus(); return; }
          const c = S.cart(); c.promo = chk.code; S.saveCart(c);
          H.toast(t('cart.promoApplied'), { type: 'success' });
          H.rerender();
        });
      }
    }
  });

  /* ---------- 3.11 Checkout ---------- */
  const coState = { method: 'card', addrId: null, label: 'home', save: true, form: null };
  H.route('/checkout', {
    auth: true,
    cls: 'has-footer',
    render(ctx) {
      const cc = S.computeCart();
      if (!cc.lines.length || !cc.biz) { H.go('#/cart', { replace: true }); return; }
      const biz = cc.biz;
      const cart = cc.cart;
      const rs = resolveSlot(biz, cart);
      const minFail = cart.fulfilment === 'delivery' && cc.subtotal < (biz.minOrder || 0);
      if (!rs.slot || biz.acceptingOrders === false || minFail) { H.go('#/cart', { replace: true }); return; }
      const u = S.user();
      const isDel = cart.fulfilment === 'delivery';
      const cashOk = cc.total <= 500;
      if (!cashOk && coState.method === 'cash') coState.method = 'card';
      const slotText = rs.slot.type === 'asap' ? t('co.asap') + ' (~' + ((biz.prep || 0) + (isDel ? 15 : 0)) + ' ' + t('time.min') + ')' : U.dayLabel(new Date(rs.slot.at)) + ' ' + U.fmtTime(rs.slot.at);
      const addrs = u.addresses || [];
      let f = coState.form;
      if (!f) {
        const a0 = addrs[0];
        f = a0 ? Object.assign({}, a0) : { emirate: u.emirate || biz.emirate, area: '', street: '', unit: '', notes: '', label: 'home' };
        coState.addrId = a0 ? a0.id : null; coState.form = f;
      }
      const lbl = (k) => esc(t(k));
      const field = (id, key, label, opts) => '<div class="field' + (opts && opts.half ? ' half' : '') + '"><label class="label" for="' + id + '">' + lbl(label) + '</label>' +
        '<input id="' + id + '" class="input" data-k="' + key + '" value="' + esc(f[key] || '') + '"' + (opts && opts.req ? ' aria-required="true"' : '') + ' aria-describedby="' + id + '-err" maxlength="80"><p class="err" id="' + id + '-err" hidden>' + lbl('co.fieldRequired') + '</p></div>';
      const addrHtml = isDel
        ? '<section class="sec-block"><h2 class="h3">' + lbl('co.address') + '</h2><div class="chip-wrap">' +
          addrs.map((a) => '<button type="button" class="chip' + (coState.addrId === a.id ? ' on' : '') + '" aria-pressed="' + (coState.addrId === a.id) + '" data-addr="' + esc(a.id) + '">' + (a.label === 'work' ? '🏢 ' : a.label === 'other' ? '📍 ' : '🏠 ') + esc(t('co.label.' + a.label)) + (coState.addrId === a.id ? ' ✓' : '') + '</button>').join('') +
          '<button type="button" class="chip' + (!coState.addrId ? ' on' : '') + '" data-addr="">+ ' + lbl('co.newAddress') + '</button></div>' +
          '<div class="form-grid" data-addrform>' +
          '<div class="field half"><label class="label" for="a-em">' + lbl('signup.emirate') + '</label><select id="a-em" class="input" data-k="emirate">' + H.emirateOptions(f.emirate) + '</select></div>' +
          field('a-area', 'area', 'co.area', { req: true, half: true }) + field('a-street', 'street', 'co.street', { req: true }) +
          field('a-unit', 'unit', 'co.unit', { req: true, half: true }) +
          '<div class="field half"><label class="label" for="a-notes">' + lbl('co.addrNotes') + '</label><input id="a-notes" class="input" data-k="notes" maxlength="120" value="' + esc(f.notes || '') + '"></div>' +
          '<div class="field"><span class="label">' + lbl('co.label') + '</span><div class="chip-wrap" data-labels>' + ['home', 'work', 'other'].map((k) => '<button type="button" class="chip' + ((f.label || 'home') === k ? ' on' : '') + '" aria-pressed="' + ((f.label || 'home') === k) + '" data-label="' + k + '">' + lbl('co.label.' + k) + '</button>').join('') + '</div></div>' +
          '<label class="check-row"><input type="checkbox" data-save' + (coState.save ? ' checked' : '') + '> ' + lbl('co.saveAddress') + '</label>' +
          '<p class="info-strip warning" data-cross' + (f.emirate !== biz.emirate ? '' : ' hidden') + '>' + lbl('co.crossEmirate') + '</p></div></section>'
        : '<section class="sec-block"><div class="card pickup-card">' + H.bizLogo(biz, 'logo-40') + '<div><strong>' + esc(t('co.pickupFrom', { business: H.L(biz, 'name') })) + '</strong><p class="meta">📍 ' + esc(H.L(biz, 'area')) + (H.lang() === 'ar' ? '، ' : ', ') + esc(t('em.' + biz.emirate)) + '</p><p class="meta">' + lbl('co.pickupNote') + '</p></div></div></section>';
      const m = coState.method;
      const payHtml = '<section class="sec-block"><h2 class="h3">' + lbl('co.payment') + '</h2><div class="pay-list" role="radiogroup" aria-label="' + lbl('co.payment') + '">' +
        '<label class="pay-row' + (m === 'card' ? ' on' : '') + '"><input type="radio" name="pay" value="card"' + (m === 'card' ? ' checked' : '') + '><span>💳 ' + lbl('pay.card') + '</span><span class="brand" data-brand></span></label>' +
        (m === 'card' ? '<div class="card-form form-grid">' +
          '<div class="field"><label class="label" for="c-num">' + lbl('pay.cardNumber') + '</label><input id="c-num" class="input" dir="ltr" inputmode="numeric" autocomplete="cc-number" placeholder="4242 4242 4242 4242" maxlength="19" aria-describedby="c-num-err c-num-help" aria-required="true"><p class="helper" id="c-num-help">' + lbl('pay.testCard') + '</p><p class="err" id="c-num-err" hidden>' + lbl('pay.cardInvalid') + '</p></div>' +
          '<div class="field"><label class="label" for="c-name">' + lbl('pay.cardName') + '</label><input id="c-name" class="input" autocomplete="cc-name" aria-describedby="c-name-err" aria-required="true" value="' + esc(u.name) + '"><p class="err" id="c-name-err" hidden>' + lbl('pay.nameInvalid') + '</p></div>' +
          '<div class="field half"><label class="label" for="c-exp">' + lbl('pay.expiry') + '</label><input id="c-exp" class="input" dir="ltr" inputmode="numeric" autocomplete="cc-exp" placeholder="MM/YY" maxlength="5" aria-describedby="c-exp-err" aria-required="true"><p class="err" id="c-exp-err" hidden>' + lbl('pay.expiryInvalid') + '</p></div>' +
          '<div class="field half"><label class="label" for="c-cvv">' + lbl('pay.cvv') + '</label><input id="c-cvv" class="input" dir="ltr" type="password" inputmode="numeric" autocomplete="cc-csc" maxlength="3" aria-describedby="c-cvv-err" aria-required="true"><p class="err" id="c-cvv-err" hidden>' + lbl('pay.cvvInvalid') + '</p></div></div>' : '') +
        '<label class="pay-row apple' + (m === 'applepay' ? ' on' : '') + '"><input type="radio" name="pay" value="applepay"' + (m === 'applepay' ? ' checked' : '') + '><span class="apple-label" lang="en">Apple Pay</span></label>' +
        '<label class="pay-row' + (m === 'cash' ? ' on' : '') + (cashOk ? '' : ' disabled') + '"><input type="radio" name="pay" value="cash"' + (m === 'cash' ? ' checked' : '') + (cashOk ? '' : ' disabled') + '><span>💵 ' + lbl('pay.cashDesc') + '</span></label>' +
        (cashOk ? '' : '<p class="helper">' + lbl('pay.cashLimit') + '</p>') + '</div></section>';

      ctx.el.innerHTML = '<main class="checkout">' + H.appbar({ title: t('co.title'), back: '#/cart' }) + '<form class="pad" data-form novalidate>' +
        '<details class="card summary"><summary><span>' + esc(t('co.summary', { business: H.L(biz, 'name'), n: cc.count })) + '</span>' + H.icon('chevDown', 'sm chev') + '</summary>' +
        '<ul class="sum-lines">' + cc.lines.map((x) => '<li><span><bdi dir="ltr">' + x.line.qty + '×</bdi> <span dir="auto">' + esc(H.L(x.product, 'name')) + '</span>' + lineOptsHtml(x.product, x.line) + '</span>' + U.price(x.total) + '</li>').join('') + '</ul>' + totalsHtml(cc) + '</details>' +
        '<div class="card ful-line"><span>' + (isDel ? '🛵 ' + lbl('cart.delivery') : '🏃 ' + lbl('cart.pickup')) + ' · ' + esc(slotText) + '</span><a class="link" href="#/cart">' + lbl('common.edit') + '</a></div>' +
        addrHtml + payHtml +
        '<dl class="totals"><div class="grand"><dt>' + lbl('cart.total') + '</dt><dd>' + U.price(cc.total) + '</dd></div></dl></form>' +
        '<div class="footer-bar"><button type="button" class="btn btn-primary btn-lg btn-block split" data-place><span>' + lbl('co.placeOrder') + '</span>' + U.price(cc.total) + '</button></div></main>';

      const main = ctx.el.querySelector('main');
      const form = ctx.el.querySelector('[data-form]');
      // address form syncing
      form.addEventListener('input', (e) => {
        const k = e.target.dataset.k;
        if (k) f[k] = e.target.value;
        if (e.target.getAttribute('aria-invalid') === 'true' && e.target.value.trim()) { e.target.removeAttribute('aria-invalid'); const er = ctx.el.querySelector('#' + e.target.id + '-err'); if (er) er.hidden = true; }
      });
      form.addEventListener('change', (e) => {
        if (e.target.dataset.k === 'emirate') { f.emirate = e.target.value; const cr = ctx.el.querySelector('[data-cross]'); if (cr) cr.hidden = f.emirate === biz.emirate; }
        if (e.target.matches('[data-save]')) coState.save = e.target.checked;
        if (e.target.name === 'pay') { coState.method = e.target.value; H.rerender(); const r = ctx.el.querySelector('input[name="pay"][value="' + e.target.value + '"]'); if (r) r.focus(); }
      });
      form.addEventListener('click', (e) => {
        const a = e.target.closest('[data-addr]');
        if (a) {
          const id = a.dataset.addr;
          const found = addrs.find((x) => x.id === id);
          coState.addrId = found ? found.id : null;
          coState.form = found ? Object.assign({}, found) : { emirate: u.emirate || biz.emirate, area: '', street: '', unit: '', notes: '', label: 'home' };
          H.rerender(); return;
        }
        const lb = e.target.closest('[data-label]');
        if (lb) { f.label = lb.dataset.label; form.querySelectorAll('[data-label]').forEach((x) => { x.classList.toggle('on', x === lb); x.setAttribute('aria-pressed', x === lb); }); }
      });
      // card formatting
      const num = ctx.el.querySelector('#c-num');
      if (num) {
        const brandEl = ctx.el.querySelector('[data-brand]');
        num.addEventListener('input', () => {
          const d = U.latinDigits(num.value).replace(/\D/g, '').slice(0, 16);
          num.value = d.replace(/(\d{4})(?=\d)/g, '$1 ');
          brandEl.textContent = d[0] === '4' ? 'VISA' : d[0] === '5' ? 'Mastercard' : '';
        });
        const exp = ctx.el.querySelector('#c-exp');
        exp.addEventListener('input', (e) => {
          let d = U.latinDigits(exp.value).replace(/\D/g, '').slice(0, 4);
          if (d.length >= 3) d = d.slice(0, 2) + '/' + d.slice(2);
          else if (d.length === 2 && e.inputType !== 'deleteContentBackward') d = d + '/';
          exp.value = d;
        });
        const cvv = ctx.el.querySelector('#c-cvv');
        cvv.addEventListener('input', () => { cvv.value = U.latinDigits(cvv.value).replace(/\D/g, '').slice(0, 3); });
      }

      const setErr = (id, bad) => { const el = ctx.el.querySelector('#' + id); const er = ctx.el.querySelector('#' + id + '-err'); if (el) el.setAttribute('aria-invalid', bad ? 'true' : 'false'); if (er) er.hidden = !bad; return bad ? el : null; };
      const validate = () => {
        const bad = [];
        if (isDel) {
          ['a-area', 'a-street', 'a-unit'].forEach((id) => { const el = ctx.el.querySelector('#' + id); const b = setErr(id, !el.value.trim()); if (b) bad.push(b); });
        }
        let card = null;
        if (coState.method === 'card') {
          const d = ctx.el.querySelector('#c-num').value.replace(/\D/g, '');
          const b1 = setErr('c-num', !(d.length === 16 && U.luhn(d))); if (b1) bad.push(b1);
          const nm = ctx.el.querySelector('#c-name').value.trim();
          const b2 = setErr('c-name', nm.length < 2); if (b2) bad.push(b2);
          const ex = ctx.el.querySelector('#c-exp').value;
          const mm = +ex.slice(0, 2); const yy = +ex.slice(3, 5);
          const now = new Date(); const cy = now.getFullYear() % 100; const cm = now.getMonth() + 1;
          const expBad = !/^\d{2}\/\d{2}$/.test(ex) || mm < 1 || mm > 12 || yy < cy || (yy === cy && mm < cm);
          const b3 = setErr('c-exp', expBad); if (b3) bad.push(b3);
          const b4 = setErr('c-cvv', !/^\d{3}$/.test(ctx.el.querySelector('#c-cvv').value)); if (b4) bad.push(b4);
          card = { number: d, brand: d[0] === '4' ? 'visa' : d[0] === '5' ? 'mastercard' : 'card', last4: d.slice(-4) };
        }
        if (bad.length) { bad[0].focus(); return null; }
        return { card };
      };
      const finish = (payment) => {
        let address = null;
        if (isDel) {
          address = { id: coState.addrId || U.uid('a'), label: f.label || 'home', emirate: f.emirate, area: f.area.trim(), street: f.street.trim(), unit: f.unit.trim(), notes: (f.notes || '').trim() || undefined };
          if (coState.save) {
            const usr = S.user();
            const list = (usr.addresses || []).filter((x) => x.id !== address.id);
            list.unshift(address);
            usr.addresses = list.slice(0, 6);
            S.setUser(usr);
          }
        }
        const fresh = S.computeCart();
        fresh.cart.slot = rs.slot;
        const o = S.placeOrder(fresh, { address, payment });
        coState.form = null; coState.addrId = null;
        H.updateTabbar();
        H.go('#/order-placed/' + o.id, { replace: true });
      };
      const placeBtn = ctx.el.querySelector('[data-place]');
      let busy = false;
      placeBtn.addEventListener('click', () => {
        if (busy) return;
        const v = validate();
        if (!v) return;
        if (coState.method === 'applepay') { applePaySheet(cc.total, () => finish({ method: 'applepay' })); return; }
        busy = true;
        placeBtn.classList.add('loading'); placeBtn.setAttribute('aria-busy', 'true');
        placeBtn.innerHTML = '<span class="spinner" aria-hidden="true"></span><span>' + esc(t('co.placing')) + '</span>';
        setTimeout(() => {
          if (!ctx.alive()) return;
          busy = false;
          if (coState.method === 'card' && v.card.number === '4000000000000002') {
            placeBtn.classList.remove('loading'); placeBtn.removeAttribute('aria-busy');
            placeBtn.innerHTML = '<span>' + esc(t('co.placeOrder')) + '</span>' + U.price(cc.total);
            H.toast(t('pay.declined'), { type: 'error' });
            const n = ctx.el.querySelector('#c-num'); if (n) n.focus();
            return;
          }
          finish(coState.method === 'card' ? { method: 'card', brand: v.card.brand, last4: v.card.last4 } : { method: 'cash' });
        }, 900);
      });
      void main;
    }
  });

  function applePaySheet(total, done) {
    const html = '<div class="ap-sheet"><div class="ap-row"><span class="muted">' + esc(t('pay.merchant')) + '</span><strong>Hawwi · حووي</strong></div>' +
      '<div class="ap-row"><span class="muted">' + esc(t('cart.total')) + '</span><strong>' + U.price(total) + '</strong></div>' +
      '<div class="ap-card"><span aria-hidden="true">💳</span> <bdi dir="ltr">•••• 1234</bdi></div>' +
      '<div class="ap-status" data-ap><div class="ap-hint pulse-outline">' + esc(t('pay.sheetConfirm')) + '</div></div></div>';
    const sh = H.sheet({ title: 'Apple Pay', html });
    sh.locked = true;
    setTimeout(() => {
      const st = sh.panel.querySelector('[data-ap]');
      if (st) st.innerHTML = '<svg class="ap-check" viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="23" fill="none"/><path fill="none" d="M15 27l7 7 15-15"/></svg><p class="ap-done" role="status">' + esc(t('pay.done')) + '</p>';
      setTimeout(() => { sh.close(true); done(); }, 650 + 600);
    }, 1200);
  }

  /* ---------- 3.12 Order placed ---------- */
  function etaLine(o) {
    const isDel = o.fulfilment === 'delivery';
    if (o.slot && o.slot.type === 'scheduled') {
      const d = new Date(o.etaAt);
      return t(isDel ? 'placed.deliveryAt' : 'placed.pickupAt', { day: U.dayLabel(d), time: U.fmtTime(d) });
    }
    const b = S.business(o.businessId);
    return t('placed.eta', { n: ((b && b.prep) || 30) + (isDel ? 15 : 0) });
  }
  H.route('/order-placed/:orderId', {
    auth: true,
    cls: 'no-chrome',
    render(ctx) {
      const o = S.order(ctx.params.orderId);
      if (!o) { H.notFound(ctx, '🧾', 'trk.notFound'); return; }
      const b = S.business(o.businessId);
      const conf = U.reduced() ? '' : '<div class="confetti" aria-hidden="true">' + Array.from({ length: 20 }, (_, i) => '<span style="--x:' + ((i * 37) % 100) + '%;--d:' + (i % 5) * 120 + 'ms;--r:' + ((i * 53) % 360) + 'deg">' + (i % 2 ? '✨' : '🎉') + '</span>').join('') + '</div>';
      ctx.el.innerHTML = '<main class="placed">' + conf + '<div class="placed-inner"><div class="big-check" aria-hidden="true">' + H.icon('check') + '</div>' +
        '<h1 class="display" tabindex="-1">' + esc(t('placed.title')) + '</h1><p class="order-no"><bdi dir="ltr">#' + esc(o.id) + '</bdi></p>' +
        '<p class="h3" dir="auto">' + esc(b ? H.L(b, 'name') : '') + '</p><p class="muted">' + esc(etaLine(o)) + '</p>' +
        '<div class="stack"><a class="btn btn-primary btn-lg btn-block" href="#/track/' + esc(o.id) + '">' + esc(t('placed.track')) + '</a>' +
        '<a class="btn btn-secondary btn-lg btn-block" href="#/home">' + esc(t('common.goHome')) + '</a></div></div></main>';
    }
  });

  /* ---------- 3.13 Tracking ---------- */
  const STEPS = ['received', 'preparing', 'ready', 'completed'];
  const PROGRESS = { received: 15, preparing: 45, ready: 75, completed: 100 };
  function heroEmoji(o, b) {
    if (o.status === 'received') return '🧾';
    if (o.status === 'preparing') return b && (b.category === 'abaya' || b.category === 'crafts') ? '🧵' : b && b.category === 'perfume' ? '🫙' : '🍳';
    if (o.status === 'ready') return o.fulfilment === 'delivery' ? '🛵' : '📦';
    if (o.status === 'completed') return '✅';
    if (o.status === 'rejected') return '😔';
    return '✖️';
  }
  function heroText(o, b) {
    const bn = b ? H.L(b, 'name') : '';
    if (o.status === 'received') return t('trk.hero.received', { business: bn });
    if (o.status === 'preparing') return t('trk.hero.preparing');
    if (o.status === 'ready') return t(o.fulfilment === 'delivery' ? 'trk.hero.readyDelivery' : 'trk.hero.readyPickup');
    if (o.status === 'completed') return t('trk.hero.completed');
    return H.statusLabel(o);
  }
  H.route('/track/:orderId', {
    auth: true,
    live: true,
    onTick(ctx) {
      const o = S.order(ctx.params.orderId);
      const sig = o ? o.status + '|' + (o.history || []).length + '|' + !!o.reviewed : 'none';
      if (ctx.sig !== undefined && ctx.sig !== sig) { ctx.prevStatus = ctx.sigStatus; H.rerender(); }
    },
    render(ctx) {
      const o = S.order(ctx.params.orderId);
      ctx.sig = o ? o.status + '|' + (o.history || []).length + '|' + !!o.reviewed : 'none';
      if (!o) { H.notFound(ctx, '🧾', 'trk.notFound'); return; }
      const b = S.business(o.businessId);
      const terminalBad = o.status === 'rejected' || o.status === 'cancelled';
      const curIdx = STEPS.indexOf(o.status);
      const histAt = (s) => { const h = (o.history || []).find((x) => x.status === s); return h ? U.fmtTime(h.at) : ''; };
      const pct = PROGRESS[o.status] || 0;
      const items = o.lines.reduce((s, l) => s + l.qty, 0);
      const animate = ctx.lastStatus !== o.status;
      const prevPct = ctx.lastPct != null ? ctx.lastPct : 0;
      ctx.lastStatus = o.status; ctx.lastPct = pct;
      ctx.el.innerHTML = '<main class="track">' + H.appbar({ title: t('trk.title'), back: '#/orders', actions: '<bdi dir="ltr" class="muted order-id">#' + esc(o.id) + '</bdi>' }) +
        '<div class="pad"><div class="card hero-card st-' + o.status + (o.fulfilment === 'delivery' ? ' del' : '') + '" aria-live="polite">' +
        '<div class="hero-anim"><span class="trk-emoji" aria-hidden="true">' + heroEmoji(o, b) + '</span>' + (o.status === 'preparing' ? '<span class="steam" aria-hidden="true"><i>💨</i><i>💨</i><i>💨</i></span>' : '') + '</div>' +
        '<h2 class="h2">' + esc(heroText(o, b)) + '</h2>' +
        (!terminalBad ? '<p class="muted">' + esc(t('trk.eta', { time: (o.slot && o.slot.type === 'scheduled' ? U.dayLabel(new Date(o.etaAt)) + ' ' : '') + U.fmtTime(o.etaAt) })) + '</p>' +
          '<div class="progress' + (o.status !== 'completed' ? ' active' : '') + '" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '" aria-label="' + esc(H.statusLabel(o)) + '"><span data-bar style="width:' + (animate ? prevPct : pct) + '%"></span></div>' : '') +
        (o.status === 'rejected' && o.rejectReason ? '<p class="info-strip">' + esc(t('trk.reason', { reason: H.reasonText(o) })) + '</p>' : '') +
        '</div>' +
        (!terminalBad ? '<ol class="vstep">' + STEPS.map((s, i) => {
          const done = i < curIdx || (o.status === 'completed' && i === curIdx);
          const cur = i === curIdx && o.status !== 'completed';
          return '<li class="vstep-item' + (done ? ' done' : '') + (cur ? ' current' : '') + (animate && i === curIdx ? ' just' : '') + '"' + (cur ? ' aria-current="step"' : '') + '><span class="vdot" aria-hidden="true">' + (done ? '✓' : '') + '</span><span class="vlabel">' + esc(H.statusLabel(o, s)) + '</span><span class="vtime"><bdi>' + esc(histAt(s)) + '</bdi></span></li>';
        }).join('') + '</ol>' : '') +
        (o.status === 'completed' && !o.reviewed ? '<div class="card rate-card"><h2 class="h3">' + esc(t('rev.rateOrder')) + '</h2><div class="star-input" role="group" aria-label="' + esc(t('rev.rateOrder')) + '">' + [1, 2, 3, 4, 5].map((n) => '<button type="button" class="star-in" data-rate="' + n + '" aria-label="' + esc(t('rev.stars', { n })) + '">★</button>').join('') + '</div></div>' : '') +
        (b ? '<div class="card biz-contact"><a class="grow biz-mini" href="#/business/' + esc(b.id) + '">' + H.bizLogo(b, 'logo-40') + '<strong dir="auto">' + esc(H.L(b, 'name')) + '</strong></a>' +
          '<button type="button" class="icon-btn" data-contact aria-label="' + esc(t('trk.call')) + '">' + H.icon('phone') + '</button><button type="button" class="icon-btn" data-contact aria-label="' + esc(t('trk.chat')) + '">' + H.icon('chat') + '</button></div>' : '') +
        '<details class="card summary"><summary><span>' + esc(t('trk.orderLine', { n: items, total: U.fmtPrice(o.total) })) + '</span>' + H.icon('chevDown', 'sm chev') + '</summary>' +
        '<ul class="sum-lines">' + o.lines.map((l) => '<li><span><bdi dir="ltr">' + l.qty + '×</bdi> ' + esc(H.lineName(l)) + (H.lineOpts(l) ? '<span class="line-opts">' + esc(H.lineOpts(l)) + '</span>' : '') + (l.notes ? '<span class="line-notes"><bdi>"' + esc(l.notes) + '"</bdi></span>' : '') + '</span>' + U.price(l.lineTotal) + '</li>').join('') + '</ul>' +
        '<dl class="totals"><div><dt>' + esc(t('cart.subtotal')) + '</dt><dd>' + U.price(o.subtotal) + '</dd></div>' +
        (o.fulfilment === 'delivery' ? '<div><dt>' + esc(t('cart.deliveryFee')) + '</dt><dd>' + U.price(o.deliveryFee) + '</dd></div>' : '') +
        (o.discount ? '<div class="disc"><dt>' + esc(t('cart.discount', { code: o.promo })) + '</dt><dd>' + U.minus(o.discount) + '</dd></div>' : '') +
        '<div class="grand"><dt>' + esc(t('cart.total')) + '</dt><dd>' + U.price(o.total) + '</dd></div></dl>' +
        '<p class="meta">' + esc(H.payText(o.payment)) + (o.address ? ' · 📍 ' + esc(H.addrText(o.address)) : '') + '</p></details>' +
        (o.status === 'received' ? '<button type="button" class="btn btn-danger-outline btn-block" data-cancel>' + esc(t('trk.cancel')) + '</button>' : '') +
        (terminalBad ? '<a class="btn btn-primary btn-block" href="#/home">' + esc(t('trk.browseOthers')) + '</a>' : '') +
        '</div></main>';
      if (animate) {
        const bar = ctx.el.querySelector('[data-bar]');
        if (bar) requestAnimationFrame(() => requestAnimationFrame(() => { bar.style.width = pct + '%'; }));
      }
      const main = ctx.el.querySelector('main');
      main.addEventListener('click', async (e) => {
        if (e.target.closest('[data-contact]')) { const cur = S.order(o.id); H.toast(t(cur && cur.status === 'received' ? 'trk.contactLater' : 'common.demo')); return; }
        if (e.target.closest('[data-cancel]')) {
          if (await H.confirm({ title: t('trk.cancelConfirm'), ok: t('trk.cancel'), cancel: t('trk.keep'), danger: true })) {
            const cur = S.order(o.id);
            if (cur && cur.status === 'received') { S.setStatus(o.id, 'cancelled', {}); S.updateOrder(o.id, (x) => { x.simulate = false; }); H.updateTabbar(); H.rerender(); }
          }
          return;
        }
        const r = e.target.closest('[data-rate]');
        if (r) H.openReviewSheet(o.businessId, o.id, +r.dataset.rate);
      });
    }
  });
})();
