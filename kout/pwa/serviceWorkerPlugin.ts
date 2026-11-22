import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { Plugin } from 'vite';

/** Fill the service worker template with the files to precache and a version derived from their contents. */
export function buildServiceWorker(template: string, files: Record<string, string | Uint8Array>): string {
  // .woff copies of the fonts are only for old browsers without service workers: woff2 is enough
  const names = Object.keys(files)
    .filter((f) => f !== 'sw.js' && !f.endsWith('.woff'))
    .sort();
  const hash = createHash('sha256');
  for (const n of names) hash.update(n).update(files[n]);
  const version = hash.digest('hex').slice(0, 12);
  const precache = ['./', ...names.map((n) => `./${n}`)];
  return template.replace('__VERSION__', version).replace('__PRECACHE__', JSON.stringify(precache, null, 2));
}

function listFiles(dir: string, base = dir): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? listFiles(p, base) : [relative(base, p).split('\\').join('/')];
  });
}

/** Vite plugin: emits dist/sw.js that precaches every built file and every file in public/. */
export function serviceWorkerPlugin(templatePath: string): Plugin {
  let publicDir = '';
  return {
    name: 'kout-service-worker',
    apply: 'build',
    configResolved(config) {
      publicDir = config.publicDir;
    },
    generateBundle(_options, bundle) {
      const files: Record<string, string | Uint8Array> = {};
      for (const [name, out] of Object.entries(bundle)) {
        files[name] = out.type === 'chunk' ? out.code : out.source;
      }
      if (publicDir) {
        for (const f of listFiles(publicDir)) files[f] = readFileSync(join(publicDir, f));
      }
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: buildServiceWorker(readFileSync(templatePath, 'utf8'), files) });
    },
  };
}
