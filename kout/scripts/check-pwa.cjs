// End-to-end PWA check in Chromium (run after `npm run build`, against a served copy of dist/):
//   node scripts/check-pwa.cjs http://localhost:8099/Todo-app/kout/ [http://localhost:8099/Todo-app/]
// 1. the manifest parses and the app is installable, 2. the service worker precaches everything,
// 3. with the network off, the game still loads (fonts included) and a game can be started,
// 4. optionally: the site's root app still works offline too (the two service workers don't clash).
const { chromium } = require('playwright');

const url = process.argv[2];
const rootUrl = process.argv[3];
const ok = (cond, msg) => {
  console.log(`${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) process.exitCode = 1;
};

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  if (rootUrl) {
    await page.goto(rootUrl);
    await page.waitForTimeout(1500); // let the root app register its own worker
  }
  await page.goto(url);
  const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
  ok(scope === new URL('./', url).href, `service worker active with scope ${scope}`);
  if (!(await page.evaluate(() => !!navigator.serviceWorker.controller))) await page.reload();
  ok(await page.evaluate(() => !!navigator.serviceWorker.controller), 'page is controlled by the service worker');

  const cdp = await context.newCDPSession(page);
  const manifest = await cdp.send('Page.getAppManifest');
  ok(manifest.errors.length === 0, `manifest parses without errors (${manifest.errors.map((e) => e.message).join('; ') || 'none'})`);
  const installErrors = (await cdp.send('Page.getInstallabilityErrors')).installabilityErrors;
  ok(installErrors.length === 0, `installable (${installErrors.map((e) => e.errorId).join(', ') || 'no installability errors'})`);

  const cached = await page.evaluate(async () => {
    const sw = await (await fetch('./sw.js')).text();
    const list = JSON.parse(sw.match(/const PRECACHE = (\[[\s\S]*?\]);/)[1]);
    const keys = await caches.keys();
    const cache = await caches.open(keys.find((k) => k.startsWith('kout-')));
    const missing = [];
    for (const p of list) if (!(await cache.match(new URL(p, location.href).href))) missing.push(p);
    return { total: list.length, missing };
  });
  ok(cached.missing.length === 0, `all ${cached.total} files precached${cached.missing.length ? ' — missing ' + cached.missing.join(', ') : ''}`);

  // ---- offline ----
  await context.setOffline(true);
  await page.reload({ waitUntil: 'load' });
  ok((await page.title()) === 'ديوانية الكوت', 'offline: the app loads');
  await page.waitForTimeout(500);
  ok(await page.evaluate(() => document.fonts.check('700 20px Cairo', 'ديوانية') && document.fonts.check('700 20px "Reem Kufi"', 'الكوت')), 'offline: Arabic fonts available');
  await page.locator('button.big', { hasText: 'بو ٤' }).click();
  await page.waitForTimeout(2500);
  const cards = await page.locator('.hand .card').count();
  ok(cards === 9, `offline: a Bo 4 game starts and deals 9 cards (${cards})`);
  await page.screenshot({ path: process.env.SHOT || '/tmp/kout-offline.png' });

  if (rootUrl) {
    await page.goto(rootUrl).catch(() => {});
    ok((await page.title()).length > 0 && !(await page.content()).includes('ERR_INTERNET_DISCONNECTED'), `offline: the root app still opens (${await page.title()})`);
  }
  ok(errors.length === 0, `no page errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await browser.close();
})();
