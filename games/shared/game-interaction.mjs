import { chromium } from 'playwright';
import fs from 'node:fs';

const games = JSON.parse(fs.readFileSync('games/catalog.json', 'utf8'));
const base = process.env.GAME_QA_BASE_URL || 'http://127.0.0.1:4173';
const interactions = {
  'games/tloves-city-builder': ['#move', '#gather'],
  'games/tempest-delver': ['#research'],
  'games/tempest-chess': ['#undo'],
  island: ['#pause', '#speed'],
  Robert: ['#pause'],
  pinball: ['#launch', '#left', '#right'],
  TireShop: ['#swap', '#use'],
  'night-shift': ['#start', '[data-key="right"]', '#fire'],
  'tire-shots-rival': ['#motion-replay']
};
const browser = await chromium.launch({ headless: true });
const failures = [];
const report = [];
try {
  for (const game of games) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, serviceWorkers: 'block' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const url = base + '/' + game.dir + '/';
    const result = { game: game.title, interactions: [], horizontalOverflow: false, reload: 'not-tested' };
    try {
      const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
      if (!response?.ok()) throw new Error('HTTP ' + response?.status());
      result.horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
      if (result.horizontalOverflow) result.layoutWarning = 'Horizontal page overflow at 390px viewport';
      if (game.dir === 'games/tempest-chess') {
        await page.locator('[data-square="e2"]').click();
        await page.locator('[data-square="e4"]').click();
        await page.waitForFunction(() => document.querySelector('#undo')?.disabled === false, null, { timeout: 10000 });
      }
      if (game.dir === 'tire-shots-rival') await page.locator('#motion-panel').evaluate(el => { el.open = true; });
      for (const selector of interactions[game.dir] ?? []) {
        const control = page.locator(selector).first();
        if (await control.count() && await control.isVisible() && await control.isEnabled()) {
          await control.tap({ timeout: 3000 }).catch(async () => control.click({ timeout: 3000 }));
          result.interactions.push(selector + ': activated');
        } else if (!(await control.count())) {
          throw new Error('Expected control missing: ' + selector);
        } else {
          result.interactions.push(selector + ': present but currently disabled/hidden');
        }
      }
      const before = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)])));
      await page.reload({ waitUntil: 'networkidle', timeout: 20000 });
      const after = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)])));
      result.reload = JSON.stringify(before) === JSON.stringify(after) ? 'localStorage stable across reload' : 'localStorage changed across reload';
      if (errors.length) throw new Error(errors.join(' | '));
      result.status = 'PASS';
    } catch (error) {
      result.status = 'FAIL';
      result.error = error.message;
      failures.push(game.title + ': ' + error.message);
    }
    report.push(result);
    console.log(result.status + ' ' + game.title + ' — ' + result.interactions.join(', '));
    await context.close();
  }
} finally {
  await browser.close();
}
fs.mkdirSync('artifacts', { recursive: true });
fs.writeFileSync('artifacts/game-interaction-report.json', JSON.stringify({ generatedAt: new Date().toISOString(), results: report, failures }, null, 2));
console.log('Interaction QA: ' + games.length + ' games, ' + failures.length + ' failure(s).');
if (failures.length) process.exit(1);
