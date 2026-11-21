/* Hawwi views: owner products list, product form, shop profile & hours */
(function () {
  'use strict';
  const H = window.H;
  const U = H.U;
  const S = H.S;
  const esc = U.esc;
  const t = (k, v) => H.t(k, v);
  const clone = (x) => JSON.parse(JSON.stringify(x));

  /* ---------- 4.5 Manage products ---------- */
  let prodQuery = '';
  function productRow(p) {
    const name = H.L(p, 'name');
    return '<li class="card prow' + (p.hidden ? ' is-hidden' : '') + '" data-pid="' + esc(p.id) + '">' +
      '<div class="prow-top">' + H.prodTile(p, 'tile-48') + '<div class="grow"><span class="strong" dir="auto">' + esc(name) + '</span>' + (p.hidden ? ' <span class="badge badge-muted">' + esc(t('own.hidden')) + '</span>' : '') + (p.available === false ? ' <span class="badge badge-danger">' + esc(t('biz.soldOut')) + '</span>' : '') +
      '<span class="meta">' + esc(p.section ? (H.lang() === 'en' ? p.section.en : p.section.ar) : '') + '</span></div>' + U.price(p.price) + '</div>' +
      '<div class="prow-ctrls"><span class="sw-label"><span id="vis-' + esc(p.id) + '">' + esc(t('own.visible')) + '</span>' + H.sw({ on: !p.hidden, data: ' data-vis aria-labelledby="vis-' + esc(p.id) + '"' }) + '</span>' +
      '<span class="sw-label"><span id="stk-' + esc(p.id) + '">' + esc(t('own.inStock')) + '</span>' + H.sw({ on: p.available !== false, data: ' data-stock aria-labelledby="stk-' + esc(p.id) + '"' }) + '</span><span class="grow"></span>' +
      '<a class="icon-btn" href="#/owner/products/' + esc(p.id) + '/edit" aria-label="' + esc(t('own.editName', { name })) + '">' + H.icon('edit') + '</a>' +
      '<button type="button" class="icon-btn danger-text" data-del aria-label="' + esc(t('own.deleteName', { name })) + '">' + H.icon('trash') + '</button></div></li>';
  }
  H.route('/owner/products', {
    auth: true, owner: true, tabbar: 'owner',
    render(ctx) {
      const b = H.ownerBiz();
      const all = S.products(b.id, { all: true });
      const q = U.norm(prodQuery);
      const list = q ? all.filter((p) => [p.nameAr, p.nameEn].some((s) => U.norm(s).indexOf(q) >= 0)) : all;
      ctx.el.innerHTML = '<main>' + H.ownerBar(b, t('own.products', { n: all.length })) + '<div class="pad">' +
        '<div class="row-between"><div class="search-field small">' + H.icon('search') + '<input type="search" class="search-input" data-q aria-label="' + esc(t('own.searchProducts')) + '" placeholder="' + esc(t('own.searchProducts')) + '" value="' + esc(prodQuery) + '"></div>' +
        '<a class="btn btn-primary btn-sm" href="#/owner/products/new">' + H.icon('plus', 'sm') + ' ' + esc(t('own.newProduct')) + '</a></div>' +
        (all.length ? '<ul class="list" data-list>' + list.map(productRow).join('') + '</ul>' + (!list.length ? H.empty({ emoji: '🔍', title: t('search.noResults', { q: prodQuery }) }) : '')
          : H.empty({ emoji: '🧺', title: t('own.noProducts'), btn: { href: '#/owner/products/new', label: t('own.addFirst') } })) + '</div></main>';
      const main = ctx.el.querySelector('main');
      const qi = main.querySelector('[data-q]');
      qi.addEventListener('input', U.debounce(() => { prodQuery = qi.value; H.rerender(); const n = ctx.el.querySelector('[data-q]'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 250));
      main.addEventListener('toggle', (e) => {
        const row = e.target.closest('[data-pid]'); if (!row) return;
        const pid = row.dataset.pid;
        if (e.target.matches('[data-vis]')) S.saveProduct(pid, { hidden: !e.detail.on });
        if (e.target.matches('[data-stock]')) S.saveProduct(pid, { available: e.detail.on });
        const p = S.product(pid);
        const fresh = document.createElement('ul'); fresh.innerHTML = productRow(p);
        const newRow = fresh.firstElementChild; row.replaceWith(newRow);
        const sel = e.target.matches('[data-vis]') ? '[data-vis]' : '[data-stock]';
        const s = newRow.querySelector(sel); if (s) s.focus();
      });
      main.addEventListener('click', async (e) => {
        const d = e.target.closest('[data-del]');
        if (!d) return;
        const pid = d.closest('[data-pid]').dataset.pid;
        const p = S.product(pid);
        if (!p) return;
        if (await H.confirm({ title: t('own.deleteTitle'), body: t('own.deleteBody', { name: H.L(p, 'name') }), ok: t('common.delete'), danger: true })) {
          S.deleteProduct(pid); H.toast(t('own.productDeleted'), { type: 'success' }); H.rerender();
        }
      });
    }
  });

  /* ---------- Product form ---------- */
  function blankProduct(bid) {
    const cat = (S.business(bid) || {}).category || 'food';
    return { id: null, businessId: bid, nameAr: '', nameEn: '', descAr: '', descEn: '', price: '', emoji: H.SEED.emojiSets[cat][0], section: null, groups: [], hidden: false, available: true };
  }
  const newGroup = () => ({ id: 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 4), nameAr: '', nameEn: '', type: 'single', required: true, choices: [newChoice()] });
  const newChoice = () => ({ id: 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), nameAr: '', nameEn: '', delta: 0 });

  function productForm(ctx, isNew) {
    const b = H.ownerBiz();
    let src;
    if (isNew) src = blankProduct(b.id);
    else {
      const p = S.product(ctx.params.pid);
      if (!p || p.businessId !== b.id) { H.notFound(ctx, '🔍', 'prod.notFound'); return; }
      src = clone(p);
    }
    if (!ctx.draft) { ctx.draft = clone(src); ctx.initial = JSON.stringify(src); }
    const d = ctx.draft;
    const sections = S.sections(b.id);
    if (!d.section && sections[0]) d.section = clone(sections[0]);
    const secKnown = d.section && sections.some((s) => s.ar === d.section.ar);
    if (ctx.newSection === undefined) ctx.newSection = !!d.section && !secKnown || !sections.length;
    const emojis = H.SEED.emojiSets[b.category] || H.SEED.emojiSets.food;
    const f = (id, label, key, opts) => {
      opts = opts || {};
      const tag = opts.area ? 'textarea' : 'input';
      return '<div class="field' + (opts.half ? ' half' : '') + '"><label class="label" for="' + id + '">' + esc(t(label)) + '</label><' + tag + ' id="' + id + '" class="input" data-k="' + key + '"' +
        (opts.ltr ? ' dir="ltr"' : '') + (opts.num ? ' type="number" inputmode="decimal" step="0.5" min="1" max="5000"' : '') + (opts.max ? ' maxlength="' + opts.max + '"' : '') + (opts.req ? ' aria-required="true"' : '') + (opts.area ? ' rows="2"' : '') + ' aria-describedby="' + id + '-err"' +
        (opts.area ? '>' + esc(d[key] || '') + '</textarea>' : ' value="' + esc(d[key] == null ? '' : d[key]) + '">') + '<p class="err" id="' + id + '-err" hidden></p></div>';
    };
    const groupsHtml = () => d.groups.map((g, gi) => '<fieldset class="card grp" data-gi="' + gi + '"><legend class="sr-only">' + esc(t('own.f.groupName')) + ' ' + (gi + 1) + '</legend>' +
      '<div class="form-grid"><div class="field half"><label class="label" for="g' + gi + 'ar">' + esc(t('own.f.groupNameAr')) + '</label><input id="g' + gi + 'ar" class="input" data-g="nameAr" maxlength="40" value="' + esc(g.nameAr) + '"></div>' +
      '<div class="field half"><label class="label" for="g' + gi + 'en">' + esc(t('own.f.groupNameEn')) + '</label><input id="g' + gi + 'en" class="input" dir="ltr" data-g="nameEn" maxlength="40" value="' + esc(g.nameEn) + '"></div>' +
      '<div class="field half"><label class="label" for="g' + gi + 'type">' + esc(t('own.f.groupName')) + '</label><select id="g' + gi + 'type" class="input" data-g="type"><option value="single"' + (g.type === 'single' ? ' selected' : '') + '>' + esc(t('own.f.single')) + '</option><option value="multi"' + (g.type === 'multi' ? ' selected' : '') + '>' + esc(t('own.f.multi')) + '</option></select></div>' +
      (g.type === 'single' ? '<div class="field half sw-field"><span class="label" id="g' + gi + 'req">' + esc(t('common.required')) + '</span>' + H.sw({ on: g.required, data: ' data-greq aria-labelledby="g' + gi + 'req"' }) + '</div>'
        : '<div class="field half"><label class="label" for="g' + gi + 'max">' + esc(t('own.f.max')) + '</label><input id="g' + gi + 'max" class="input" type="number" min="0" max="20" dir="ltr" data-g="max" value="' + esc(g.max || '') + '"></div>') + '</div>' +
      '<ul class="choices">' + g.choices.map((c, ci) => '<li class="choice" data-ci="' + ci + '"><input class="input" aria-label="' + esc(t('own.f.choiceAr')) + '" placeholder="' + esc(t('own.f.choiceAr')) + '" data-c="nameAr" maxlength="40" value="' + esc(c.nameAr) + '">' +
        '<input class="input" dir="ltr" aria-label="' + esc(t('own.f.choiceEn')) + '" placeholder="' + esc(t('own.f.choiceEn')) + '" data-c="nameEn" maxlength="40" value="' + esc(c.nameEn) + '">' +
        '<input class="input delta-in" type="number" min="0" step="0.5" dir="ltr" aria-label="' + esc(t('own.f.priceDelta')) + '" placeholder="+0" data-c="delta" value="' + esc(c.delta) + '">' +
        '<button type="button" class="icon-btn" data-rm-choice aria-label="' + esc(t('own.f.removeChoice')) + '"' + (g.choices.length <= 1 ? ' disabled' : '') + '>' + H.icon('close') + '</button></li>').join('') + '</ul>' +
      '<div class="row-between"><button type="button" class="btn btn-ghost btn-sm" data-add-choice>+ ' + esc(t('own.f.addChoice')) + '</button><button type="button" class="btn btn-ghost btn-sm danger-text" data-rm-group>' + H.icon('trash', 'sm') + ' ' + esc(t('own.f.removeGroup')) + '</button></div>' +
      '<p class="err" data-gerr hidden>' + esc(t('own.f.groupError')) + '</p></fieldset>').join('');
    const preview = () => {
      const cat = S.category(b.category);
      const nm = (H.lang() === 'en' ? d.nameEn : d.nameAr) || d.nameAr || d.nameEn || '—';
      return '<div class="card preview"><span class="label">' + esc(t('own.f.preview')) + '</span><div class="prow-top">' + H.tile(d.emoji || '❔', cat.grad, 'tile-64') +
        '<div class="grow"><span class="strong" dir="auto">' + esc(nm) + '</span><span class="meta" dir="auto">' + esc((H.lang() === 'en' ? d.descEn : d.descAr) || '') + '</span></div>' + U.price(Number(d.price) || 0) + '</div>' +
        (d.hidden ? '<span class="badge badge-muted">' + esc(t('own.hidden')) + '</span> ' : '') + (d.available === false ? '<span class="badge badge-danger">' + esc(t('biz.soldOut')) + '</span>' : '') + '</div>';
    };
    ctx.el.innerHTML = '<main>' + H.appbar({ title: t(isNew ? 'own.newProduct' : 'own.editProduct'), back: '#/owner/products' }) +
      '<form class="pad form" data-form novalidate><div data-preview>' + preview() + '</div>' +
      '<div class="form-grid">' + f('pf-nameAr', 'own.f.nameAr', 'nameAr', { req: true, max: 50 }) + f('pf-nameEn', 'own.f.nameEn', 'nameEn', { req: true, max: 50, ltr: true }) +
      f('pf-descAr', 'own.f.descAr', 'descAr', { area: true, max: 200 }) + f('pf-descEn', 'own.f.descEn', 'descEn', { area: true, max: 200, ltr: true }) +
      f('pf-price', 'own.f.price', 'price', { num: true, req: true, half: true }) +
      '<div class="field half"><label class="label" for="pf-sec">' + esc(t('own.f.section')) + '</label><select id="pf-sec" class="input" data-sec aria-describedby="pf-sec-err">' +
      sections.map((s, i) => '<option value="' + i + '"' + (!ctx.newSection && d.section && d.section.ar === s.ar ? ' selected' : '') + '>' + esc(H.lang() === 'en' ? s.en : s.ar) + '</option>').join('') +
      '<option value="new"' + (ctx.newSection ? ' selected' : '') + '>+ ' + esc(t('own.f.newSection')) + '</option></select><p class="err" id="pf-sec-err" hidden></p></div>' +
      (ctx.newSection ? '<div class="field half"><label class="label" for="pf-secAr">' + esc(t('own.f.newSectionAr')) + '</label><input id="pf-secAr" class="input" data-newsec="ar" maxlength="30" value="' + esc(d.section && !secKnown ? d.section.ar : '') + '" aria-describedby="pf-secAr-err"><p class="err" id="pf-secAr-err" hidden></p></div>' +
        '<div class="field half"><label class="label" for="pf-secEn">' + esc(t('own.f.newSectionEn')) + '</label><input id="pf-secEn" class="input" dir="ltr" data-newsec="en" maxlength="30" value="' + esc(d.section && !secKnown ? d.section.en : '') + '"></div>' : '') +
      '</div>' +
      '<fieldset class="field"><legend class="label">' + esc(t('own.f.emoji')) + '</legend><div class="emoji-grid" role="radiogroup" aria-label="' + esc(t('own.f.emoji')) + '">' + emojis.map((e) => '<button type="button" role="radio" class="emoji-opt' + (d.emoji === e ? ' on' : '') + '" aria-checked="' + (d.emoji === e) + '" data-emoji="' + esc(e) + '">' + esc(e) + '</button>').join('') + '</div>' +
      '<label class="label" for="pf-emoji">' + esc(t('own.f.emojiCustom')) + '</label><input id="pf-emoji" class="input emoji-in" maxlength="8" data-k="emoji" value="' + esc(d.emoji) + '" aria-describedby="pf-emoji-err"><p class="err" id="pf-emoji-err" hidden>' + esc(t('own.f.emojiError')) + '</p></fieldset>' +
      '<section class="sec-block"><h2 class="h3">' + esc(t('own.f.options')) + '</h2><div data-groups>' + groupsHtml() + '</div><button type="button" class="btn btn-outline btn-block" data-add-group>+ ' + esc(t('own.f.addGroup')) + '</button></section>' +
      '<div class="card"><div class="list-row static"><span class="grow" id="pf-vis">' + esc(t('own.visible')) + '</span>' + H.sw({ on: !d.hidden, data: ' data-pvis aria-labelledby="pf-vis"' }) + '</div>' +
      '<div class="list-row static"><span class="grow" id="pf-stk">' + esc(t('own.inStock')) + '</span>' + H.sw({ on: d.available !== false, data: ' data-pstk aria-labelledby="pf-stk"' }) + '</div></div>' +
      '<button type="submit" class="btn btn-primary btn-lg btn-block">' + esc(t('common.save')) + '</button></form></main>';

    const form = ctx.el.querySelector('[data-form]');
    const refreshPreview = () => { ctx.el.querySelector('[data-preview]').innerHTML = preview(); };
    const redrawGroups = () => { ctx.el.querySelector('[data-groups]').innerHTML = groupsHtml(); };
    form.addEventListener('input', (e) => {
      const el = e.target;
      if (el.dataset.k) { d[el.dataset.k] = el.dataset.k === 'price' ? el.value : el.value; if (el.dataset.k === 'emoji') form.querySelectorAll('[data-emoji]').forEach((x) => { const on = x.dataset.emoji === el.value; x.classList.toggle('on', on); x.setAttribute('aria-checked', on); }); refreshPreview(); return; }
      if (el.dataset.newsec) { d.section = d.section && !sections.some((s) => s.ar === d.section.ar) ? d.section : { ar: '', en: '' }; d.section[el.dataset.newsec] = el.value; return; }
      const gEl = el.closest('[data-gi]');
      if (gEl) {
        const g = d.groups[+gEl.dataset.gi];
        if (el.dataset.g) { if (el.dataset.g === 'max') g.max = el.value ? Math.max(0, parseInt(el.value, 10) || 0) || undefined : undefined; else if (el.dataset.g !== 'type') g[el.dataset.g] = el.value; }
        const cEl = el.closest('[data-ci]');
        if (cEl && el.dataset.c) { const c = g.choices[+cEl.dataset.ci]; c[el.dataset.c] = el.dataset.c === 'delta' ? Math.max(0, Number(el.value) || 0) : el.value; }
      }
    });
    form.addEventListener('change', (e) => {
      const el = e.target;
      if (el.matches('[data-sec]')) {
        if (el.value === 'new') { ctx.newSection = true; d.section = { ar: '', en: '' }; }
        else { ctx.newSection = false; d.section = clone(sections[+el.value]); }
        H.rerender(); const s = ctx.el.querySelector(ctx.newSection ? '#pf-secAr' : '#pf-sec'); if (s) s.focus(); return;
      }
      if (el.dataset.g === 'type') {
        const gi = +el.closest('[data-gi]').dataset.gi; const g = d.groups[gi];
        g.type = el.value; g.required = el.value === 'single'; if (el.value === 'single') delete g.max;
        redrawGroups(); const n = ctx.el.querySelector('#g' + gi + 'type'); if (n) n.focus();
      }
    });
    form.addEventListener('toggle', (e) => {
      if (e.target.matches('[data-pvis]')) d.hidden = !e.detail.on;
      if (e.target.matches('[data-pstk]')) d.available = e.detail.on;
      if (e.target.matches('[data-greq]')) d.groups[+e.target.closest('[data-gi]').dataset.gi].required = e.detail.on;
      refreshPreview();
    });
    form.addEventListener('click', (e) => {
      const em = e.target.closest('[data-emoji]');
      if (em) { d.emoji = em.dataset.emoji; form.querySelector('#pf-emoji').value = d.emoji; form.querySelectorAll('[data-emoji]').forEach((x) => { const on = x === em; x.classList.toggle('on', on); x.setAttribute('aria-checked', on); }); refreshPreview(); return; }
      if (e.target.closest('[data-add-group]')) { d.groups.push(newGroup()); redrawGroups(); const n = ctx.el.querySelector('#g' + (d.groups.length - 1) + 'ar'); if (n) n.focus(); return; }
      const gEl = e.target.closest('[data-gi]');
      if (!gEl) return;
      const gi = +gEl.dataset.gi; const g = d.groups[gi];
      if (e.target.closest('[data-rm-group]')) { d.groups.splice(gi, 1); redrawGroups(); const n = ctx.el.querySelector('[data-add-group]'); if (n) n.focus(); return; }
      if (e.target.closest('[data-add-choice]')) { g.choices.push(newChoice()); redrawGroups(); const n = ctx.el.querySelector('[data-gi="' + gi + '"] [data-ci="' + (g.choices.length - 1) + '"] input'); if (n) n.focus(); return; }
      const rc = e.target.closest('[data-rm-choice]');
      if (rc && g.choices.length > 1) { g.choices.splice(+rc.closest('[data-ci]').dataset.ci, 1); redrawGroups(); }
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const errs = [];
      const setErr = (id, msg) => { const el = ctx.el.querySelector('#' + id); const er = ctx.el.querySelector('#' + id + '-err'); if (el) el.setAttribute('aria-invalid', msg ? 'true' : 'false'); if (er) { er.hidden = !msg; if (msg) er.textContent = msg; } if (msg && el) errs.push(el); };
      const len = (v, a, z) => { const s = String(v || '').trim(); return s.length >= a && s.length <= z; };
      setErr('pf-nameAr', len(d.nameAr, 2, 50) ? '' : t('own.f.lenError', { min: 2, max: 50 }));
      setErr('pf-nameEn', len(d.nameEn, 2, 50) ? '' : t('own.f.lenError', { min: 2, max: 50 }));
      setErr('pf-descAr', String(d.descAr || '').length <= 200 ? '' : t('own.f.maxLen', { max: 200 }));
      setErr('pf-descEn', String(d.descEn || '').length <= 200 ? '' : t('own.f.maxLen', { max: 200 }));
      const price = Number(d.price);
      setErr('pf-price', price >= 1 && price <= 5000 ? '' : t('own.f.priceError'));
      if (ctx.newSection) setErr('pf-secAr', d.section && d.section.ar.trim().length >= 2 ? '' : t('co.fieldRequired'));
      setErr('pf-emoji', String(d.emoji || '').trim() ? '' : t('own.f.emojiError'));
      let gBad = null;
      ctx.el.querySelectorAll('[data-gerr]').forEach((x) => { x.hidden = true; });
      d.groups.forEach((g, gi) => {
        const ok = (g.nameAr.trim() || g.nameEn.trim()) && g.choices.length && g.choices.every((c) => c.nameAr.trim() || c.nameEn.trim());
        if (!ok) { const box = ctx.el.querySelector('[data-gi="' + gi + '"]'); box.querySelector('[data-gerr]').hidden = false; if (!gBad) gBad = box.querySelector('input'); }
      });
      if (gBad) errs.push(gBad);
      if (errs.length) { errs[0].focus(); H.toast(t('own.f.fixErrors'), { type: 'error' }); return; }
      const sec = ctx.newSection ? { ar: d.section.ar.trim(), en: (d.section.en || d.section.ar).trim() } : d.section;
      const groups = d.groups.map((g) => ({ id: g.id, nameAr: (g.nameAr || g.nameEn).trim(), nameEn: (g.nameEn || g.nameAr).trim(), type: g.type, required: g.type === 'single' ? !!g.required : false, max: g.type === 'multi' && g.max ? g.max : undefined,
        choices: g.choices.map((c) => ({ id: c.id, nameAr: (c.nameAr || c.nameEn).trim(), nameEn: (c.nameEn || c.nameAr).trim(), delta: Math.max(0, Number(c.delta) || 0) })) }));
      const data = { nameAr: d.nameAr.trim(), nameEn: d.nameEn.trim(), descAr: (d.descAr || '').trim(), descEn: (d.descEn || '').trim(), price: U.round2(price), emoji: String(d.emoji).trim(), section: sec, groups, hidden: !!d.hidden, available: d.available !== false };
      if (isNew) S.addProduct(Object.assign({ id: 'c-' + Date.now().toString(36), businessId: b.id, order: 999 }, data));
      else S.saveProduct(d.id, data);
      ctx.initial = JSON.stringify(ctx.draft);
      ctx.saved = true;
      H.toast(t('own.productSaved'), { type: 'success' });
      H.back('#/owner/products');
    });
  }
  const formRoute = (isNew) => ({
    auth: true, owner: true,
    onBack(ctx) {
      if (ctx.saved || !ctx.draft || JSON.stringify(ctx.draft) === ctx.initial) return true;
      H.confirm({ title: t('own.discardTitle'), ok: t('own.discard'), danger: true }).then((ok) => { if (ok && ctx.alive()) { ctx.saved = true; H.back('#/owner/products'); } });
      return false;
    },
    render: (ctx) => productForm(ctx, isNew)
  });
  H.route('/owner/products/new', formRoute(true));
  H.route('/owner/products/:pid/edit', formRoute(false));

  /* ---------- 4.6 Shop profile & weekly hours ---------- */
  H.route('/owner/profile', {
    auth: true, owner: true, tabbar: 'owner',
    render(ctx) {
      const b = H.ownerBiz();
      if (!ctx.draft || ctx.draft.id !== b.id) ctx.draft = clone(b);
      const d = ctx.draft;
      const g = S.gradient(d);
      const emojis = H.SEED.emojiSets[b.category] || H.SEED.emojiSets.food;
      const inp = (id, label, key, o) => {
        o = o || {};
        const tag = o.area ? 'textarea' : 'input';
        return '<div class="field' + (o.half ? ' half' : '') + '"><label class="label" for="' + id + '">' + esc(t(label)) + '</label><' + tag + ' id="' + id + '" class="input" data-k="' + key + '"' + (o.ltr ? ' dir="ltr"' : '') +
          (o.num ? ' type="number" inputmode="numeric" min="' + o.min + '" max="' + o.max + '" step="' + (o.step || 1) + '" dir="ltr"' : '') + (o.maxlen ? ' maxlength="' + o.maxlen + '"' : '') + (o.area ? ' rows="3"' : '') + ' aria-describedby="' + id + '-err"' +
          (o.area ? '>' + esc(d[key] || '') + '</textarea>' : ' value="' + esc(d[key] == null ? '' : d[key]) + '">') + '<p class="err" id="' + id + '-err" hidden></p></div>';
      };
      const hoursRows = () => H.DAY_KEYS.map((k, i) => {
        const e = d.hours[i];
        const after = e && U.hm(e[1]) < U.hm(e[0]);
        const same = e && e[0] === e[1];
        return '<li class="hours-row" data-day="' + i + '"><span class="day-name" id="day-' + i + '">' + esc(t(k)) + '</span>' + H.sw({ on: !!e, data: ' data-dayon aria-label="' + esc(t('own.openDay', { day: t(k) })) + '"' }) +
          (e ? '<span class="times" dir="ltr"><input type="time" step="900" class="input time" data-open value="' + esc(e[0]) + '" aria-label="' + esc(t('own.opensAt') + ' ' + t(k)) + '"><span aria-hidden="true">–</span><input type="time" step="900" class="input time" data-close value="' + esc(e[1]) + '" aria-label="' + esc(t('own.closesAt') + ' ' + t(k)) + '"></span>' : '<span class="muted">' + esc(t('biz.closed')) + '</span>') +
          (after ? '<span class="hint">🌙 ' + esc(t('own.afterMidnight')) + '</span>' : '') + (same ? '<span class="err">' + esc(t('own.sameTimes')) + '</span>' : '') + '</li>';
      }).join('');
      ctx.el.innerHTML = '<main>' + H.ownerBar(b, t('own.shopTitle')) + '<form class="pad form" data-form novalidate>' +
        '<div class="cover small pattern" data-cover style="--g1:' + g[0] + ';--g2:' + g[1] + '"><span class="cover-emoji" aria-hidden="true">' + esc(d.logo) + '</span></div>' +
        '<fieldset class="field"><legend class="label">' + esc(t('own.f.logo')) + '</legend><div class="emoji-grid" role="radiogroup" aria-label="' + esc(t('own.f.logo')) + '">' + emojis.slice(0, 12).concat(emojis.indexOf(d.logo) < 0 ? [d.logo] : []).map((e) => '<button type="button" role="radio" class="emoji-opt' + (d.logo === e ? ' on' : '') + '" aria-checked="' + (d.logo === e) + '" data-logo="' + esc(e) + '">' + esc(e) + '</button>').join('') + '</div></fieldset>' +
        '<fieldset class="field"><legend class="label">' + esc(t('own.f.colours')) + '</legend><div class="swatches" role="radiogroup" aria-label="' + esc(t('own.f.colours')) + '">' + Object.keys(H.SEED.gradients).map((k) => { const gg = H.SEED.gradients[k]; return '<button type="button" role="radio" class="swatch' + (d.colors === k ? ' on' : '') + '" aria-checked="' + (d.colors === k) + '" aria-label="' + esc(k) + '" data-colors="' + k + '" style="--g1:' + gg[0] + ';--g2:' + gg[1] + '"></button>'; }).join('') + '</div></fieldset>' +
        '<div class="form-grid">' + inp('sp-nameAr', 'own.f.bizNameAr', 'nameAr', { maxlen: 50 }) + inp('sp-nameEn', 'own.f.bizNameEn', 'nameEn', { maxlen: 50, ltr: true }) +
        inp('sp-bioAr', 'own.f.bioAr', 'bioAr', { area: true, maxlen: 300 }) + inp('sp-bioEn', 'own.f.bioEn', 'bioEn', { area: true, maxlen: 300, ltr: true }) +
        '<div class="field half"><label class="label" for="sp-em">' + esc(t('signup.emirate')) + '</label><select id="sp-em" class="input" data-k="emirate">' + H.emirateOptions(d.emirate) + '</select></div>' +
        inp('sp-areaAr', 'own.f.areaAr', 'areaAr', { half: true, maxlen: 40 }) + inp('sp-areaEn', 'own.f.areaEn', 'areaEn', { half: true, maxlen: 40, ltr: true }) + '</div>' +
        '<div class="card"><div class="list-row static"><span class="grow" id="sp-pick">🏃 ' + esc(t('biz.pickup')) + '</span>' + H.sw({ on: d.pickup, data: ' data-method="pickup" aria-labelledby="sp-pick"' }) + '</div>' +
        '<div class="list-row static"><span class="grow" id="sp-del">🛵 ' + esc(t('biz.delivery')) + '</span>' + H.sw({ on: d.delivery, data: ' data-method="delivery" aria-labelledby="sp-del"' }) + '</div>' +
        '<p class="err" id="sp-method-err" hidden>' + esc(t('own.f.oneMethod')) + '</p></div>' +
        '<div class="form-grid">' + inp('sp-fee', 'own.f.deliveryFee', 'deliveryFee', { num: true, min: 0, max: 50, half: true }) + inp('sp-min', 'own.f.minOrder', 'minOrder', { num: true, min: 0, max: 200, half: true }) +
        inp('sp-prep', 'own.f.prep', 'prep', { num: true, min: 10, max: 180, step: 5, half: true }) + '</div>' +
        '<section class="sec-block"><h2 class="h3">' + esc(t('own.hours')) + '</h2><ul class="card hours-edit" data-hours>' + hoursRows() + '</ul>' +
        '<button type="button" class="btn btn-outline btn-block" data-copy>' + esc(t('own.copySaturday')) + '</button></section>' +
        '<button type="submit" class="btn btn-primary btn-lg btn-block">' + esc(t('own.saveShop')) + '</button>' +
        '<a class="btn btn-secondary btn-block" href="#/business/' + esc(b.id) + '">👀 ' + esc(t('own.viewAsCustomer')) + '</a>' +
        '<button type="button" class="btn btn-ghost btn-block danger-text" data-exit-owner>' + esc(t('own.exit')) + '</button></form></main>';
      const form = ctx.el.querySelector('[data-form]');
      const cover = () => { const gg = S.gradient(d); const c = ctx.el.querySelector('[data-cover]'); c.style.setProperty('--g1', gg[0]); c.style.setProperty('--g2', gg[1]); c.querySelector('.cover-emoji').textContent = d.logo; };
      const redrawHours = (focusSel) => { ctx.el.querySelector('[data-hours]').innerHTML = hoursRows(); if (focusSel) { const n = ctx.el.querySelector(focusSel); if (n) n.focus(); } };
      form.addEventListener('input', (e) => {
        const k = e.target.dataset.k;
        if (k) { d[k] = e.target.type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value; }
      });
      form.addEventListener('change', (e) => {
        const row = e.target.closest('[data-day]');
        if (row && (e.target.matches('[data-open]') || e.target.matches('[data-close]'))) {
          const i = +row.dataset.day;
          const v = e.target.value || '00:00';
          d.hours[i] = e.target.matches('[data-open]') ? [v, d.hours[i][1]] : [d.hours[i][0], v];
          redrawHours('[data-day="' + i + '"] ' + (e.target.matches('[data-open]') ? '[data-open]' : '[data-close]'));
        }
        if (e.target.dataset.k === 'emirate') d.emirate = e.target.value;
      });
      form.addEventListener('toggle', (e) => {
        const row = e.target.closest('[data-day]');
        if (row && e.target.matches('[data-dayon]')) { const i = +row.dataset.day; d.hours[i] = e.detail.on ? (b.hours[i] || ['10:00', '22:00']) : null; redrawHours('[data-day="' + i + '"] [data-dayon]'); return; }
        if (e.target.dataset.method) d[e.target.dataset.method] = e.detail.on;
      });
      form.addEventListener('click', (e) => {
        const lg = e.target.closest('[data-logo]');
        if (lg) { d.logo = lg.dataset.logo; form.querySelectorAll('[data-logo]').forEach((x) => { x.classList.toggle('on', x === lg); x.setAttribute('aria-checked', x === lg); }); cover(); return; }
        const cl = e.target.closest('[data-colors]');
        if (cl) { d.colors = cl.dataset.colors; form.querySelectorAll('[data-colors]').forEach((x) => { x.classList.toggle('on', x === cl); x.setAttribute('aria-checked', x === cl); }); cover(); return; }
        if (e.target.closest('[data-copy]')) { d.hours = d.hours.map(() => (d.hours[0] ? d.hours[0].slice() : null)); redrawHours(); H.toast(t('own.copied')); }
      });
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const errs = [];
        const setErr = (id, msg) => { const el = ctx.el.querySelector('#' + id); const er = ctx.el.querySelector('#' + id + '-err'); if (el) el.setAttribute('aria-invalid', msg ? 'true' : 'false'); if (er) { er.hidden = !msg; if (msg) er.textContent = msg; } if (msg && el) errs.push(el); };
        const len = (v, a, z) => { const s = String(v || '').trim(); return s.length >= a && s.length <= z; };
        const rng = (v, a, z, step) => v !== '' && !isNaN(v) && v >= a && v <= z && (!step || v % step === 0);
        setErr('sp-nameAr', len(d.nameAr, 2, 50) ? '' : t('own.f.lenError', { min: 2, max: 50 }));
        setErr('sp-nameEn', len(d.nameEn, 2, 50) ? '' : t('own.f.lenError', { min: 2, max: 50 }));
        setErr('sp-areaAr', len(d.areaAr, 2, 40) ? '' : t('co.fieldRequired'));
        setErr('sp-areaEn', len(d.areaEn, 2, 40) ? '' : t('co.fieldRequired'));
        const me = ctx.el.querySelector('#sp-method-err'); me.hidden = d.pickup || d.delivery;
        if (!d.pickup && !d.delivery) errs.push(ctx.el.querySelector('[data-method="pickup"]'));
        setErr('sp-fee', rng(Number(d.deliveryFee), 0, 50) ? '' : t('own.f.rangeError', { min: 0, max: 50 }));
        setErr('sp-min', rng(Number(d.minOrder), 0, 200) ? '' : t('own.f.rangeError', { min: 0, max: 200 }));
        setErr('sp-prep', rng(Number(d.prep), 10, 180, 5) ? '' : t('own.f.rangeError', { min: 10, max: 180 }));
        const badDay = d.hours.findIndex((h) => h && h[0] === h[1]);
        if (badDay >= 0) errs.push(ctx.el.querySelector('[data-day="' + badDay + '"] [data-open]'));
        if (errs.length) { errs.sort((a, c) => (a.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1)); errs[0].focus(); H.toast(t('own.f.fixErrors'), { type: 'error' }); return; }
        S.saveBusinessOverride(b.id, {
          nameAr: d.nameAr.trim(), nameEn: d.nameEn.trim(), bioAr: (d.bioAr || '').trim(), bioEn: (d.bioEn || '').trim(), logo: d.logo, colors: d.colors,
          emirate: d.emirate, areaAr: d.areaAr.trim(), areaEn: d.areaEn.trim(), pickup: !!d.pickup, delivery: !!d.delivery,
          deliveryFee: Number(d.deliveryFee), minOrder: Number(d.minOrder), prep: Number(d.prep), hours: d.hours
        });
        ctx.draft = null;
        H.toast(t('own.shopSaved'), { type: 'success' });
        H.rerender();
      });
    }
  });
})();
