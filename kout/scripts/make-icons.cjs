// Renders assets/icon.svg into the PNG app icons in public/icons (run: node scripts/make-icons.cjs).
// Needs Playwright's Chromium; the generated PNGs are committed, so builds don't need it.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..');
const svg = fs.readFileSync(path.join(root, 'assets/icon.svg'), 'utf8');
const out = path.join(root, 'public/icons');
fs.mkdirSync(out, { recursive: true });

// name, size, rounded corners (transparent outside) or full-bleed square
const targets = [
  ['icon-192.png', 192, true],
  ['icon-512.png', 512, true],
  ['maskable-192.png', 192, false],
  ['maskable-512.png', 512, false],
  ['apple-touch-icon.png', 180, false], // iOS rounds the corners itself and wants no transparency
  ['favicon-32.png', 32, true],
];

(async () => {
  const browser = await chromium.launch();
  for (const [name, size, rounded] of targets) {
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    const radius = rounded ? Math.round(size * 0.22) : 0;
    await page.setContent(
      `<html><body style="margin:0;background:transparent">
        <div style="width:${size}px;height:${size}px;border-radius:${radius}px;overflow:hidden">
          ${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}
        </div></body></html>`,
    );
    await page.screenshot({ path: path.join(out, name), omitBackground: rounded });
    await page.close();
    console.log('wrote', name);
  }
  fs.copyFileSync(path.join(root, 'assets/icon.svg'), path.join(out, 'icon.svg'));
  await browser.close();
})();
