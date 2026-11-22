/* Hawwi PWA: service worker registration and the "Install app" flow. */
(function () {
  'use strict';
  const H = (window.H = window.H || {});
  let deferred = null;

  H.pwa = {
    isStandalone() {
      try { return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true; } catch (e) { return false; }
    },
    isIOS() {
      const ua = navigator.userAgent || '';
      return /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
    },
    async install() {
      const t = H.t, esc = H.U && H.U.esc ? H.U.esc : (s) => String(s);
      if (deferred) {
        const p = deferred; deferred = null;
        try {
          p.prompt();
          const r = await p.userChoice;
          if (r && r.outcome === 'accepted') H.toast(t('pwa.installed'), { type: 'success' });
        } catch (e) { /* ignore */ }
        return;
      }
      const steps = H.pwa.isIOS() ? ['pwa.ios1', 'pwa.ios2', 'pwa.ios3'] : ['pwa.and1', 'pwa.and2', 'pwa.and3'];
      H.modal({
        title: t('pwa.title'),
        html: '<p>' + esc(t('pwa.intro')) + '</p><ol class="pwa-steps">' + steps.map((k) => '<li>' + esc(t(k)) + '</li>').join('') + '</ol>'
      });
    }
  };

  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; });
  window.addEventListener('appinstalled', () => { deferred = null; });

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => { /* offline support is optional */ });
    });
  }
})();
