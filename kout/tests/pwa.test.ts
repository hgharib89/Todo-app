import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildServiceWorker } from '../pwa/serviceWorkerPlugin';

const root = join(__dirname, '..');
const read = (p: string) => readFileSync(join(root, p));
const manifest = JSON.parse(read('public/manifest.webmanifest').toString());
const html = read('index.html').toString();

/** width, height and colour type from a PNG header */
function png(p: string) {
  const b = read(p);
  expect(b.subarray(1, 4).toString()).toBe('PNG');
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), colorType: b[25] };
}

describe('web app manifest', () => {
  it('has the Arabic name, standalone portrait display and colours', () => {
    expect(manifest).toMatchObject({
      name: 'ديوانية الكوت',
      short_name: 'الكوت',
      lang: 'ar',
      dir: 'rtl',
      display: 'standalone',
      orientation: 'portrait',
      start_url: './',
      scope: './',
      theme_color: '#0b2226',
      background_color: '#0b2226',
    });
  });

  it('lists 192 and 512 icons, both "any" and "maskable", and every file exists at its size', () => {
    const icons: { src: string; sizes: string; purpose: string; type: string }[] = manifest.icons;
    for (const purpose of ['any', 'maskable']) {
      for (const size of [192, 512]) {
        const icon = icons.find((i) => i.purpose === purpose && i.sizes === `${size}x${size}`);
        expect(icon, `${purpose} ${size}`).toBeDefined();
        const { w, h } = png(join('public', icon!.src));
        expect([w, h]).toEqual([size, size]);
      }
    }
    for (const i of icons) expect(existsSync(join(root, 'public', i.src))).toBe(true);
  });

  it('maskable and Apple touch icons are fully opaque (no transparent corners)', () => {
    for (const p of ['public/icons/maskable-512.png', 'public/icons/maskable-192.png', 'public/icons/apple-touch-icon.png']) {
      expect(png(p).colorType).toBe(2); // RGB, no alpha
    }
    expect(png('public/icons/apple-touch-icon.png')).toMatchObject({ w: 180, h: 180 });
    expect(png('public/icons/favicon-32.png')).toMatchObject({ w: 32, h: 32 });
  });
});

describe('index.html', () => {
  it('links the manifest and the icons', () => {
    expect(html).toContain('<link rel="manifest" href="./manifest.webmanifest" />');
    expect(html).toContain('rel="apple-touch-icon" sizes="180x180" href="./icons/apple-touch-icon.png"');
    expect(html).toContain('<meta name="theme-color" content="#0b2226" />');
  });

  it('has the iOS full-screen standalone meta tags', () => {
    expect(html).toContain('<meta name="apple-mobile-web-app-capable" content="yes" />');
    expect(html).toContain('<meta name="mobile-web-app-capable" content="yes" />');
    expect(html).toContain('<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />');
    expect(html).toContain('<meta name="apple-mobile-web-app-title" content="الكوت" />');
    expect(html).toContain('viewport-fit=cover');
  });

  it('loads no fonts or scripts from other sites (works offline)', () => {
    expect(html).not.toMatch(/https?:\/\//);
  });
});

describe('service worker generation', () => {
  const template = read('pwa/sw.template.js').toString();
  const files = {
    'index.html': '<html>',
    'assets/index-abc.js': 'code',
    'assets/font-1.woff2': new Uint8Array([1, 2]),
    'assets/font-1.woff': new Uint8Array([3]),
    'icons/icon-192.png': new Uint8Array([4]),
    'manifest.webmanifest': '{}',
  };

  it('precaches the app shell and every built file (woff2 fonts, not the old woff copies)', () => {
    const sw = buildServiceWorker(template, files);
    const list = JSON.parse(sw.match(/const PRECACHE = (\[[\s\S]*?\]);/)![1]);
    expect(list).toEqual(['./', './assets/font-1.woff2', './assets/index-abc.js', './icons/icon-192.png', './index.html', './manifest.webmanifest']);
    expect(sw).not.toContain('__PRECACHE__');
    expect(sw).not.toContain('__VERSION__');
  });

  it('the cache version changes whenever a file changes', () => {
    const v = (f: Record<string, string | Uint8Array>) => buildServiceWorker(template, f).match(/const VERSION = '(\w+)'/)![1];
    expect(v(files)).toBe(v({ ...files }));
    expect(v({ ...files, 'assets/index-abc.js': 'new code' })).not.toBe(v(files));
  });

  it('only handles requests inside its own folder and cleans up old caches', () => {
    expect(template).toContain("url.pathname.startsWith(scope.pathname)");
    expect(template).toContain("k.startsWith('kout-') && k !== CACHE");
    expect(template).toContain("req.mode === 'navigate'");
  });

  it('the app registers it only in production builds, relative to the page', () => {
    const reg = read('src/pwa/register.ts').toString();
    expect(reg).toContain("register('./sw.js', { scope: './' })");
    expect(reg).toContain('import.meta.env.PROD');
  });
});
