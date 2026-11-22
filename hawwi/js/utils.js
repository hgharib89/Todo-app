/* Hawwi utilities: escaping, formatting, hours/open state, slots, search, validation */
(function () {
  'use strict';
  const H = (window.H = window.H || {});
  const t = (k, v) => H.t(k, v);

  const MIN = 60000;
  const DAY = 86400000;

  const U = {};

  U.esc = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };

  U.round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  U.num = function (n) {
    const r = U.round2(n);
    return Number.isInteger(r) ? String(r) : r.toFixed(2);
  };
  U.fmtPrice = function (n) {
    const num = U.num(n);
    return H.lang() === 'ar' ? num + ' د.إ' : 'AED ' + num;
  };
  /* price wrapped in <bdi> for HTML */
  U.price = (n, cls) => '<bdi class="price' + (cls ? ' ' + cls : '') + '">' + U.esc(U.fmtPrice(n)) + '</bdi>';
  U.delta = (n) => (n > 0 ? '<bdi class="price">+' + U.esc(U.fmtPrice(n)) + '</bdi>' : '—');
  U.minus = (n) => '<bdi class="price">−' + U.esc(U.fmtPrice(n)) + '</bdi>';

  /* Arabic-Indic digits to Latin */
  U.latinDigits = (s) => String(s || '').replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));

  /* time helpers */
  U.hm = function (str) { const p = String(str).split(':'); return (+p[0]) * 60 + (+p[1] || 0); };
  U.pad = (n) => String(n).padStart(2, '0');
  U.hmStr = (mins) => { const m = ((mins % 1440) + 1440) % 1440; return U.pad(Math.floor(m / 60)) + ':' + U.pad(m % 60); };
  U.fmtClock = function (h, m) {
    const pm = h >= 12;
    let hh = h % 12; if (hh === 0) hh = 12;
    return hh + ':' + U.pad(m) + ' ' + t(pm ? 'time.pm' : 'time.am');
  };
  U.fmtTimeStr = (str) => { const v = U.hm(str); return U.fmtClock(Math.floor(v / 60) % 24, v % 60); };
  U.fmtTime = (d) => { d = new Date(d); return U.fmtClock(d.getHours(), d.getMinutes()); };
  U.startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  U.addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  U.ymd = (d) => { d = new Date(d); return d.getFullYear() + '-' + U.pad(d.getMonth() + 1) + '-' + U.pad(d.getDate()); };
  U.satIndex = (d) => (new Date(d).getDay() + 1) % 7;
  U.dayName = (d) => t(H.DAY_KEYS[U.satIndex(d)]);
  U.sameDay = (a, b) => U.ymd(a) === U.ymd(b);
  U.dayDiff = (a, b) => Math.round((U.startOfDay(a) - U.startOfDay(b)) / DAY);

  /* "Today" / "Tomorrow" / "Yesterday" / weekday */
  U.dayLabel = function (d, now) {
    now = now || new Date();
    const diff = U.dayDiff(d, now);
    if (diff === 0) return t('biz.today');
    if (diff === 1) return t('biz.tomorrow');
    if (diff === -1) return t('rel.yesterday');
    if (diff > 1 && diff < 7) return U.dayName(d);
    d = new Date(d);
    return U.dayName(d) + ' ' + d.getDate() + '/' + (d.getMonth() + 1);
  };
  U.dateTime = (d) => U.dayLabel(d) + ' ' + U.fmtTime(d);

  U.relDate = function (d) {
    const n = U.dayDiff(new Date(), d);
    if (n <= 0) return t('rel.today');
    if (n === 1) return t('rel.yesterday');
    if (n < 14) return t('rel.daysAgo', { n });
    return t('rel.weeksAgo', { n: Math.floor(n / 7) });
  };

  /* Opening intervals around `now` (from yesterday through 8 days ahead). */
  U.intervals = function (biz, now) {
    const out = [];
    const base = U.startOfDay(now);
    for (let off = -1; off <= 8; off++) {
      const d = U.addDays(base, off);
      const e = biz.hours && biz.hours[U.satIndex(d)];
      if (!e) continue;
      const o = U.hm(e[0]); let c = U.hm(e[1]);
      if (c === o) continue;
      if (c < o) c += 1440;
      out.push({ day: d, open: d.getTime() + o * MIN, close: d.getTime() + c * MIN });
    }
    return out;
  };

  /* state: open | closing | closed | paused */
  U.openState = function (biz, now) {
    now = now || new Date();
    const ts = now.getTime();
    const ivs = U.intervals(biz, now);
    const cur = ivs.find((iv) => iv.open <= ts && ts < iv.close);
    const next = ivs.find((iv) => iv.open > ts);
    const res = { open: !!cur, current: cur || null, next: next || null };
    if (biz.acceptingOrders === false) res.state = 'paused';
    else if (cur) res.state = cur.close - ts <= 30 * MIN ? 'closing' : 'open';
    else res.state = 'closed';
    return res;
  };

  U.openBadge = function (biz, now) {
    const st = U.openState(biz, now);
    let label, cls;
    if (st.state === 'paused') { label = t('biz.paused'); cls = 'danger'; }
    else if (st.state === 'open') { label = t('biz.open'); cls = 'success'; }
    else if (st.state === 'closing') { label = t('biz.closingSoon'); cls = 'warning'; }
    else if (st.next) {
      const od = new Date(st.next.open);
      let day = U.dayLabel(od, now);
      if (H.lang() === 'en' && U.dayDiff(od, now || new Date()) <= 1) day = day.toLowerCase(); // "opens today 4:00 PM"
      label = t('biz.closedOpens', { day, time: U.fmtTime(od) }); cls = 'muted';
    } else { label = t('biz.closed'); cls = 'muted'; }
    return '<span class="badge badge-' + cls + '">' + U.esc(label) + '</span>';
  };

  /* Slots for dayOffset 0 (today) or 1 (tomorrow). Returns [{start:'HH:MM', at:ms, date:'YYYY-MM-DD'}]
     `date` is the calendar date of the slot start (after-midnight slots carry the next date).
     Today also includes the remaining after-midnight slots of last night's opening (e.g. 16:00-03:00). */
  U.slots = function (biz, dayOffset, now) {
    now = now || new Date();
    if (biz.acceptingOrders === false) return [];
    const base = U.startOfDay(now);
    const ready = now.getTime() + (biz.prep || 0) * MIN;
    const earliest = Math.ceil(ready / (30 * MIN)) * 30 * MIN;
    const out = [];
    const fromDay = (d, minStart) => {
      const e = biz.hours && biz.hours[U.satIndex(d)];
      if (!e) return;
      const o = U.hm(e[0]); let c = U.hm(e[1]);
      if (c === o) return;
      if (c < o) c += 1440;
      const openAt = d.getTime() + o * MIN;
      const closeAt = d.getTime() + c * MIN;
      for (let ts = Math.max(openAt, minStart); ts <= closeAt - 30 * MIN; ts += 30 * MIN) {
        const sd = new Date(ts);
        out.push({ start: U.pad(sd.getHours()) + ':' + U.pad(sd.getMinutes()), at: ts, date: U.ymd(sd) });
      }
    };
    if (dayOffset === 0) {
      fromDay(U.addDays(base, -1), Math.max(earliest, base.getTime()));
      fromDay(base, earliest);
    } else {
      fromDay(U.addDays(base, dayOffset), 0);
    }
    return out;
  };

  U.asapAvailable = function (biz, now) {
    now = now || new Date();
    const st = U.openState(biz, now);
    if (st.state === 'paused' || !st.current) return false;
    return now.getTime() + (biz.prep || 0) * MIN < st.current.close;
  };

  /* Search normalisation (11.2) */
  U.norm = function (s) {
    return U.latinDigits(String(s || '').toLowerCase())
      .replace(/[ً-ْٰ]/g, '')
      .replace(/ـ/g, '')
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .replace(/ؤ/g, 'و')
      .replace(/ئ/g, 'ي')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .trim();
  };

  U.luhn = function (num) {
    const s = String(num).replace(/\D/g, '');
    let sum = 0; let dbl = false;
    for (let i = s.length - 1; i >= 0; i--) {
      let d = +s[i];
      if (dbl) { d *= 2; if (d > 9) d -= 9; }
      sum += d; dbl = !dbl;
    }
    return s.length > 0 && sum % 10 === 0;
  };

  U.fmtPhone = function (p) {
    const s = String(p || '').replace(/\D/g, '');
    const local = s.startsWith('971') ? s.slice(3) : s;
    return '+971 ' + local.slice(0, 2) + ' ' + local.slice(2, 5) + ' ' + local.slice(5);
  };
  U.maskPhone = function (p) {
    const s = String(p || '').replace(/\D/g, '');
    const local = s.startsWith('971') ? s.slice(3) : s;
    return '+971 ' + local.slice(0, 2) + ' *** ' + local.slice(5);
  };
  U.fmtLocalPhone = function (digits) {
    const d = digits.slice(0, 9);
    return [d.slice(0, 2), d.slice(2, 5), d.slice(5)].filter(Boolean).join(' ');
  };

  U.uid = (p) => (p || '') + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  U.greetingKey = function (d) {
    const h = (d || new Date()).getHours();
    if (h >= 5 && h < 12) return ['home.morning', '☀️'];
    if (h >= 12 && h < 18) return ['home.afternoon', '🌤️'];
    return ['home.evening', '🌙'];
  };

  U.firstName = (n) => String(n || '').trim().split(/\s+/)[0] || '';
  U.reduced = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  U.debounce = function (fn, ms) { let tm; return function () { const a = arguments; clearTimeout(tm); tm = setTimeout(() => fn.apply(this, a), ms); }; };

  /* Parse a hash like "#/search?q=x&cat=food" */
  U.parseHash = function (hash) {
    const h = String(hash || '').replace(/^#/, '') || '/';
    const qi = h.indexOf('?');
    const path = qi >= 0 ? h.slice(0, qi) : h;
    const query = {};
    if (qi >= 0) {
      h.slice(qi + 1).split('&').forEach((kv) => {
        if (!kv) return;
        const i = kv.indexOf('=');
        const k = decodeURIComponent(i >= 0 ? kv.slice(0, i) : kv);
        let v = i >= 0 ? kv.slice(i + 1) : '';
        try { v = decodeURIComponent(v.replace(/\+/g, ' ')); } catch (e) { /* keep raw */ }
        query[k] = v;
      });
    }
    return { path: path.replace(/\/+$/, '') || '/', query };
  };
  U.buildQuery = function (obj) {
    const parts = Object.keys(obj).filter((k) => obj[k] !== '' && obj[k] != null && obj[k] !== false).map((k) => encodeURIComponent(k) + '=' + encodeURIComponent(obj[k] === true ? '1' : obj[k]));
    return parts.length ? '?' + parts.join('&') : '';
  };

  U.MIN = MIN;
  U.DAY = DAY;
  H.U = U;
  H.esc = U.esc;
})();
