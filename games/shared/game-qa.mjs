import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const errors = [];
const checked = { games: 0, files: 0, references: 0, scripts: 0, serviceWorkers: 0 };
const fail = (message) => errors.push(message);
const exists = (file) => { try { return fs.statSync(path.join(root, file)).isFile(); } catch { return false; } };
const existsPath = (file) => { try { return fs.existsSync(path.join(root, file)); } catch { return false; } };
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const normalize = (file) => path.posix.normalize(file).replace(/^\.\//, '');
const localTarget = (value, from) => {
  const raw = value.trim().replaceAll('&amp;', '&');
  if (!raw || raw.startsWith('#') || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(raw)) return null;
  const clean = decodeURIComponent(raw.split(/[?#]/, 1)[0]);
  if (!clean) return null;
  return normalize(clean.startsWith('/') ? clean.slice(1) : path.posix.join(path.posix.dirname(from), clean));
};
const checkRef = (value, from, kind) => {
  const target = localTarget(value, from);
  if (target === null) return;
  checked.references++;
  if (target === '..' || target.startsWith('../')) fail(from + ': ' + kind + ' escapes repository: ' + value);
  else if (!existsPath(target)) fail(from + ': missing ' + kind + ': ' + value + ' -> ' + target);
};
const walk = (dir) => fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((entry) => {
  const file = path.posix.join(dir, entry.name);
  return entry.isDirectory() ? walk(file) : [file];
});

let games;
try {
  games = JSON.parse(read('games/catalog.json'));
  if (!Array.isArray(games) || games.length === 0) throw new Error('catalog must be a non-empty array');
} catch (error) {
  console.error('FAIL games/catalog.json: ' + error.message);
  process.exit(1);
}
const seenDirs = new Set();
const seenTitles = new Set();
for (const game of games) {
  checked.games++;
  if (!game.dir || !game.title || !game.art) { fail('catalog entry missing dir/title/art: ' + JSON.stringify(game)); continue; }
  if (seenDirs.has(game.dir)) fail('duplicate catalog directory: ' + game.dir);
  if (seenTitles.has(game.title)) fail('duplicate game title: ' + game.title);
  seenDirs.add(game.dir); seenTitles.add(game.title);
  for (const file of [game.dir + '/index.html', game.dir + '/install.html', 'games/art/' + game.art + '.webp']) {
    if (!exists(file)) fail(game.title + ': required catalog file missing: ' + file);
  }
}
const roots = [...new Set([...seenDirs, 'pinball', 'night-shift', 'Robert', 'TireShop'])].filter((dir) => fs.existsSync(path.join(root, dir)));
const files = roots.flatMap(walk);
for (const file of files) {
  checked.files++;
  const ext = path.extname(file).toLowerCase();
  if (ext === '.html') {
    const html = read(file);
    for (const match of html.matchAll(/\b(src|href|poster)=["']([^"']+)["']/gi)) checkRef(match[2], file, match[1]);
    for (const match of html.matchAll(/<link\b[^>]*\brel=["']manifest["'][^>]*\bhref=["']([^"']+)/gi)) {
      const target = localTarget(match[1], file);
      if (target && exists(target)) {
        try {
          const manifest = JSON.parse(read(target));
          for (const icon of manifest.icons ?? []) if (icon.src) checkRef(icon.src, target, 'manifest icon');
          if (manifest.start_url) checkRef(manifest.start_url, target, 'manifest start_url');
        } catch (error) { fail(target + ': invalid web manifest JSON (' + error.message + ')'); }
      }
    }
  }
  if (ext === '.css') {
    const css = read(file);
    for (const match of css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) checkRef(match[1], file, 'CSS asset');
    for (const match of css.matchAll(/@import\s+["']([^"']+)["']/gi)) checkRef(match[1], file, 'CSS import');
  }
  if (['.js', '.mjs', '.cjs'].includes(ext)) {
    for (const match of read(file).matchAll(/(?:\bfrom\s*|\bimport\s*\()(['"])(\.{1,2}\/[^'"]+)\1/g)) checkRef(match[2], file, 'module import');
    checked.scripts++;
    const result = spawnSync(process.execPath, ['--check', file], { cwd: root, encoding: 'utf8' });
    if (result.status !== 0) fail(file + ': JavaScript syntax check failed: ' + (result.stderr || result.stdout).trim());
  }
  if (path.basename(file) === 'sw.js') {
    checked.serviceWorkers++;
    for (const match of read(file).matchAll(/addAll\(\s*\[([\s\S]*?)\]\s*\)/g)) {
      for (const item of match[1].matchAll(/["']([^"']+)["']/g)) checkRef(item[1], file, 'service-worker precache');
    }
  }
}
console.log('SohStx Game QA: ' + checked.games + ' catalog games; ' + checked.files + ' game files; ' + checked.references + ' local references; ' + checked.scripts + ' JavaScript files; ' + checked.serviceWorkers + ' service workers.');
for (const error of errors) console.error('FAIL ' + error);
if (errors.length) { console.error('QA FAILED: ' + errors.length + ' issue(s).'); process.exit(1); }
console.log('QA PASSED.');
