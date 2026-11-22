/* Hawwi views: home, search/category, business page, product details */
(function () {
  'use strict';
  const H = window.H;
  const U = H.U;
  const S = H.S;
  const esc = U.esc;
  const t = (k, v) => H.t(k, v);

  const isOpenish = (b) => { const s = U.openState(b).state; return s === 'open' || s === 'closing'; };
  const byOpenThenRating = (a, b) => (isOpenish(b) - isOpenish(a)) || (b.rating - a.rating) || (b.reviewCount - a.reviewCount);

  function catChips(active, mode) {
    const all = [{ id: '', emoji: '', label: t('cat.all') }].concat(H.SEED.categories.map((c) => ({ id: c.id, emoji: c.emoji, label: t('cat.' + c.id) })));
    return '<div class="chip-row" role="' + (mode === 'filter' ? 'group' : 'navigation') + '" aria-label="' + esc(t('cat.all')) + '">' + all.map((c) => {
      const on = (active || '') === c.id;
      const inner = (c.emoji ? '<span aria-hidden="true">' + c.emoji + '</span> ' : '') + esc(c.label);
      if (mode === 'filter') return '<button type="button" class="chip' + (on ? ' on' : '') + '" aria-pressed="' + on + '" data-cat="' + c.id + '">' + inner + '</button>';
      return '<a class="chip' + (on ? ' on' : '') + '" href="' + (c.id ? '#/category/' + c.id : '#/search') + '">' + inner + '</a>';
    }).join('') + '</div>';
  }

  /* ---------- 3.6 Home ---------- */
  function homeBusinesses() {
    const p = S.prefs();
    let list = S.businesses();
    if (p.emirate && p.emirate !== 'all') list = list.filter((b) => b.emirate === p.emirate);
    list.sort(byOpenThenRating);
    if (p.area) {
      const inArea = list.filter((b) => b.areaAr === p.area || b.areaEn === p.area);
      list = inArea.concat(list.filter((b) => inArea.indexOf(b) < 0));
    }
    return list;
  }
  function locationLabel() {
    const p = S.prefs();
    let s = t('em.' + (p.emirate || 'all'));
    if (p.area && p.emirate !== 'all') {
      const b = S.businesses().find((x) => x.areaAr === p.area || x.areaEn === p.area);
      s += (H.lang() === 'ar' ? '، ' : ', ') + (b ? H.L(b, 'area') : p.area);
    }
    return s;
  }
  H.openLocationSheet = function (onDone) {
    const body = () => {
      const p = S.prefs();
      const ems = ['all'].concat(H.SEED.emirates);
      return '<div role="radiogroup" aria-label="' + esc(t('home.chooseLocation')) + '" class="radio-list">' + ems.map((e) => {
        const on = (p.emirate || 'all') === e;
        let areas = '';
        if (on && e !== 'all') {
          const seen = {};
          const list = S.businesses().filter((b) => b.emirate === e && !seen[b.areaAr] && (seen[b.areaAr] = 1));
          areas = '<div class="chip-wrap area-chips"><button type="button" class="chip' + (!p.area ? ' on' : '') + '" aria-pressed="' + !p.area + '" data-area="">' + esc(t('home.allAreas')) + '</button>' +
            list.map((b) => '<button type="button" class="chip' + (p.area === b.areaAr ? ' on' : '') + '" aria-pressed="' + (p.area === b.areaAr) + '" data-area="' + esc(b.areaAr) + '">' + esc(H.L(b, 'area')) + '</button>').join('') + '</div>';
        }
        return '<label class="radio-row"><input type="radio" name="em" value="' + e + '"' + (on ? ' checked' : '') + '><span>' + esc(t('em.' + e)) + '</span></label>' + areas;
      }).join('') + '</div>';
    };
    H.sheet({
      title: t('home.chooseLocation'), html: '<div data-locbody>' + body() + '</div>',
      onMount(panel, sheet) {
        const wrap = panel.querySelector('[data-locbody]');
        wrap.addEventListener('change', (e) => {
          if (e.target.name === 'em') {
            S.setPrefs({ emirate: e.target.value, area: null });
            wrap.innerHTML = body();
            const r = wrap.querySelector('input[value="' + e.target.value + '"]'); if (r) r.focus();
            if (onDone) onDone();
            if (e.target.value === 'all') sheet.close(true);
          }
        });
        wrap.addEventListener('click', (e) => {
          const a = e.target.closest('[data-area]');
          if (!a) return;
          S.setPrefs({ area: a.dataset.area || null });
          sheet.close(true);
          if (onDone) onDone();
        });
      }
    });
  };

  H.route('/home', {
    tabbar: 'customer',
    skeleton() {
      return '<main class="home"><div class="home-head pattern">' + H.skel('skel-line w60') + H.skel('skel-line w40') + H.skel('skel-input') + '</div>' +
        '<div class="chip-row">' + H.skel('skel-chip') + H.skel('skel-chip') + H.skel('skel-chip') + '</div>' +
        '<div class="pad">' + H.skel('skel-feat') + '<div class="list">' + [1, 2, 3, 4].map(() => '<div class="card skel-row">' + H.skel('skel-logo') + '<div class="grow">' + H.skel('skel-line w60') + H.skel('skel-line w40') + '</div></div>').join('') + '</div></div></main>';
    },
    onFavChange() { /* hearts update in place */ },
    render(ctx) {
      const u = S.user();
      const p = S.prefs();
      const g = U.greetingKey();
      const greet = t(g[0]) + (u ? (H.lang() === 'ar' ? '، ' : ', ') + U.firstName(u.name) : '');
      const list = homeBusinesses();
      let featured = list.filter((b) => b.featured);
      if (!featured.length) featured = S.businesses().filter((b) => b.featured);
      const greetHtml = u ? esc(greet) : esc(t('home.guest'));
      ctx.el.innerHTML = '<main class="home"><div class="home-head pattern">' +
        '<div class="home-top"><h1 class="greet" tabindex="-1">' + greetHtml + ' <span aria-hidden="true">' + g[1] + '</span></h1>' +
        '<div class="home-icons"><a class="icon-btn on-dark" href="#/favorites" aria-label="' + esc(t('fav.title')) + '">' + H.icon('heart') + '</a>' +
        '<button type="button" class="icon-btn on-dark" data-bell aria-label="' + esc(t('home.notifications')) + '">' + H.icon('bell') + '</button></div></div>' +
        '<button type="button" class="loc-btn" data-loc>' + H.icon('pin', 'sm') + ' <span>' + esc(t('home.deliverTo')) + ' <strong>' + esc(locationLabel()) + '</strong></span> ' + H.icon('chevDown', 'sm') + '</button>' +
        '<a class="search-fake" href="#/search?focus=1">' + H.icon('search') + '<span>' + esc(t('home.searchPlaceholder')) + '</span></a></div>' +
        catChips('', 'link') +
        (list.length ? (
          '<section class="sec" aria-labelledby="feat-h"><div class="sec-head"><h2 id="feat-h" class="h2">' + esc(t('home.featured')) + '</h2><a class="link" href="#/search?sort=rating">' + esc(t('common.seeAll')) + '</a></div>' +
          '<div class="carousel" aria-roledescription="carousel" aria-labelledby="feat-h"><button type="button" class="sr-focusable car-pause" data-pause aria-label="' + esc(t('common.pause')) + '">' + H.icon('pause', 'sm') + '</button>' +
          '<ul class="car-track" data-track>' + featured.map((b, i) => H.featuredCard(b, i, featured.length)).join('') + '</ul>' +
          '<div class="car-dots" aria-hidden="true">' + featured.map((b, i) => '<span class="dot' + (i === 0 ? ' active' : '') + '"></span>').join('') + '</div></div></section>' +
          '<section class="sec pad" aria-labelledby="near-h"><div class="sec-head"><h2 id="near-h" class="h2">' + esc(t('home.nearby')) + '</h2><span class="muted">(<bdi>' + list.length + '</bdi>)</span></div>' +
          '<ul class="list">' + list.map(H.bizRow).join('') + '</ul></section>')
          : H.empty({ emoji: '🏜️', title: t('home.noBusinesses'), btn: { act: 'all-emirates', label: t('home.showAllEmirates') } })) +
        '</main>';
      ctx.el.querySelector('[data-bell]').addEventListener('click', () => H.toast(t(p.notifications ? 'home.noNotifications' : 'home.notificationsOff'), { emoji: '🔔' }));
      ctx.el.querySelector('[data-loc]').addEventListener('click', () => H.openLocationSheet(() => ctx.rerender()));
      const allBtn = ctx.el.querySelector('[data-act="all-emirates"]');
      if (allBtn) allBtn.addEventListener('click', () => { S.setPrefs({ emirate: 'all', area: null }); ctx.rerender(); });
      setupCarousel(ctx);
    }
  });

  function setupCarousel(ctx) {
    const track = ctx.el.querySelector('[data-track]');
    if (!track) return;
    const cards = Array.from(track.children);
    const dots = Array.from(ctx.el.querySelectorAll('.car-dots .dot'));
    let idx = 0; let paused = U.reduced(); let userPaused = false;
    const pauseBtn = ctx.el.querySelector('[data-pause]');
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((en) => { if (en.isIntersecting && en.intersectionRatio > 0.6) { idx = +en.target.dataset.i; dots.forEach((d, i) => d.classList.toggle('active', i === idx)); } });
      }, { root: track, threshold: [0.6] });
      cards.forEach((c) => io.observe(c));
      const prev = ctx.cleanup; ctx.cleanup = () => { io.disconnect(); if (prev) prev(); };
    }
    const hold = () => { paused = true; }; const release = () => { paused = U.reduced() || userPaused; };
    track.addEventListener('pointerenter', hold); track.addEventListener('pointerleave', release);
    track.addEventListener('touchstart', hold, { passive: true }); track.addEventListener('touchend', () => setTimeout(release, 3000));
    track.addEventListener('focusin', hold); track.addEventListener('focusout', release);
    pauseBtn.addEventListener('click', () => {
      userPaused = !userPaused; paused = userPaused || U.reduced();
      pauseBtn.setAttribute('aria-label', t(userPaused ? 'common.play' : 'common.pause'));
      pauseBtn.innerHTML = H.icon(userPaused ? 'play' : 'pause', 'sm');
    });
    const iv = setInterval(() => {
      if (paused || cards.length < 2 || !ctx.alive()) return;
      const n = (idx + 1) % cards.length;
      const c = cards[n];
      const sign = document.documentElement.dir === 'rtl' ? -1 : 1;
      const offset = Math.abs(c.offsetLeft - cards[0].offsetLeft);
      track.scrollTo({ left: sign * offset, behavior: 'smooth' });
      idx = n;
    }, 5000);
    const prev2 = ctx.cleanup; ctx.cleanup = () => { clearInterval(iv); if (prev2) prev2(); };
  }

  /* ---------- 3.7 Search ---------- */
  function searchView(ctx, presetCat) {
    const q0 = ctx.query;
    const p = S.prefs();
    const st = {
      q: q0.q || '', cat: presetCat || q0.cat || '', emirate: q0.emirate || (p.emirate && p.emirate !== 'all' ? p.emirate : 'all'),
      sort: q0.sort || 'rating', open: q0.open === '1', delivery: q0.delivery === '1'
    };
    if (!q0.emirate && presetCat) st.emirate = 'all';
    const sortLabels = { rating: t('sort.rating'), nearest: t('sort.nearest'), price: t('sort.price'), reviews: t('sort.reviews') };
    ctx.el.innerHTML = '<main class="search"><header class="appbar search-bar"><button type="button" class="icon-btn" data-back="#/home" aria-label="' + esc(t('common.back')) + '">' + H.icon('back') + '</button>' +
      '<h1 class="sr-only" tabindex="-1">' + esc(t('search.title')) + '</h1>' +
      '<div class="search-field">' + H.icon('search') + '<input id="sq" type="search" class="search-input" enterkeyhint="search" placeholder="' + esc(t('search.placeholder')) + '" aria-label="' + esc(t('search.placeholder')) + '" value="' + esc(st.q) + '">' +
      '<button type="button" class="icon-btn sm" data-clear aria-label="' + esc(t('search.clear')) + '"' + (st.q ? '' : ' hidden') + '>' + H.icon('close') + '</button></div></header>' +
      '<div data-cats></div>' +
      '<div class="chip-row filters">' +
      '<label class="chip chip-select">📍 <select data-f="emirate" aria-label="' + esc(t('signup.emirate')) + '">' + H.emirateOptions(st.emirate, true) + '</select>' + H.icon('chevDown', 'sm') + '</label>' +
      '<label class="chip chip-select"><span data-sortlbl>' + esc(t('search.sort', { x: '' })) + '</span><select data-f="sort" aria-label="' + esc(t('search.sortTitle')) + '">' + Object.keys(sortLabels).map((k) => '<option value="' + k + '"' + (k === st.sort ? ' selected' : '') + '>' + esc(sortLabels[k]) + '</option>').join('') + '</select>' + H.icon('chevDown', 'sm') + '</label>' +
      '<button type="button" class="chip" data-toggle="open" aria-pressed="' + st.open + '">' + esc(t('filter.openNow')) + '</button>' +
      '<button type="button" class="chip" data-toggle="delivery" aria-pressed="' + st.delivery + '">' + esc(t('filter.delivery')) + '</button></div>' +
      '<div class="pad" data-results aria-live="polite"></div></main>';
    const input = ctx.el.querySelector('#sq');
    const results = ctx.el.querySelector('[data-results]');
    const syncChips = () => {
      ctx.el.querySelector('[data-cats]').innerHTML = catChips(st.cat, 'filter');
      ctx.el.querySelectorAll('[data-toggle]').forEach((b) => { const on = st[b.dataset.toggle]; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
      ctx.el.querySelector('[data-clear]').hidden = !st.q;
    };
    const updateHash = () => {
      const qs = U.buildQuery({ q: st.q, cat: st.cat, emirate: st.emirate !== 'all' ? st.emirate : '', sort: st.sort !== 'rating' ? st.sort : '', open: st.open, delivery: st.delivery });
      try { history.replaceState(null, '', '#/search' + qs); } catch (e) { /* ignore */ }
    };
    const run = () => { results.innerHTML = searchResults(st); syncChips(); };
    const commit = U.debounce(() => {
      if (!ctx.alive()) return;
      updateHash(); run();
      const q = st.q.trim();
      if (q.length >= 2) { const r = H.mem.recentSearches.filter((x) => x !== q); r.unshift(q); H.mem.recentSearches = r.slice(0, 5); }
    }, 250);
    input.addEventListener('input', () => { st.q = input.value; ctx.el.querySelector('[data-clear]').hidden = !st.q; commit(); });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); input.blur(); } });
    ctx.el.querySelector('[data-clear]').addEventListener('click', () => { st.q = ''; input.value = ''; updateHash(); run(); input.focus(); });
    ctx.el.querySelector('main').addEventListener('click', (e) => {
      const c = e.target.closest('[data-cat]');
      if (c) { st.cat = c.dataset.cat; updateHash(); run(); return; }
      const tg = e.target.closest('[data-toggle]');
      if (tg) { st[tg.dataset.toggle] = !st[tg.dataset.toggle]; updateHash(); run(); return; }
      const pop = e.target.closest('[data-pop]');
      if (pop) { st.q = pop.dataset.pop; input.value = st.q; updateHash(); run(); return; }
      if (e.target.closest('[data-act="clear-filters"]')) {
        Object.assign(st, { q: '', cat: '', emirate: 'all', sort: 'rating', open: false, delivery: false });
        input.value = ''; ctx.el.querySelector('[data-f="emirate"]').value = 'all'; ctx.el.querySelector('[data-f="sort"]').value = 'rating';
        updateHash(); run();
      }
    });
    ctx.el.querySelectorAll('[data-f]').forEach((sel) => sel.addEventListener('change', () => { st[sel.dataset.f] = sel.value; updateHash(); run(); }));
    run();
    if (q0.focus === '1') setTimeout(() => { if (ctx.alive()) input.focus(); }, 30);
  }

  function searchResults(st) {
    const q = U.norm(st.q);
    const prefs = S.prefs();
    // the emirate dropdown defaults to the user's emirate, so it does not count as an active filter here
    const noFilters = !q && !st.cat && !st.open && !st.delivery;
    if (noFilters) {
      const pop = H.SEED.popular[H.lang()];
      const recent = H.mem.recentSearches;
      return (recent.length ? '<h2 class="h3">' + esc(t('search.recent')) + '</h2><div class="chip-wrap">' + recent.map((r) => '<button type="button" class="chip" data-pop="' + esc(r) + '">🕘 ' + esc(r) + '</button>').join('') + '</div>' : '') +
        '<h2 class="h3">' + esc(t('search.popular')) + '</h2><div class="chip-wrap">' + pop.map((r) => '<button type="button" class="chip" data-pop="' + esc(r) + '">' + esc(r) + '</button>').join('') + '</div>' +
        '<h2 class="h3 mt">' + esc(t('home.nearby')) + '</h2><ul class="list">' + S.businesses().filter((b) => st.emirate === 'all' || b.emirate === st.emirate).sort(byOpenThenRating).map(H.bizRow).join('') + '</ul>';
    }
    let bizs = S.businesses().filter((b) => {
      if (st.cat && b.category !== st.cat) return false;
      if (st.emirate !== 'all' && b.emirate !== st.emirate) return false;
      if (st.open && !isOpenish(b)) return false;
      if (st.delivery && !b.delivery) return false;
      return true;
    });
    const bizIds = bizs.map((b) => b.id);
    const bizMatch = (b) => !q || [b.nameAr, b.nameEn, b.tags, b.ownerAr, b.ownerEn].some((s) => U.norm(s).indexOf(q) >= 0);
    let prods = S.allProducts().filter((p) => !p.hidden && bizIds.indexOf(p.businessId) >= 0 && (!q || [p.nameAr, p.nameEn].some((s) => U.norm(s).indexOf(q) >= 0)));
    if (!q) prods = st.cat ? prods : [];
    bizs = bizs.filter(bizMatch);
    const near = (b) => (b.emirate === prefs.emirate ? 2 : 0) + (prefs.area && (b.areaAr === prefs.area) ? 1 : 0);
    const bizSort = {
      rating: (a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount,
      nearest: (a, b) => near(b) - near(a) || b.rating - a.rating,
      price: (a, b) => b.rating - a.rating,
      reviews: (a, b) => b.reviewCount - a.reviewCount
    }[st.sort] || ((a, b) => b.rating - a.rating);
    bizs.sort(bizSort);
    const bmap = {}; S.businesses().forEach((b) => { bmap[b.id] = b; });
    if (st.sort === 'price') prods.sort((a, b) => a.price - b.price);
    else prods.sort((a, b) => bizSort(bmap[a.businessId], bmap[b.businessId]));
    if (!bizs.length && !prods.length) {
      return H.empty({ emoji: '🔍', title: st.q ? t('search.noResults', { q: st.q }) : t('home.noBusinesses'), body: t('search.noResultsHint'), btn: { act: 'clear-filters', label: t('search.clearFilters') } });
    }
    return (bizs.length ? '<h2 class="h3">' + esc(t('search.businesses', { n: bizs.length })) + '</h2><ul class="list">' + bizs.map(H.bizRow).join('') + '</ul>' : '') +
      (prods.length ? '<h2 class="h3 mt">' + esc(t('search.products', { n: prods.length })) + '</h2><ul class="grid2">' + prods.slice(0, 60).map((p) => H.productCard(p, { showBiz: true })).join('') + '</ul>' : '');
  }

  H.route('/search', { tabbar: 'customer', skeleton: searchSkeleton, render: (ctx) => searchView(ctx, '') });
  H.route('/category/:catId', {
    tabbar: 'customer',
    render(ctx) {
      const ok = H.SEED.categories.some((c) => c.id === ctx.params.catId);
      searchView(ctx, ok ? ctx.params.catId : '');
    }
  });
  function searchSkeleton() {
    return '<main class="search"><div class="appbar">' + H.skel('skel-input') + '</div><div class="chip-row">' + H.skel('skel-chip') + H.skel('skel-chip') + H.skel('skel-chip') + '</div><div class="pad list">' +
      [1, 2, 3].map(() => '<div class="card skel-row">' + H.skel('skel-logo') + '<div class="grow">' + H.skel('skel-line w60') + H.skel('skel-line w40') + '</div></div>').join('') + '</div></main>';
  }

  /* ---------- 3.8 Business page ---------- */
  function notFound(ctx, emoji, key) {
    ctx.el.innerHTML = '<main>' + H.appbar({ title: '', back: '#/home' }) + '<h1 class="sr-only" tabindex="-1">' + esc(t(key)) + '</h1>' + H.empty({ emoji, title: t(key), btn: { href: '#/home', label: t('common.goHome') } }) + '</main>';
  }
  H.notFound = notFound;

  function hoursTable(b) {
    const today = U.satIndex(new Date());
    return '<table class="hours-table"><caption class="sr-only">' + esc(t('biz.hours')) + '</caption><tbody>' + H.DAY_KEYS.map((k, i) => {
      const e = b.hours[i];
      return '<tr class="' + (i === today ? 'today' : '') + '"><th scope="row">' + esc(t(k)) + '</th><td>' + (e ? '<bdi>' + esc(U.fmtTimeStr(e[0])) + ' – ' + esc(U.fmtTimeStr(e[1])) + '</bdi>' : esc(t('biz.closed'))) + '</td></tr>';
    }).join('') + '</tbody></table>';
  }

  function cartBar(bid) {
    const c = S.cart();
    if (c.businessId !== bid || !c.lines.length) return '';
    const cc = S.computeCart();
    if (!cc.lines.length) return '';
    return '<a class="cart-bar" href="#/cart"><span><span aria-hidden="true">🛍️</span> <bdi>' + cc.count + '</bdi> · ' + esc(t('biz.viewCart')) + '</span>' + U.price(cc.subtotal) + '</a>';
  }

  function reviewsPanel(b) {
    const list = S.reviews(b.id);
    const dist = S.starDist(b.rating);
    const canRev = H.canReview(b.id);
    return '<div class="rev-summary card"><div class="rev-big"><span class="rev-avg"><bdi>' + esc(Number(b.rating).toFixed(1)) + '</bdi></span>' + H.starsDisplay(b.rating, b.reviewCount) +
      '<span class="muted">' + esc(t('biz.reviewsCount', { n: b.reviewCount })) + '</span></div><div class="rev-bars">' +
      [5, 4, 3, 2, 1].map((s, i) => '<div class="rev-bar-row"><bdi>' + s + '★</bdi><span class="rev-bar"><span style="width:' + dist[i] + '%"></span></span><bdi class="muted">' + dist[i] + '%</bdi></div>').join('') + '</div></div>' +
      (canRev ? '<button type="button" class="btn btn-outline btn-block" data-write-review="' + esc(canRev.id) + '">✍️ ' + esc(t('rev.writeReview')) + '</button>' : '') +
      (list.length ? '<ul class="rev-list">' + list.map((r) => {
        const author = H.L(r, 'author');
        const orig = r.lang === 'en' ? r.textEn : r.textAr;
        const other = r.lang === 'en' ? r.textAr : r.textEn;
        const canTr = other && other !== orig;
        return '<li class="rev"><span class="avatar" aria-hidden="true">' + esc(author.charAt(0)) + '</span><div class="grow"><div class="rev-head"><strong dir="auto">' + esc(author) + '</strong><span class="muted">' + esc(U.relDate(r.createdAt)) + '</span></div>' +
          H.starsDisplay(r.stars, null) + '<p class="rev-text" lang="' + r.lang + '" dir="auto" data-orig="' + esc(orig) + '" data-other="' + esc(other || '') + '" data-olang="' + r.lang + '">' + esc(orig) + '</p>' +
          (canTr ? '<button type="button" class="link-btn sm" data-tr>' + esc(t('rev.translate')) + '</button>' : '') + '</div></li>';
      }).join('') + '</ul>' : H.empty({ emoji: '⭐', title: t('rev.none') }));
  }

  function aboutPanel(b) {
    const row = (icon, label, val) => '<div class="about-row"><span class="about-icon" aria-hidden="true">' + icon + '</span><div><span class="label">' + esc(label) + '</span><div>' + val + '</div></div></div>';
    const ful = [];
    if (b.pickup) ful.push(esc(t('biz.pickupFrom', { area: H.L(b, 'area') })));
    if (b.delivery) ful.push((b.deliveryFee > 0 ? esc(t('biz.deliveryFee', { fee: '' })) + U.price(b.deliveryFee) : esc(t('biz.freeDelivery'))) + ' · ' + esc(t('biz.minOrder', { amount: '' })) + U.price(b.minOrder));
    else ful.push(esc(t('biz.noDelivery')));
    ful.push(esc(t('biz.prepTime', { n: b.prep })));
    return '<div class="card about"><p dir="auto">' + esc(H.L(b, 'bio')) + '</p>' +
      row('👤', t('biz.owner'), '<span dir="auto">' + esc(H.L(b, 'owner')) + '</span>') +
      row('📍', t('biz.location'), esc(H.L(b, 'area')) + (H.lang() === 'ar' ? '، ' : ', ') + esc(t('em.' + b.emirate))) +
      row('🛵', t('biz.fulfilment'), ful.join('<br>')) +
      row('🕘', t('biz.hours'), hoursTable(b)) +
      '<p class="licensed">✅ ' + esc(t('biz.licensed')) + '</p></div>';
  }

  function productsPanel(b, section) {
    const prods = S.products(b.id);
    if (!prods.length) return H.empty({ emoji: '🧺', title: t('biz.noProducts') });
    const secs = []; const seen = {};
    prods.forEach((p) => { const k = p.section && p.section.ar; if (k && !seen[k]) { seen[k] = 1; secs.push(p.section); } });
    const shown = section ? prods.filter((p) => p.section && p.section.ar === section) : prods;
    return '<div class="chip-row inner" role="group" aria-label="' + esc(t('biz.sections')) + '"><button type="button" class="chip' + (!section ? ' on' : '') + '" aria-pressed="' + !section + '" data-sec="">' + esc(t('cat.all')) + '</button>' +
      secs.map((s) => '<button type="button" class="chip' + (section === s.ar ? ' on' : '') + '" aria-pressed="' + (section === s.ar) + '" data-sec="' + esc(s.ar) + '">' + esc(H.lang() === 'en' ? s.en : s.ar) + '</button>').join('') + '</div>' +
      '<ul class="grid2">' + shown.map((p) => H.productCard(p)).join('') + '</ul>';
  }

  function businessView(ctx, forceTab) {
    const b = S.business(ctx.params.id);
    if (!b) { notFound(ctx, '🏚️', 'biz.notFound'); return; }
    const tab = forceTab || H.mem.bizTab[b.id] || 'products';
    H.mem.bizTab[b.id] = tab;
    let section = '';
    const g = S.gradient(b);
    const name = H.L(b, 'name');
    const st = U.openState(b);
    const today = b.hours[U.satIndex(new Date())];
    const backTo = S.prefs().ownerMode ? '#/owner/profile' : '#/home';
    ctx.el.innerHTML = '<main class="biz">' +
      '<div class="cover pattern" style="--g1:' + g[0] + ';--g2:' + g[1] + '"><span class="cover-emoji" aria-hidden="true">' + esc(b.logo) + '</span>' +
      '<div class="cover-btns"><button type="button" class="icon-btn glass" data-back="' + backTo + '" aria-label="' + esc(t('common.back')) + '">' + H.icon('back') + '</button><span class="grow"></span>' +
      H.heartBtn('businesses', b.id, name, 'glass') +
      '<button type="button" class="icon-btn glass" data-share aria-label="' + esc(t('common.share')) + '">' + H.icon('share') + '</button></div></div>' +
      '<div class="biz-head pad">' + H.bizLogo(b, 'logo-72 overlap') +
      '<div class="biz-title"><h1 class="h1" dir="auto" tabindex="-1">' + esc(name) + '</h1>' + U.openBadge(b) + '</div>' +
      '<p class="meta"><span dir="auto">' + esc(H.L(b, 'owner')) + '</span> · <span>' + esc(H.L(b, 'area')) + (H.lang() === 'ar' ? '، ' : ', ') + esc(t('em.' + b.emirate)) + '</span></p>' +
      '<p class="meta">' + H.ratingCompact(b) + (b.delivery ? ' · 🛵 ' + (b.deliveryFee > 0 ? esc(t('biz.deliveryFee', { fee: '' })) + U.price(b.deliveryFee) : esc(t('biz.freeDelivery'))) : '') + (b.pickup ? ' · 🏃 ' + esc(t('biz.pickup')) : '') + '</p>' +
      '<details class="hours"><summary>' + H.icon('clock', 'sm') + ' <span>' + esc(t('biz.today')) + ' ' + (today ? '<bdi>' + esc(U.fmtTimeStr(today[0])) + ' – ' + esc(U.fmtTimeStr(today[1])) + '</bdi>' : esc(t('biz.closed'))) + '</span>' + H.icon('chevDown', 'sm chev') + '</summary>' + hoursTable(b) + '</details>' +
      (st.state === 'paused' ? '<p class="info-strip danger">⏸️ ' + esc(t('cart.paused')) + '</p>' : '') +
      '</div>' +
      '<div class="tabs-u" role="tablist" aria-label="' + esc(name) + '">' +
      ['products', 'reviews', 'about'].map((k) => '<button type="button" role="tab" id="tab-' + k + '" aria-controls="panel" aria-selected="' + (tab === k) + '" tabindex="' + (tab === k ? 0 : -1) + '" data-tab="' + k + '">' + esc(t('biz.tab.' + k)) + '</button>').join('') + '</div>' +
      '<div class="pad panel" id="panel" role="tabpanel" aria-labelledby="tab-' + tab + '" data-panel></div>' +
      '<div class="sticky-bottom" data-cartbar>' + cartBar(b.id) + '</div></main>';
    const panel = ctx.el.querySelector('[data-panel]');
    const drawPanel = (k) => {
      panel.setAttribute('aria-labelledby', 'tab-' + k);
      panel.innerHTML = k === 'reviews' ? reviewsPanel(b) : k === 'about' ? aboutPanel(b) : productsPanel(b, section);
    };
    drawPanel(tab);
    ctx.el.querySelectorAll('[data-tab]').forEach((btn) => btn.addEventListener('click', () => {
      const k = btn.dataset.tab;
      H.mem.bizTab[b.id] = k;
      ctx.el.querySelectorAll('[data-tab]').forEach((x) => { x.setAttribute('aria-selected', x === btn); x.tabIndex = x === btn ? 0 : -1; });
      drawPanel(k);
    }));
    panel.addEventListener('click', (e) => {
      const sec = e.target.closest('[data-sec]');
      if (sec) { section = sec.dataset.sec; drawPanel('products'); return; }
      const tr = e.target.closest('[data-tr]');
      if (tr) {
        const p = tr.previousElementSibling;
        const showingOrig = !p.dataset.swapped;
        p.textContent = showingOrig ? p.dataset.other : p.dataset.orig;
        p.setAttribute('lang', showingOrig ? (p.dataset.olang === 'en' ? 'ar' : 'en') : p.dataset.olang);
        if (showingOrig) p.dataset.swapped = '1'; else delete p.dataset.swapped;
        tr.textContent = t(showingOrig ? 'rev.original' : 'rev.translate');
        return;
      }
      const wr = e.target.closest('[data-write-review]');
      if (wr) H.openReviewSheet(b.id, wr.dataset.writeReview, 0);
    });
    ctx.el.querySelector('[data-share]').addEventListener('click', async () => {
      const url = location.href;
      if (navigator.share) { try { await navigator.share({ title: name, url }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
      try { await navigator.clipboard.writeText(url); } catch (e) { /* clipboard may be blocked */ }
      H.toast(t('common.linkCopied'), { type: 'success' });
    });
  }
  const bizRoute = {
    skeleton() {
      return '<main class="biz">' + H.skel('skel-cover') + '<div class="pad">' + H.skel('skel-logo big') + H.skel('skel-line w60') + H.skel('skel-line w40') + H.skel('skel-line w80') +
        '<div class="grid2">' + [1, 2, 3, 4].map(() => H.skel('skel-card')).join('') + '</div></div></main>';
    },
    onCartChange(ctx) { const el = ctx.el.querySelector('[data-cartbar]'); if (el) el.innerHTML = cartBar(ctx.params.id); }
  };
  H.route('/business/:id', Object.assign({}, bizRoute, { render: (ctx) => businessView(ctx) }));
  H.route('/business/:id/reviews', Object.assign({}, bizRoute, { skeleton: null, render: (ctx) => businessView(ctx, 'reviews') }));

  /* ---------- 3.9 Product details ---------- */
  H.route('/product/:bid/:pid', {
    cls: 'has-footer',
    skeleton() { return '<main>' + H.skel('skel-hero') + '<div class="pad">' + H.skel('skel-line w60') + H.skel('skel-line w40') + H.skel('skel-line w80') + H.skel('skel-line w80') + '</div></main>'; },
    render(ctx) {
      const p = S.product(ctx.params.pid);
      const b = S.business(ctx.params.bid);
      if (!p || !b || p.businessId !== b.id || (p.hidden && !S.prefs().ownerMode)) { notFound(ctx, '🔍', 'prod.notFound'); return; }
      const sel = S.defaultSelection(p);
      let qty = 1; let notes = '';
      const sold = p.available === false;
      const st = U.openState(b);
      const cat = S.category(b.category);
      const name = H.L(p, 'name');
      const groupHtml = (p.groups || []).map((g) => {
        const gname = H.L(g, 'name');
        const pill = g.type === 'single' && g.required ? '<span class="pill">' + esc(t('common.required')) + '</span>' : '<span class="pill muted">' + esc(g.max ? t('prod.chooseUpTo', { n: g.max }) : t('common.optional')) + '</span>';
        return '<fieldset class="opt-group" data-group="' + esc(g.id) + '"><legend class="opt-legend"><span class="h3">' + esc(gname) + '</span>' + pill + '</legend>' +
          g.choices.map((c) => {
            const id = 'o-' + g.id + '-' + c.id;
            const checked = g.type === 'single' ? sel.options[g.id] === c.id : false;
            return '<label class="opt-row" for="' + id + '"><input id="' + id + '" type="' + (g.type === 'single' ? 'radio' : 'checkbox') + '" name="' + esc(g.id) + '" value="' + esc(c.id) + '"' + (checked ? ' checked' : '') + (sold ? ' disabled' : '') + '>' +
              '<span class="opt-name" dir="auto">' + esc(H.L(c, 'name')) + '</span><span class="opt-delta">' + U.delta(c.delta) + '</span></label>';
          }).join('') + '</fieldset>';
      }).join('');
      ctx.el.innerHTML = '<main class="product"><div class="hero" style="--g1:' + cat.grad[0] + ';--g2:' + cat.grad[1] + '">' +
        '<div class="cover-btns"><button type="button" class="icon-btn glass" data-back="#/business/' + esc(b.id) + '" aria-label="' + esc(t('common.close')) + '">' + H.icon('close') + '</button><span class="grow"></span>' +
        H.heartBtn('products', p.id, name, 'glass') + '</div><span class="hero-emoji" role="img" aria-label="' + esc(name) + '">' + esc(p.emoji) + '</span></div>' +
        '<div class="pad"><h1 class="h1" dir="auto" tabindex="-1">' + esc(name) + '</h1>' +
        '<a class="link" href="#/business/' + esc(b.id) + '">' + esc(t('prod.from', { business: H.L(b, 'name') })) + '</a>' +
        (H.L(p, 'desc') ? '<p class="desc" dir="auto">' + esc(H.L(p, 'desc')) + '</p>' : '') +
        '<p class="big-price">' + U.price(p.price) + '</p>' +
        (st.state === 'paused' ? '<p class="info-strip danger">⏸️ ' + esc(t('cart.paused')) + '</p>' : st.open ? '' : '<p class="info-strip">🌙 ' + esc(t('biz.closedOrderAhead')) + '</p>') +
        (sold ? '<p class="info-strip danger">' + esc(t('biz.soldOut')) + '</p>' : '') +
        '<form data-form novalidate>' + groupHtml +
        '<div class="field"><label class="label h3" for="p-notes">' + esc(t('prod.notes')) + '</label><textarea id="p-notes" class="input" rows="2" maxlength="140" placeholder="' + esc(t('prod.notesPlaceholder')) + '" aria-describedby="p-count"' + (sold ? ' disabled' : '') + '></textarea>' +
        '<span class="counter" id="p-count"><bdi>0/140</bdi></span></div></form></div>' +
        '<div class="footer-bar"><div data-stepper></div><button type="button" class="btn btn-primary btn-lg grow split" data-add' + (sold ? ' disabled aria-disabled="true"' : '') + '></button></div></main>';
      const form = ctx.el.querySelector('[data-form]');
      const addBtn = ctx.el.querySelector('[data-add]');
      const stepEl = ctx.el.querySelector('[data-stepper]');
      const readSel = () => {
        (p.groups || []).forEach((g) => {
          if (g.type === 'single') { const r = form.querySelector('input[name="' + CSS.escape(g.id) + '"]:checked'); if (r) sel.options[g.id] = r.value; }
          else {
            const boxes = Array.from(form.querySelectorAll('input[name="' + CSS.escape(g.id) + '"]'));
            sel.addons[g.id] = boxes.filter((x) => x.checked).map((x) => x.value);
            if (g.max) { const full = sel.addons[g.id].length >= g.max; boxes.forEach((x) => { if (!x.checked) x.disabled = full || sold; }); }
          }
        });
      };
      const update = () => {
        readSel();
        const unit = S.unitPrice(p, sel.options, sel.addons);
        stepEl.innerHTML = H.stepper(qty, { min: 1, max: 20 });
        addBtn.innerHTML = sold ? esc(t('biz.soldOut')) : '<span>' + esc(t('prod.addToCart')) + '</span>' + U.price(unit * qty);
      };
      form.addEventListener('change', update);
      const notesEl = ctx.el.querySelector('#p-notes');
      notesEl.addEventListener('input', () => { notes = notesEl.value.slice(0, 140); ctx.el.querySelector('#p-count').innerHTML = '<bdi>' + notes.length + '/140</bdi>'; });
      stepEl.addEventListener('click', (e) => {
        const s = e.target.closest('[data-step]');
        if (!s || s.disabled) return;
        qty = Math.max(1, Math.min(20, qty + Number(s.dataset.step)));
        update();
        const again = stepEl.querySelector('[data-step="' + s.dataset.step + '"]');
        if (again && !again.disabled) again.focus();
      });
      addBtn.addEventListener('click', async () => {
        if (sold) return;
        readSel();
        const ok = await H.addToCart(p, { qty, options: JSON.parse(JSON.stringify(sel.options)), addons: JSON.parse(JSON.stringify(sel.addons)), notes: notes.trim() });
        if (!ok) return;
        H.toast(t('prod.added'), { type: 'success', action: { label: t('biz.viewCart'), fn: () => H.go('#/cart') } });
        H.back('#/business/' + b.id);
      });
      update();
    }
  });
})();
