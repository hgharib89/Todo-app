/* Hawwi views: order history, favourites, profile, settings */
(function () {
  'use strict';
  const H = window.H;
  const U = H.U;
  const S = H.S;
  const esc = U.esc;
  const t = (k, v) => H.t(k, v);

  /* ---------- 3.14 Orders ---------- */
  let ordersTab = 'active';
  function orderCard(o) {
    const b = S.business(o.businessId);
    const items = o.lines.map((l) => H.lineName(l) + ' ×' + l.qty).join(H.lang() === 'ar' ? '، ' : ', ');
    const active = S.STATUS_ACTIVE.indexOf(o.status) >= 0;
    const sched = o.slot && o.slot.type === 'scheduled';
    return '<li class="card order-card"><div class="oc-head">' + (b ? H.bizLogo(b, 'logo-40') : '') + '<strong class="grow" dir="auto">' + esc(b ? H.L(b, 'name') : '') + '</strong>' + H.statusBadge(o) + '</div>' +
      '<p class="meta"><bdi dir="ltr">#' + esc(o.id) + '</bdi> · ' + esc(U.dateTime(o.createdAt)) + (sched ? ' · <span class="badge badge-info">' + esc(t('ord.scheduled')) + ' ' + esc(H.slotText(o)) + '</span>' : '') + '</p>' +
      '<p class="oc-items" dir="auto">' + esc(items) + '</p>' +
      '<div class="oc-foot">' + U.price(o.total) + '<span class="grow"></span>' +
      (active ? '<a class="link" href="#/track/' + esc(o.id) + '">' + esc(t('trk.track')) + ' ' + H.icon('chevron', 'sm') + '</a>'
        : '<button type="button" class="btn btn-outline btn-sm" data-reorder="' + esc(o.id) + '">' + esc(t('ord.reorder')) + '</button>' +
          (o.status === 'completed' ? (o.reviewed ? '<span class="muted sm">' + esc(t('ord.reviewed')) + '</span>' : '<button type="button" class="btn btn-secondary btn-sm" data-rate="' + esc(o.id) + '">' + esc(t('ord.rate')) + '</button>') : '') +
          '<a class="icon-btn" href="#/track/' + esc(o.id) + '" aria-label="' + esc(t('trk.title')) + ' ' + esc(o.id) + '">' + H.icon('chevron') + '</a>') +
      '</div></li>';
  }
  H.route('/orders', {
    tabbar: 'customer',
    live: true,
    skeleton() { return '<main>' + H.appbar({ title: t('ord.title') }) + '<div class="pad">' + [1, 2, 3].map(() => H.skel('skel-card wide')).join('') + '</div></main>'; },
    onTick(ctx) {
      const sig = S.myOrders().map((o) => o.id + o.status).join();
      if (ctx.sig !== undefined && ctx.sig !== sig) H.rerender();
    },
    render(ctx) {
      const u = S.user();
      if (!u) {
        ctx.el.innerHTML = '<main>' + H.appbar({ title: t('ord.title') }) + H.empty({ emoji: '🔒', title: t('ord.loginPrompt'), btn: { act: 'login', label: t('auth.login') } }) + '</main>';
        return;
      }
      const all = S.myOrders();
      ctx.sig = all.map((o) => o.id + o.status).join();
      const act = all.filter((o) => S.STATUS_ACTIVE.indexOf(o.status) >= 0);
      const past = all.filter((o) => S.STATUS_ACTIVE.indexOf(o.status) < 0);
      const list = ordersTab === 'active' ? act : past;
      ctx.el.innerHTML = '<main>' + H.appbar({ title: t('ord.title') }) + '<div class="pad">' +
        H.seg('otab', [{ value: 'active', html: esc(t('ord.active', { n: act.length })) }, { value: 'past', html: esc(t('ord.past', { n: past.length })) }], ordersTab, t('ord.title')) +
        '<div role="tabpanel">' + (list.length ? '<ul class="list">' + list.map(orderCard).join('') + '</ul>'
          : ordersTab === 'active' ? H.empty({ emoji: '🛵', title: t('ord.emptyActive'), btn: { href: '#/home', label: t('ord.orderNow') } })
            : H.empty({ emoji: '🧾', title: t('ord.emptyPast'), btn: { href: '#/home', label: t('ord.orderNow') } })) + '</div></div></main>';
      const main = ctx.el.querySelector('main');
      main.addEventListener('click', (e) => {
        const sg = e.target.closest('[data-seg="otab"] [data-value]');
        if (sg) { ordersTab = sg.dataset.value; H.rerender(); const a = ctx.el.querySelector('[data-seg="otab"] [aria-selected="true"]'); if (a) a.focus(); return; }
        const r = e.target.closest('[data-reorder]');
        if (r) { const o = S.order(r.dataset.reorder); if (o) H.reorder(o); return; }
        const rt = e.target.closest('[data-rate]');
        if (rt) { const o = S.order(rt.dataset.rate); if (o) H.openReviewSheet(o.businessId, o.id, 0); }
      });
    }
  });

  /* ---------- 3.15 Favourites ---------- */
  let favTab = 'businesses';
  H.route('/favorites', {
    tabbar: 'customer',
    onFavChange(ctx) { setTimeout(() => { if (ctx.alive()) H.rerender(); }, 10); },
    render(ctx) {
      const u = S.user();
      if (!u) {
        ctx.el.innerHTML = '<main>' + H.appbar({ title: t('fav.title'), back: '#/home' }) + H.empty({ emoji: '💚', title: t('fav.loginPrompt'), btn: { act: 'login', label: t('auth.login') } }) + '</main>';
        return;
      }
      const f = S.favorites();
      const bizs = f.businesses.map((id) => S.business(id)).filter(Boolean);
      const prods = f.products.map((id) => S.product(id)).filter((p) => p && !p.hidden);
      const emptyHtml = H.empty({ emoji: '💚', title: t('fav.empty'), body: t('fav.emptyHint'), btn: { href: '#/home', label: t('cart.browse') } });
      ctx.el.innerHTML = '<main>' + H.appbar({ title: t('fav.title'), back: '#/home' }) + '<div class="pad">' +
        H.seg('ftab', [{ value: 'businesses', html: esc(t('fav.businesses')) + ' (<bdi>' + bizs.length + '</bdi>)' }, { value: 'products', html: esc(t('fav.products')) + ' (<bdi>' + prods.length + '</bdi>)' }], favTab, t('fav.title')) +
        '<div role="tabpanel">' + (favTab === 'businesses' ? (bizs.length ? '<ul class="list">' + bizs.map(H.bizRow).join('') + '</ul>' : emptyHtml)
          : (prods.length ? '<ul class="grid2">' + prods.map((p) => H.productCard(p, { showBiz: true })).join('') + '</ul>' : emptyHtml)) + '</div></div></main>';
      ctx.el.querySelector('main').addEventListener('click', (e) => {
        const sg = e.target.closest('[data-seg="ftab"] [data-value]');
        if (sg) { favTab = sg.dataset.value; H.rerender(); }
      });
    }
  });

  /* ---------- 3.16 Profile ---------- */
  function editProfileSheet() {
    const u = S.user();
    H.sheet({
      title: t('prof.editProfile'),
      html: '<form class="form" novalidate data-f><div class="field"><label class="label" for="ep-name">' + esc(t('signup.name')) + '</label><input id="ep-name" class="input" maxlength="40" value="' + esc(u.name) + '" aria-describedby="ep-name-err"><p class="err" id="ep-name-err" hidden>' + esc(t('signup.nameError')) + '</p></div>' +
        '<div class="field"><label class="label" for="ep-email">' + esc(t('signup.email')) + '</label><input id="ep-email" class="input" type="email" dir="ltr" value="' + esc(u.email || '') + '" aria-describedby="ep-email-err"><p class="err" id="ep-email-err" hidden>' + esc(t('signup.emailError')) + '</p></div>' +
        '<div class="field"><label class="label" for="ep-em">' + esc(t('signup.emirate')) + '</label><select id="ep-em" class="input">' + H.emirateOptions(u.emirate) + '</select></div>' +
        '<button type="submit" class="btn btn-primary btn-block btn-lg">' + esc(t('common.save')) + '</button></form>',
      onMount(panel, sheet) {
        panel.querySelector('[data-f]').addEventListener('submit', (e) => {
          e.preventDefault();
          const n = panel.querySelector('#ep-name'); const em = panel.querySelector('#ep-email');
          const name = n.value.trim(); const email = em.value.trim();
          const nb = name.length < 2; const ebad = email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
          panel.querySelector('#ep-name-err').hidden = !nb; n.setAttribute('aria-invalid', nb);
          panel.querySelector('#ep-email-err').hidden = !ebad; em.setAttribute('aria-invalid', !!ebad);
          if (nb) { n.focus(); return; } if (ebad) { em.focus(); return; }
          const usr = S.user(); usr.name = name; usr.email = email || undefined; usr.emirate = panel.querySelector('#ep-em').value;
          S.setUser(usr); sheet.close(true); H.toast(t('prof.saved'), { type: 'success' }); H.rerender();
        });
      }
    });
  }
  function addressesSheet() {
    const body = () => {
      const u = S.user();
      const list = (u && u.addresses) || [];
      if (!list.length) return H.empty({ emoji: '📍', title: t('prof.noAddresses') });
      return '<ul class="list">' + list.map((a) => '<li class="card addr-row"><span aria-hidden="true">' + (a.label === 'work' ? '🏢' : a.label === 'other' ? '📍' : '🏠') + '</span><div class="grow"><strong>' + esc(t('co.label.' + a.label)) + '</strong><p class="meta">' + esc(t('em.' + a.emirate)) + ' · ' + esc(H.addrText(a)) + '</p></div>' +
        '<button type="button" class="icon-btn" data-del="' + esc(a.id) + '" aria-label="' + esc(t('common.delete')) + ' ' + esc(t('co.label.' + a.label)) + '">' + H.icon('trash') + '</button></li>').join('') + '</ul>';
    };
    H.sheet({
      title: t('prof.addresses'), html: '<div data-body>' + body() + '</div>',
      onMount(panel) {
        panel.addEventListener('click', (e) => {
          const d = e.target.closest('[data-del]');
          if (!d) return;
          const u = S.user(); u.addresses = (u.addresses || []).filter((a) => a.id !== d.dataset.del); S.setUser(u);
          panel.querySelector('[data-body]').innerHTML = body();
          H.toast(t('prof.addressDeleted'));
          const c = panel.querySelector('[data-close]'); if (c) c.focus();
        });
      }
    });
  }
  H.openHelp = function () {
    H.modal({ title: t('prof.help'), html: '<dl class="faq">' + [1, 2, 3].map((n) => '<dt>' + esc(t('help.q' + n)) + '</dt><dd>' + esc(t('help.a' + n)) + '</dd>').join('') + '</dl>' });
  };
  H.route('/profile', {
    tabbar: 'customer',
    render(ctx) {
      const u = S.user();
      const row = (icon, label, attrs, extra) => '<li><' + (attrs.href ? 'a href="' + attrs.href + '"' : 'button type="button" data-row="' + attrs.act + '"') + ' class="list-row"><span class="lr-icon" aria-hidden="true">' + icon + '</span><span class="grow">' + esc(label) + '</span>' + (extra || '') + H.icon('chevron', 'sm') + '</' + (attrs.href ? 'a' : 'button') + '></li>';
      ctx.el.innerHTML = '<main>' + H.appbar({ title: t('prof.title') }) + '<div class="pad">' +
        (u ? '<div class="card profile-card"><span class="avatar big" aria-hidden="true">' + esc(u.name.charAt(0)) + '</span><div class="grow"><strong class="h3" dir="auto">' + esc(u.name) + '</strong><p class="meta"><bdi dir="ltr">' + esc(U.fmtPhone(u.phone)) + '</bdi></p>' + (u.email ? '<p class="meta" dir="ltr">' + esc(u.email) + '</p>' : '') + '</div><button type="button" class="btn btn-ghost" data-row="edit">' + esc(t('common.edit')) + '</button></div>'
          : '<div class="card guest-card"><p>' + esc(t('prof.guest')) + '</p><button type="button" class="btn btn-primary btn-block" data-act="login">' + esc(t('auth.login')) + '</button></div>') +
        '<ul class="rows card">' +
        row('🧾', t('prof.orders'), { href: '#/orders' }) +
        row('💚', t('prof.favorites'), { href: '#/favorites' }) +
        row('📍', t('prof.addresses'), { act: 'addresses' }) +
        row('🌐', t('prof.language', { lang: H.lang() === 'ar' ? 'العربية' : 'English' }), { act: 'lang' }) +
        row('⚙️', t('prof.settings'), { href: '#/settings' }) + '</ul>' +
        '<button type="button" class="card owner-card" data-row="owner"><span class="oc-emoji" aria-hidden="true">🏪</span><span class="grow"><strong>' + esc(t('prof.ownerCardTitle')) + '</strong><span class="meta">' + esc(t('prof.ownerCardCta')) + '</span></span>' + H.icon('chevron') + '</button>' +
        '<ul class="rows card">' + row('❓', t('prof.help'), { act: 'help' }) + '</ul>' +
        '<p class="center muted version">' + esc(t('prof.version')) + '</p></div></main>';
      ctx.el.querySelector('main').addEventListener('click', (e) => {
        const r = e.target.closest('[data-row]');
        if (!r) return;
        const a = r.dataset.row;
        if (a === 'edit') editProfileSheet();
        else if (a === 'addresses') { if (!S.user()) H.requireLogin('#/profile'); else addressesSheet(); }
        else if (a === 'lang') H.toggleLang();
        else if (a === 'help') H.openHelp();
        else if (a === 'owner') { if (!S.user()) H.requireLogin('#/owner/select'); else H.go('#/owner/select'); }
      });
    }
  });

  /* ---------- 3.17 Settings ---------- */
  H.route('/settings', {
    render(ctx) {
      const p = S.prefs();
      const u = S.user();
      ctx.el.innerHTML = '<main>' + H.appbar({ title: t('set.title'), back: '#/profile' }) + '<div class="pad">' +
        (H.store.isMemory() ? '<p class="info-strip warning">' + esc(t('set.memoryNote')) + '</p>' : '') +
        '<ul class="rows card">' +
        '<li class="list-row static"><span class="lr-icon" aria-hidden="true">🌐</span><span class="grow" id="set-lang">' + esc(t('set.language')) + '</span>' + H.seg('lang', [{ value: 'ar', html: '<span lang="ar">العربية</span>' }, { value: 'en', html: '<span lang="en">English</span>' }], H.lang(), t('set.language')) + '</li>' +
        '<li class="list-row static"><span class="lr-icon" aria-hidden="true">🔔</span><label class="grow" for="sw-notif">' + esc(t('set.notifications')) + '</label>' + H.sw({ id: 'sw-notif', on: p.notifications, data: ' data-pref="notifications"' }) + '</li>' +
        '<li class="list-row static"><span class="lr-icon" aria-hidden="true">⏱️</span><span class="grow"><label for="sw-auto">' + esc(t('set.autoAdvance')) + '</label><span class="meta" id="sw-auto-hint">' + esc(t('set.autoAdvanceHint')) + '</span></span>' + H.sw({ id: 'sw-auto', on: p.autoAdvance, data: ' data-pref="autoAdvance" aria-describedby="sw-auto-hint"' }) + '</li>' +
        '<li class="list-row static col"><span class="row-inline"><span class="lr-icon" aria-hidden="true">🎨</span><span class="grow">' + esc(t('set.appearance')) + '</span></span>' + H.seg('theme', [{ value: 'light', html: esc(t('set.light')) }, { value: 'dark', html: esc(t('set.dark')) }, { value: 'auto', html: esc(t('set.auto')) }], p.theme, t('set.appearance')) + '</li>' +
        '</ul>' +
        (H.pwa && !H.pwa.isStandalone() ? '<ul class="rows card"><li><button type="button" class="list-row" data-install><span class="lr-icon" aria-hidden="true">📲</span><span class="grow"><span>' + esc(t('pwa.row')) + '</span><span class="meta">' + esc(t('pwa.rowHint')) + '</span></span>' + H.icon('chevron', 'sm') + '</button></li></ul>' : '') +
        '<ul class="rows card">' +
        '<li><button type="button" class="list-row danger-text" data-reset><span class="lr-icon" aria-hidden="true">♻️</span><span class="grow">' + esc(t('set.reset')) + '</span></button></li>' +
        (u ? '<li><button type="button" class="list-row danger-text" data-logout><span class="lr-icon" aria-hidden="true">🚪</span><span class="grow">' + esc(t('set.logout')) + '</span></button></li>' : '') +
        '</ul><p class="center muted footer-note">' + esc(t('set.footer')) + '</p></div></main>';
      const main = ctx.el.querySelector('main');
      main.querySelectorAll('[data-pref]').forEach((sw) => {
        sw.addEventListener('toggle', (e) => { const patch = {}; patch[sw.dataset.pref] = e.detail.on; S.setPrefs(patch); });
      });
      main.addEventListener('click', async (e) => {
        const sg = e.target.closest('[data-seg] [data-value]');
        if (sg) {
          const name = sg.closest('[data-seg]').dataset.seg;
          if (name === 'lang') { H.setLang(sg.dataset.value); return; }
          if (name === 'theme') { S.setPrefs({ theme: sg.dataset.value }); H.applyTheme(); H.rerender(); const a = ctx.el.querySelector('[data-seg="theme"] [data-value="' + sg.dataset.value + '"]'); if (a) a.focus(); }
          return;
        }
        if (e.target.closest('[data-install]')) { H.pwa.install(); return; }
        if (e.target.closest('[data-reset]')) {
          if (await H.confirm({ title: t('set.reset'), body: t('set.resetConfirm'), ok: t('set.reset'), danger: true })) {
            S.resetDemo();
            H.mem.visited = {}; H.mem.bizTab = {};
            if (!H.store.isMemory()) { H.store.set('hawwi.flash', 'reset'); location.hash = '#/home'; location.reload(); return; }
            H.applyTheme(); H.go('#/home', { replace: true }); H.toast(t('set.resetDone'), { type: 'success' });
          }
          return;
        }
        if (e.target.closest('[data-logout]')) {
          if (await H.confirm({ title: t('set.logoutConfirm'), ok: t('set.logout'), danger: true })) {
            S.setUser(null); S.setPrefs({ ownerMode: false });
            H.go('#/home', { replace: true });
          }
        }
      });
    }
  });
})();
