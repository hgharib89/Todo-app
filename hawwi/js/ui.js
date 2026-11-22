/* Hawwi UI components: icons, toast, modal, sheet, cards, badges, stepper, etc. */
(function () {
  'use strict';
  const H = (window.H = window.H || {});
  const U = H.U;
  const esc = U.esc;
  const t = (k, v) => H.t(k, v);

  /* ---------- icons (inline SVG, 24x24, stroke currentColor) ---------- */
  const P = {
    back: '<path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/>',
    close: '<path d="M18 6L6 18"/><path d="M6 6l12 12"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    heart: '<path d="M12 20s-7-4.4-9.3-8.6C1.2 8.4 2.8 5 6.2 5c2 0 3.2 1.1 3.8 2.1.6-1 1.8-2.1 3.8-2.1 3.4 0 5 3.4 3.5 6.4C19 15.6 12 20 12 20z" transform="translate(1 0)"/>',
    share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4"/><path d="M15.4 6.5l-6.8 4"/>',
    chevron: '<path d="M9 6l6 6-6 6"/>',
    chevDown: '<path d="M6 9l6 6 6-6"/>',
    plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M6 6l1 14h10l1-14"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/>',
    check: '<path d="M20 6L9 17l-5-5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    pin: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0119 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    phone: '<path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1 1 .4 1.9.7 2.8a2 2 0 01-.5 2.1L8 9.9a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.5c.9.3 1.8.6 2.8.7a2 2 0 011.7 2z"/>',
    chat: '<path d="M21 12a8 8 0 01-11.6 7.1L4 20l1-4.6A8 8 0 1121 12z"/>',
    bell: '<path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 01-3.4 0"/>',
    pause: '<path d="M8 5v14"/><path d="M16 5v14"/>',
    play: '<path d="M7 5l12 7-12 7z"/>'
  };
  const DIRECTIONAL = { back: 1, chevron: 1 };
  H.icon = function (name, cls, filled) {
    const c = 'icon' + (DIRECTIONAL[name] ? ' icon-dir' : '') + (cls ? ' ' + cls : '');
    return '<svg class="' + c + '" viewBox="0 0 24 24" width="24" height="24" fill="' + (filled ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + (P[name] || '') + '</svg>';
  };

  /* ---------- toast (queue, one at a time) ---------- */
  const queue = [];
  let showing = false;
  let currentToast = null;
  H.toast = function (msg, opts) {
    queue.push({ msg, opts: opts || {} });
    if (!showing) nextToast();
    // a newer toast is waiting: let the current one finish after a short minimum, so time-limited
    // actions such as "Undo" are not hidden behind an older toast for several seconds
    else if (currentToast) currentToast.hurry();
  };
  function nextToast() {
    const item = queue.shift();
    const root = document.getElementById('toast-root');
    if (!item || !root) { showing = false; return; }
    showing = true;
    const o = item.opts;
    const el = document.createElement('div');
    el.className = 'toast' + (o.type ? ' toast-' + o.type : '');
    el.setAttribute('role', o.type === 'error' ? 'alert' : 'status');
    const lead = o.type === 'success' ? '<span class="toast-lead ok" aria-hidden="true">✓</span>' : o.type === 'error' ? '<span class="toast-lead err" aria-hidden="true">!</span>' : (o.emoji ? '<span class="toast-emoji" aria-hidden="true">' + esc(o.emoji) + '</span>' : '');
    el.innerHTML = lead + '<span class="toast-msg">' + esc(item.msg) + '</span>' + (o.action ? '<button type="button" class="toast-action">' + esc(o.action.label) + '</button>' : '');
    root.appendChild(el);
    let done = false;
    const shownAt = Date.now();
    const close = () => {
      if (done) return; done = true;
      if (currentToast && currentToast.el === el) currentToast = null;
      el.classList.remove('show');
      setTimeout(() => { el.remove(); nextToast(); }, U.reduced() ? 0 : 200);
    };
    currentToast = { el, hurry: () => setTimeout(close, Math.max(0, 1200 - (Date.now() - shownAt))) };
    if (o.action) el.querySelector('.toast-action').addEventListener('click', () => { try { o.action.fn(); } finally { close(); } });
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(close, o.action ? 4000 : 2800);
  }
  H.toastBottom = function (hasTabbar) {
    const root = document.getElementById('toast-root');
    if (root) root.style.bottom = hasTabbar ? '88px' : '24px';
  };

  /* ---------- overlays: modal & sheet with focus trap ---------- */
  const stack = [];
  const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  function trapKeys(e) {
    const top = stack[stack.length - 1];
    if (!top) return;
    if (e.key === 'Escape') { if (!top.locked) { e.preventDefault(); top.close(false); } return; }
    if (e.key === 'Tab') {
      const f = Array.from(top.panel.querySelectorAll(FOCUSABLE)).filter((x) => x.offsetParent !== null);
      if (!f.length) { e.preventDefault(); return; }
      const first = f[0]; const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      else if (!top.panel.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    }
  }
  document.addEventListener('keydown', trapKeys);

  function openOverlay(kind, html, opts) {
    const root = document.getElementById('overlay-root');
    const opener = document.activeElement;
    const wrap = document.createElement('div');
    wrap.className = 'overlay overlay-' + kind;
    const tid = 'ov-t-' + Math.random().toString(36).slice(2, 8);
    wrap.innerHTML = '<div class="scrim" data-scrim></div><div class="' + kind + '" role="dialog" aria-modal="true" aria-labelledby="' + tid + '">' + html.replace(/__TID__/g, tid) + '</div>';
    root.appendChild(wrap);
    const panel = wrap.querySelector('.' + kind);
    let resolved = false;
    const entry = {
      panel, wrap, locked: false,
      close(val) {
        if (resolved) return; resolved = true;
        wrap.classList.remove('open');
        const i = stack.indexOf(entry); if (i >= 0) stack.splice(i, 1);
        setTimeout(() => wrap.remove(), U.reduced() ? 0 : 320);
        if (opener && opener.focus && document.body.contains(opener)) { try { opener.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
        if (opts && opts.onClose) opts.onClose(val);
      }
    };
    stack.push(entry);
    wrap.querySelector('[data-scrim]').addEventListener('click', () => { if (!entry.locked) entry.close(false); });
    wrap.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => entry.close(false)));
    requestAnimationFrame(() => {
      wrap.classList.add('open');
      const f = panel.querySelector('[autofocus]') || panel.querySelector(FOCUSABLE);
      if (f) { try { f.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
    });
    return entry;
  }

  /* Confirm modal -> Promise<boolean> */
  H.confirm = function (o) {
    return new Promise((resolve) => {
      const html = '<h2 class="modal-title" id="__TID__">' + esc(o.title) + '</h2>' +
        (o.body ? '<p class="modal-body">' + esc(o.body) + '</p>' : '') +
        '<div class="modal-actions">' +
        '<button type="button" class="btn ' + (o.danger ? 'btn-danger' : 'btn-primary') + ' btn-block" data-ok>' + esc(o.ok || t('common.confirm')) + '</button>' +
        '<button type="button" class="btn btn-ghost btn-block" data-close>' + esc(o.cancel || t('common.cancel')) + '</button></div>';
      const e = openOverlay('modal', html, { onClose: (v) => resolve(!!v) });
      e.panel.querySelector('[data-ok]').addEventListener('click', () => e.close(true));
    });
  };
  /* Generic modal with custom html */
  H.modal = function (o) {
    const html = '<h2 class="modal-title" id="__TID__">' + esc(o.title) + '</h2><div class="modal-content">' + o.html + '</div>' +
      '<div class="modal-actions"><button type="button" class="btn btn-primary btn-block" data-close>' + esc(o.closeLabel || t('common.close')) + '</button></div>';
    return openOverlay('modal', html, o);
  };

  /* Bottom sheet */
  H.sheet = function (o) {
    const html = '<div class="sheet-handle" data-drag aria-hidden="true"></div>' +
      '<div class="sheet-head" data-drag><h2 class="sheet-title" id="__TID__">' + esc(o.title) + '</h2>' +
      '<button type="button" class="icon-btn" data-close aria-label="' + esc(t('common.close')) + '">' + H.icon('close') + '</button></div>' +
      '<div class="sheet-body">' + o.html + '</div>';
    const e = openOverlay('sheet', html, o);
    // drag down to close
    let startY = null; let dy = 0;
    e.panel.querySelectorAll('[data-drag]').forEach((h) => {
      h.addEventListener('pointerdown', (ev) => { if (ev.target.closest('button')) return; startY = ev.clientY; dy = 0; e.panel.style.transition = 'none'; try { h.setPointerCapture(ev.pointerId); } catch (x) { /* ignore */ } });
      h.addEventListener('pointermove', (ev) => { if (startY == null) return; dy = Math.max(0, ev.clientY - startY); e.panel.style.transform = 'translateY(' + dy + 'px)'; });
      const end = () => { if (startY == null) return; startY = null; e.panel.style.transition = ''; e.panel.style.transform = ''; if (dy > 80) e.close(false); };
      h.addEventListener('pointerup', end); h.addEventListener('pointercancel', end);
    });
    if (o.onMount) o.onMount(e.panel, e);
    return e;
  };

  /* ---------- small components ---------- */
  H.tile = function (emoji, grad, cls, label) {
    const g = grad || ['#F1DFC0', '#C9A46C'];
    return '<span class="tile ' + (cls || '') + '" style="--g1:' + esc(g[0]) + ';--g2:' + esc(g[1]) + '"' + (label ? ' role="img" aria-label="' + esc(label) + '"' : '') + '><span class="tile-emoji" aria-hidden="true">' + esc(emoji) + '</span></span>';
  };
  H.bizLogo = (b, cls) => H.tile(b.logo, H.S.gradient(b), 'logo ' + (cls || ''));
  H.prodTile = function (p, cls) {
    const b = H.S.business(p.businessId);
    const cat = H.S.category(b ? b.category : 'food');
    return H.tile(p.emoji, cat.grad, cls, H.L(p, 'name'));
  };

  H.starsDisplay = function (rating, count) {
    const pct = Math.max(0, Math.min(100, (rating / 5) * 100));
    return '<span class="stars" role="img" aria-label="' + esc(t('rev.rated', { r: rating, n: count != null ? count : '' })) + '"><span class="stars-bg" aria-hidden="true">★★★★★</span><span class="stars-fg" aria-hidden="true" style="width:' + pct + '%">★★★★★</span></span>';
  };
  H.ratingCompact = (b) => '<span class="rating" aria-label="' + esc(t('rev.rated', { r: b.rating, n: b.reviewCount })) + '"><span aria-hidden="true">⭐</span> <bdi>' + esc(Number(b.rating).toFixed(1)) + '</bdi> <span class="muted">(<bdi>' + esc(b.reviewCount) + '</bdi>)</span></span>';

  H.fulfilLine = function (b) {
    const parts = [];
    if (b.pickup) parts.push(esc(t('biz.pickup')));
    if (b.delivery) parts.push(b.deliveryFee > 0 ? esc(t('biz.deliveryFee', { fee: '' })) + U.price(b.deliveryFee) : esc(t('biz.freeDelivery')));
    return parts.join(' · ');
  };

  H.heartBtn = function (type, id, name, cls) {
    const on = H.S.user() && H.S.isFav(type, id);
    return '<button type="button" class="icon-btn heart ' + (cls || '') + (on ? ' on' : '') + '" data-fav="' + type + '" data-id="' + esc(id) + '" aria-pressed="' + (on ? 'true' : 'false') + '" aria-label="' + esc(t('biz.favLabel', { name })) + '">' + H.icon('heart', '', on) + '</button>';
  };

  H.bizRow = function (b) {
    const name = H.L(b, 'name');
    return '<li class="biz-row card"><a class="biz-row-main" href="#/business/' + esc(b.id) + '">' + H.bizLogo(b, 'logo-56') +
      '<span class="biz-row-text"><span class="biz-row-name" dir="auto">' + esc(name) + '</span>' +
      '<span class="meta">' + H.ratingCompact(b) + ' · <span dir="auto">' + esc(H.L(b, 'owner')) + '</span> · <span dir="auto">' + esc(H.L(b, 'area')) + '</span></span>' +
      '<span class="meta">' + U.openBadge(b) + ' <span class="fulfil">' + H.fulfilLine(b) + '</span></span></span></a>' +
      H.heartBtn('businesses', b.id, name) + '</li>';
  };

  H.featuredCard = function (b, i, total) {
    const g = H.S.gradient(b);
    return '<li class="feat-card" role="group" aria-roledescription="slide" aria-label="' + esc(t('common.slideOf', { n: i + 1, total })) + '" data-i="' + i + '">' +
      '<a href="#/business/' + esc(b.id) + '" class="feat-link" style="--g1:' + g[0] + ';--g2:' + g[1] + '">' +
      '<span class="feat-emoji" aria-hidden="true">' + esc(b.logo) + '</span><span class="feat-scrim"></span>' +
      '<span class="feat-info">' + H.bizLogo(b, 'logo-40') + '<span class="feat-text"><span class="feat-name" dir="auto">' + esc(H.L(b, 'name')) + ' <span aria-hidden="true">⭐</span><bdi>' + esc(Number(b.rating).toFixed(1)) + '</bdi></span>' +
      '<span class="feat-meta"><span dir="auto">' + esc(H.L(b, 'owner')) + ' · ' + esc(H.L(b, 'area')) + '</span> · ' + U.openBadge(b) + '</span></span></span></a></li>';
  };

  H.productCard = function (p, opts) {
    opts = opts || {};
    const name = H.L(p, 'name');
    const sold = p.available === false;
    const b = opts.showBiz ? H.S.business(p.businessId) : null;
    return '<li class="prod-card card' + (sold ? ' sold' : '') + '"><a class="prod-link" href="#/product/' + esc(p.businessId) + '/' + esc(p.id) + '">' +
      '<span class="prod-tile-wrap">' + H.prodTile(p, 'prod-tile') + (sold ? '<span class="sold-overlay">' + esc(t('biz.soldOut')) + '</span>' : '') + '</span>' +
      '<span class="prod-name" dir="auto">' + esc(name) + '</span>' +
      (b ? '<span class="prod-biz" dir="auto">' + esc(H.L(b, 'name')) + '</span>' : '') +
      '<span class="prod-price">' + U.price(p.price) + '</span></a>' +
      (sold || opts.noAdd ? '' : '<button type="button" class="quick-add" data-quick-add="' + esc(p.id) + '" aria-label="' + esc(t('biz.quickAdd', { name })) + '">' + H.icon('plus') + '</button>') +
      '</li>';
  };

  H.stepper = function (val, opts) {
    opts = opts || {};
    const min = opts.min != null ? opts.min : 1;
    const max = opts.max || 20;
    const data = opts.data || '';
    return '<div class="stepper" ' + data + '>' +
      '<button type="button" class="step-btn" data-step="-1" aria-label="' + esc(t('prod.decrease')) + '"' + (val <= min ? ' disabled aria-disabled="true"' : '') + '>' + H.icon('minus') + '</button>' +
      '<span class="step-val" aria-live="polite"><bdi>' + esc(val) + '</bdi></span>' +
      '<button type="button" class="step-btn" data-step="1" aria-label="' + esc(t('prod.increase')) + '"' + (val >= max ? ' disabled aria-disabled="true"' : '') + '>' + H.icon('plus') + '</button></div>';
  };

  H.empty = function (o) {
    let btn = '';
    if (o.btn) {
      btn = o.btn.href ? '<a class="btn btn-primary" href="' + esc(o.btn.href) + '">' + esc(o.btn.label) + '</a>'
        : '<button type="button" class="btn btn-primary" data-act="' + esc(o.btn.act) + '">' + esc(o.btn.label) + '</button>';
    }
    return '<div class="empty"><span class="empty-emoji" aria-hidden="true">' + esc(o.emoji) + '</span><h2 class="empty-title">' + esc(o.title) + '</h2>' +
      (o.body ? '<p class="empty-body">' + esc(o.body) + '</p>' : '') + btn + '</div>';
  };

  H.sw = function (o) {
    return '<button type="button" class="switch" role="switch" aria-checked="' + (o.on ? 'true' : 'false') + '"' + (o.id ? ' id="' + esc(o.id) + '"' : '') +
      (o.label ? ' aria-label="' + esc(o.label) + '"' : '') + (o.data || '') + '><span class="switch-knob"></span></button>';
  };

  H.seg = function (name, items, value, label) {
    return '<div class="seg" role="tablist" aria-label="' + esc(label || '') + '" data-seg="' + esc(name) + '">' +
      items.map((it) => '<button type="button" role="tab" class="seg-btn" aria-selected="' + (it.value === value ? 'true' : 'false') + '" data-value="' + esc(it.value) + '"' + (it.disabled ? ' disabled aria-disabled="true"' : '') + (it.title ? ' title="' + esc(it.title) + '"' : '') + '>' + it.html + '</button>').join('') + '</div>';
  };

  H.skel = (cls, style) => '<span class="skel ' + (cls || '') + '"' + (style ? ' style="' + style + '"' : '') + ' aria-hidden="true"></span>';

  /* order status label & badge */
  H.statusLabel = function (o, status) {
    status = status || o.status;
    if (status === 'ready') return t(o.fulfilment === 'delivery' ? 'st.readyDelivery' : 'st.readyPickup');
    if (status === 'completed') return t(o.fulfilment === 'delivery' ? 'st.completedDelivery' : 'st.completedPickup');
    return t('st.' + status);
  };
  const STATUS_CLS = { received: 'info', preparing: 'warning', ready: 'teal', completed: 'success', rejected: 'danger', cancelled: 'muted' };
  H.statusBadge = (o) => '<span class="badge badge-dot badge-' + STATUS_CLS[o.status] + '">' + esc(H.statusLabel(o)) + '</span>';

  /* rejection reason in the current language: preset reasons are stored as "ar / en" plus a key */
  H.reasonText = function (o) {
    const r = (o && o.rejectReason) || '';
    const k = o && o.rejectReasonKey;
    if (k === 'otherPreset') return t('own.reason.other');
    if (k && k !== 'other' && H.STR['own.reason.' + k]) return t('own.reason.' + k);
    if (k === 'other') return r;
    const parts = r.split(' / ');
    return parts.length === 2 ? (H.lang() === 'en' ? parts[1] : parts[0]) : r;
  };
  H.customerName = (c) => (c && (c.nameAr || c.nameEn) ? H.L(c, 'name') : (c && c.name) || '');
  H.addrText = function (a) {
    if (!a) return '';
    const area = H.lang() === 'en' && a.areaEn ? a.areaEn : a.area;
    return [area, a.street, a.unit].filter(Boolean).join(H.lang() === 'ar' ? '، ' : ', ');
  };
  H.lineName = (l) => (H.lang() === 'en' ? l.nameEn : l.nameAr);
  H.lineOpts = (l) => ((l.optionLabels && l.optionLabels[H.lang()]) || []).join('، ');
  H.payText = function (p) {
    if (!p) return '';
    if (p.method === 'card') return '💳 ' + t('pay.card') + (p.last4 ? ' ••' + p.last4 : '');
    if (p.method === 'applepay') return t('pay.applePay');
    return '💵 ' + t('pay.cash');
  };
  H.slotText = function (o) {
    const s = o.slot || { type: 'asap' };
    if (s.type === 'asap') return t('co.asap');
    return U.dayLabel(new Date(s.at || o.etaAt)) + ' ' + U.fmtTime(s.at || o.etaAt);
  };

  /* app bar */
  H.appbar = function (o) {
    return '<header class="appbar' + (o.cls ? ' ' + o.cls : '') + '">' +
      (o.back ? '<button type="button" class="icon-btn" data-back="' + esc(o.back) + '" aria-label="' + esc(t('common.back')) + '">' + H.icon('back') + '</button>' : '') +
      '<h1 class="appbar-title" tabindex="-1">' + esc(o.title) + '</h1>' +
      '<div class="appbar-actions">' + (o.actions || '') + '</div></header>';
  };
})();
