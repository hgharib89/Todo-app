/* Hawwi views: splash, onboarding, login, OTP, sign-up */
(function () {
  'use strict';
  const H = window.H;
  const U = H.U;
  const S = H.S;
  const esc = U.esc;
  const t = (k, v) => H.t(k, v);

  /* accounts registry so a returning phone logs straight in after logout */
  const ACC = 'hawwi.accounts';
  const accounts = () => { const a = H.store.get(ACC, {}); return a && typeof a === 'object' && !Array.isArray(a) ? a : {}; };
  H.saveAccount = function (u) { const a = accounts(); a[u.phone] = u; H.store.set(ACC, a); };
  const origSetUser = S.setUser;
  S.setUser = function (u) { origSetUser(u); if (u && u.phone) H.saveAccount(u); };

  function startRoute() {
    if (!S.onboardingSeen()) return '#/onboarding';
    return S.prefs().ownerMode ? '#/owner/dashboard' : '#/home';
  }

  /* ---------- 3.1 Splash ---------- */
  H.route('/splash', {
    cls: 'no-chrome',
    render(ctx) {
      ctx.el.innerHTML = '<main class="splash pattern" data-skip>' +
        '<div class="splash-center"><span class="logo-mark" aria-hidden="true">🧺</span>' +
        '<h1 class="wordmark" tabindex="-1">' + esc(t('app.name')) + '</h1><p class="tagline">' + esc(t('app.tagline')) + '</p>' +
        '<div class="dots-pulse" aria-hidden="true"><span></span><span></span><span></span></div>' +
        '<p class="sr-only">' + esc(t('common.loading')) + '</p></div></main>';
      let done = false;
      const next = () => { if (done || !ctx.alive()) return; done = true; H.go(startRoute(), { replace: true }); };
      const tm = setTimeout(next, 1200);
      ctx.el.querySelector('[data-skip]').addEventListener('click', next);
      ctx.cleanup = () => clearTimeout(tm);
    }
  });

  /* ---------- 3.2 Onboarding ---------- */
  const SLIDES = [
    { art: '🍲🧁', grad: ['#0F5B4D', '#1E7F86'], k: 's1' },
    { art: '⏰🛍️', grad: ['#E0A526', '#F1DFC0'], k: 's2' },
    { art: '📍✅', grad: ['#1E7F86', '#0F5B4D'], k: 's3' }
  ];
  H.route('/onboarding', {
    cls: 'no-chrome',
    render(ctx) {
      let idx = 0;
      const finish = () => { S.setOnboardingSeen(); H.go('#/home', { replace: true }); };
      ctx.el.innerHTML = '<main class="onb">' +
        '<div class="onb-top"><button type="button" class="link-btn" data-lang lang="' + (H.lang() === 'ar' ? 'en' : 'ar') + '">' + esc(t('onb.langSwitch')) + '</button>' +
        '<button type="button" class="link-btn" data-skip>' + esc(t('onb.skip')) + '</button></div>' +
        '<h1 class="sr-only" tabindex="-1">' + esc(t('app.name')) + '</h1>' +
        '<ul class="onb-track" data-track>' + SLIDES.map((s, i) => '<li class="onb-slide" aria-label="' + esc(t('onb.slideLabel', { n: i + 1 })) + '">' +
          '<div class="onb-art" style="--g1:' + s.grad[0] + ';--g2:' + s.grad[1] + '"><span aria-hidden="true">' + s.art + '</span></div>' +
          '<h2 class="onb-title">' + esc(t('onb.' + s.k + '.title')) + '</h2><p class="onb-body">' + esc(t('onb.' + s.k + '.body')) + '</p></li>').join('') + '</ul>' +
        '<div class="onb-dots" data-dots>' + SLIDES.map((s, i) => '<button type="button" class="dot" data-dot="' + i + '" aria-label="' + esc(t('onb.slideLabel', { n: i + 1 })) + '"></button>').join('') + '</div>' +
        '<div class="onb-foot"><button type="button" class="btn btn-primary btn-lg btn-block" data-next></button></div></main>';
      const track = ctx.el.querySelector('[data-track]');
      const slides = track.querySelectorAll('.onb-slide');
      const btn = ctx.el.querySelector('[data-next]');
      const sync = () => {
        ctx.el.querySelectorAll('[data-dot]').forEach((d, i) => { d.classList.toggle('active', i === idx); d.setAttribute('aria-current', i === idx ? 'true' : 'false'); });
        btn.textContent = idx === SLIDES.length - 1 ? t('onb.start') : t('onb.next');
      };
      const goTo = (i) => {
        idx = Math.max(0, Math.min(SLIDES.length - 1, i));
        const w = track.clientWidth;
        const sign = document.documentElement.dir === 'rtl' ? -1 : 1;
        track.scrollTo({ left: sign * idx * w, behavior: U.reduced() ? 'auto' : 'smooth' });
        sync();
      };
      track.addEventListener('scroll', U.debounce(() => {
        const w = track.clientWidth || 1;
        const i = Math.round(Math.abs(track.scrollLeft) / w);
        if (i !== idx) { idx = i; sync(); }
      }, 60));
      // mouse drag swipe (touch uses native scroll). Swipe toward start = next.
      let sx = null;
      track.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse') sx = e.clientX; });
      track.addEventListener('pointerup', (e) => {
        if (sx == null) return;
        const dx = e.clientX - sx; sx = null;
        if (Math.abs(dx) < 50) return;
        const rtl = document.documentElement.dir === 'rtl';
        const forward = rtl ? dx > 0 : dx < 0;
        goTo(idx + (forward ? 1 : -1));
      });
      ctx.el.querySelectorAll('[data-dot]').forEach((d) => d.addEventListener('click', () => goTo(+d.dataset.dot)));
      btn.addEventListener('click', () => { if (idx >= SLIDES.length - 1) finish(); else goTo(idx + 1); });
      ctx.el.querySelector('[data-skip]').addEventListener('click', finish);
      ctx.el.querySelector('[data-lang]').addEventListener('click', () => H.toggleLang());
      void slides;
      sync();
    }
  });

  /* ---------- 3.3 Phone login ---------- */
  H.route('/login', {
    cls: 'no-chrome',
    render(ctx) {
      const pre = H.mem.prefillPhone || '';
      ctx.el.innerHTML = '<main class="auth">' + H.appbar({ title: '', back: '#/home', cls: 'appbar-plain' }) +
        '<div class="pad"><h1 class="h1" tabindex="-1">' + esc(t('auth.title')) + '</h1><p class="sub">' + esc(t('auth.subtitle')) + '</p>' +
        (H.mem.returnTo ? '<p class="info-strip">🔒 ' + esc(t('auth.loginToContinue')) + '</p>' : '') +
        '<form class="form" novalidate data-form><div class="field"><label class="label" for="phone">' + esc(t('auth.phoneLabel')) + '</label>' +
        '<div class="phone-group" dir="ltr"><span class="prefix" aria-hidden="true">🇦🇪 +971</span>' +
        '<input id="phone" class="input" type="tel" inputmode="numeric" autocomplete="tel-national" placeholder="50 123 4567" aria-describedby="phone-hint phone-err" aria-required="true" value="' + esc(U.fmtLocalPhone(pre)) + '"></div>' +
        '<p class="helper" id="phone-hint">' + esc(t('auth.phoneHint')) + '</p><p class="err" id="phone-err" hidden>' + esc(t('auth.phoneError')) + '</p></div>' +
        '<button type="submit" class="btn btn-primary btn-lg btn-block" data-submit disabled aria-disabled="true">' + esc(t('auth.sendCode')) + '</button>' +
        '<p class="terms">' + esc(t('auth.terms')) + '</p></form></div></main>';
      const input = ctx.el.querySelector('#phone');
      const btn = ctx.el.querySelector('[data-submit]');
      const err = ctx.el.querySelector('#phone-err');
      const digits = () => { let d = U.latinDigits(input.value).replace(/\D/g, ''); if (d.startsWith('971')) d = d.slice(3); d = d.replace(/^0+/, ''); return d.slice(0, 9); };
      const sync = () => {
        const d = digits();
        input.value = U.fmtLocalPhone(d);
        const full = d.length === 9;
        btn.disabled = !full; btn.setAttribute('aria-disabled', full ? 'false' : 'true');
      };
      input.addEventListener('input', () => { err.hidden = true; input.removeAttribute('aria-invalid'); sync(); });
      sync();
      ctx.el.querySelector('[data-form]').addEventListener('submit', (e) => {
        e.preventDefault();
        const d = digits();
        if (!/^5[024568]\d{7}$/.test(d)) { err.hidden = false; input.setAttribute('aria-invalid', 'true'); input.focus(); return; }
        btn.classList.add('loading'); btn.setAttribute('aria-busy', 'true'); btn.disabled = true;
        setTimeout(() => {
          if (!ctx.alive()) return;
          H.mem.pendingPhone = '+971' + d; H.mem.prefillPhone = d;
          H.go('#/otp');
        }, 600);
      });
    }
  });

  /* ---------- 3.4 OTP ---------- */
  H.route('/otp', {
    cls: 'no-chrome',
    render(ctx) {
      const phone = H.mem.pendingPhone;
      if (!phone) { H.go('#/login', { replace: true }); return; }
      let remain = 30;
      ctx.el.innerHTML = '<main class="auth">' + H.appbar({ title: '', back: '#/login', cls: 'appbar-plain' }) +
        '<div class="pad"><h1 class="h1" tabindex="-1">' + esc(t('otp.title')) + '</h1>' +
        '<p class="sub">' + esc(t('otp.sentTo')) + ' <bdi dir="ltr" class="num">' + esc(U.fmtPhone(phone)) + '</bdi> <button type="button" class="link-btn" data-edit>' + esc(t('common.edit')) + '</button></p>' +
        '<form class="form" novalidate data-form><div class="otp-boxes" dir="ltr" data-boxes>' +
        [1, 2, 3, 4].map((n) => '<input class="otp-box" type="text" inputmode="numeric" autocomplete="' + (n === 1 ? 'one-time-code' : 'off') + '" maxlength="1" aria-label="' + esc(t('otp.digitLabel', { n })) + '" aria-describedby="otp-err">').join('') +
        '</div><p class="err center" id="otp-err" hidden>' + esc(t('otp.error')) + '</p>' +
        '<p class="chip-info">' + esc(t('otp.demoHint')) + '</p><p class="center resend" data-resend></p>' +
        '<button type="submit" class="btn btn-primary btn-lg btn-block" data-submit>' + esc(t('otp.verify')) + '</button></form></div></main>';
      const boxes = Array.from(ctx.el.querySelectorAll('.otp-box'));
      const err = ctx.el.querySelector('#otp-err');
      const btn = ctx.el.querySelector('[data-submit]');
      const resendEl = ctx.el.querySelector('[data-resend]');
      let autoTm = null; let busy = false;
      const code = () => boxes.map((b) => b.value).join('');
      const renderResend = () => {
        if (remain > 0) resendEl.innerHTML = esc(t('otp.resendIn', { time: '0:' + U.pad(remain) }));
        else resendEl.innerHTML = '<button type="button" class="link-btn" data-resend-btn>' + esc(t('otp.resend')) + '</button>';
      };
      renderResend();
      const iv = setInterval(() => { if (remain > 0) { remain--; renderResend(); } }, 1000);
      resendEl.addEventListener('click', (e) => { if (e.target.closest('[data-resend-btn]')) { H.toast(t('otp.resent'), { type: 'success' }); remain = 30; renderResend(); boxes[0].focus(); } });
      ctx.cleanup = () => { clearInterval(iv); clearTimeout(autoTm); };
      const fillFrom = (i, str) => {
        const ds = U.latinDigits(str).replace(/\D/g, '').split('');
        let j = i;
        ds.forEach((d) => { if (j < 4) { boxes[j].value = d; j++; } });
        boxes[Math.min(j, 3)].focus();
        check();
      };
      const check = () => {
        err.hidden = true; boxes.forEach((b) => b.classList.remove('invalid'));
        clearTimeout(autoTm);
        if (code().length === 4) autoTm = setTimeout(submit, 300);
      };
      boxes.forEach((b, i) => {
        b.addEventListener('input', () => {
          const v = U.latinDigits(b.value).replace(/\D/g, '');
          if (v.length > 1) { b.value = ''; fillFrom(i, v); return; }
          b.value = v;
          if (v && i < 3) boxes[i + 1].focus();
          check();
        });
        b.addEventListener('keydown', (e) => {
          if (e.key === 'Backspace' && !b.value && i > 0) { e.preventDefault(); boxes[i - 1].value = ''; boxes[i - 1].focus(); }
        });
        b.addEventListener('paste', (e) => {
          const txt = (e.clipboardData || window.clipboardData).getData('text');
          e.preventDefault(); fillFrom(0, txt);
        });
      });
      const submit = () => {
        if (busy || !ctx.alive()) return;
        const c = code();
        if (c.length !== 4) { boxes[c.length].focus(); return; }
        busy = true;
        btn.classList.add('loading'); btn.setAttribute('aria-busy', 'true'); btn.disabled = true;
        setTimeout(() => {
          if (!ctx.alive()) return;
          busy = false; btn.classList.remove('loading'); btn.removeAttribute('aria-busy'); btn.disabled = false;
          if (c === '0000') {
            err.hidden = false;
            const wrap = ctx.el.querySelector('[data-boxes]');
            wrap.classList.remove('shake'); void wrap.offsetWidth; wrap.classList.add('shake');
            boxes.forEach((b) => { b.value = ''; b.classList.add('invalid'); b.setAttribute('aria-invalid', 'true'); });
            boxes[0].focus();
            return;
          }
          const cur = S.user();
          const known = cur && cur.phone === phone ? cur : accounts()[phone];
          if (known) {
            S.setUser(known);
            H.mem.pendingPhone = null;
            H.toast(t('auth.welcomeBack', { name: U.firstName(known.name) }), { type: 'success' });
            H.afterLogin();
          } else H.go('#/signup-name', { replace: true });
        }, 500);
      };
      ctx.el.querySelector('[data-form]').addEventListener('submit', (e) => { e.preventDefault(); submit(); });
      ctx.el.querySelector('[data-edit]').addEventListener('click', () => { H.mem.prefillPhone = phone.slice(4); H.go('#/login', { replace: true }); });
      setTimeout(() => { if (ctx.alive()) boxes[0].focus(); }, 50);
    }
  });

  /* ---------- 3.5 Sign-up name ---------- */
  H.emirateOptions = function (sel, withAll) {
    return (withAll ? ['all'] : []).concat(H.SEED.emirates).map((e) => '<option value="' + e + '"' + (e === sel ? ' selected' : '') + '>' + esc(t('em.' + e)) + '</option>').join('');
  };
  H.route('/signup-name', {
    cls: 'no-chrome',
    render(ctx) {
      const phone = H.mem.pendingPhone;
      if (!phone) { H.go('#/login', { replace: true }); return; }
      ctx.el.innerHTML = '<main class="auth"><div class="pad pad-top"><h1 class="h1" tabindex="-1">' + esc(t('signup.title')) + '</h1><p class="sub">' + esc(t('signup.subtitle')) + '</p>' +
        '<form class="form" novalidate data-form>' +
        '<div class="field"><label class="label" for="su-name">' + esc(t('signup.name')) + '</label><input id="su-name" class="input" maxlength="40" autocomplete="name" aria-required="true" aria-describedby="su-name-err"><p class="err" id="su-name-err" hidden>' + esc(t('signup.nameError')) + '</p></div>' +
        '<div class="field"><label class="label" for="su-email">' + esc(t('signup.email')) + '</label><input id="su-email" class="input" type="email" dir="ltr" autocomplete="email" aria-describedby="su-email-err"><p class="err" id="su-email-err" hidden>' + esc(t('signup.emailError')) + '</p></div>' +
        '<div class="field"><label class="label" for="su-em">' + esc(t('signup.emirate')) + '</label><select id="su-em" class="input">' + H.emirateOptions('dubai') + '</select></div>' +
        '<button type="submit" class="btn btn-primary btn-lg btn-block">' + esc(t('signup.create')) + '</button></form></div></main>';
      ctx.el.querySelector('[data-form]').addEventListener('submit', (e) => {
        e.preventDefault();
        const nameEl = ctx.el.querySelector('#su-name'); const emEl = ctx.el.querySelector('#su-email');
        const name = nameEl.value.trim(); const email = emEl.value.trim();
        const nameBad = name.length < 2 || name.length > 40;
        const emailBad = email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        ctx.el.querySelector('#su-name-err').hidden = !nameBad; nameEl.setAttribute('aria-invalid', nameBad ? 'true' : 'false');
        ctx.el.querySelector('#su-email-err').hidden = !emailBad; emEl.setAttribute('aria-invalid', emailBad ? 'true' : 'false');
        if (nameBad) { nameEl.focus(); return; }
        if (emailBad) { emEl.focus(); return; }
        const emirate = ctx.el.querySelector('#su-em').value;
        const u = { phone, name, email: email || undefined, emirate, addresses: [], createdAt: new Date().toISOString() };
        S.setUser(u); H.saveAccount(u);
        if (S.prefs().emirate === 'all') S.setPrefs({ emirate, area: null });
        H.mem.pendingPhone = null;
        H.toast(t('auth.welcomeNew', { name: U.firstName(name) }), { type: 'success' });
        H.afterLogin();
      });
    }
  });
})();
