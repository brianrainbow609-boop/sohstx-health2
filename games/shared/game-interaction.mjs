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
      result.mobileAudit = await page.evaluate(() => {
        const controls = [...document.querySelectorAll('button,a[href],input,select,textarea,[role="button"]')]
          .filter(el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; });
        const undersized = controls.filter(el => { const r = el.getBoundingClientRect(); return r.width < 40 || r.height < 40; }).length;
        return { viewportWidth: innerWidth, documentWidth: document.documentElement.scrollWidth,
          horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 2,
          visibleControls: controls.length, undersizedControls: undersized };
      });
      result.horizontalOverflow = result.mobileAudit.horizontalOverflow;
      if (result.horizontalOverflow) result.layoutWarning = 'Horizontal page overflow at 390px viewport';
      if (result.mobileAudit.undersizedControls) result.tapTargetWarning = result.mobileAudit.undersizedControls + ' visible controls below 40px';
      if (game.dir === 'games/tempest-chess') {
        await page.locator('[data-square="e2"]').click();
        await page.locator('[data-square="e4"]').click();
        await page.waitForFunction(() => document.querySelector('#undo')?.disabled === false, null, { timeout: 10000 });
        if (!(await page.locator('#record').innerText()).includes('e4')) throw new Error('Chess move e4 was not recorded');
        await page.reload({ waitUntil: 'networkidle', timeout: 20000 });
        if (!(await page.locator('#record').innerText()).includes('e4')) throw new Error('Chess move e4 did not survive reload');
        result.reload = 'chess move restored after reload';
        await page.locator('#undo').click();
        if ((await page.locator('#record').innerText()) !== 'Opening position') throw new Error('Chess undo did not restore the opening position');
        result.interactions.push('e2-e4 and undo: verified');
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
      if (game.dir === 'tire-shots-rival') {
        const pixels = await page.locator('#motion-preview').evaluate(canvas => {
          const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
          let visible = 0; for (let i = 3; i < data.length; i += 4) if (data[i] > 0) visible++;
          return visible;
        });
        if (!pixels) throw new Error('Fighter animation preview canvas remained blank');
        result.interactions.push('animation preview pixels: ' + pixels);
      }
      if (game.dir === 'pinball') {
        await page.evaluate(() => localStorage.setItem('sohstx-pinball-best', '12345'));
        await page.reload({ waitUntil: 'networkidle', timeout: 20000 });
        if ((await page.locator('#best').innerText()).trim() !== '12345') throw new Error('Pinball best score did not restore from localStorage');
        result.reload = 'pinball best score restored after reload';
      }
      const before = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)])));
      await page.reload({ waitUntil: 'networkidle', timeout: 20000 });
      const after = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)])));
      if (result.reload === 'not-tested') result.reload = JSON.stringify(before) === JSON.stringify(after) ? 'localStorage stable across reload' : 'localStorage changed across reload';
      if (errors.length) throw new Error(errors.join(' | '));
      result.status = 'PASS';
    } catch (error) {
      result.status = 'FAIL';
      result.error = error.message;
      failures.push(game.title + ': ' + error.message);
    }
    report.push(result);
    console.log(result.status + ' ' + game.title + ' — ' + result.interactions.join(', ') + ' — mobile: ' + JSON.stringify(result.mobileAudit || {}));
    if (result.horizontalOverflow || result.mobileAudit?.undersizedControls) console.warn('MOBILE REVIEW ' + game.title + ': ' + JSON.stringify({ overflow: result.horizontalOverflow, undersizedControls: result.mobileAudit?.undersizedControls }));
    await context.close();
  }
} finally {
  await browser.close();
}
fs.mkdirSync('artifacts', { recursive: true });
fs.writeFileSync('artifacts/game-interaction-report.json', JSON.stringify({ generatedAt: new Date().toISOString(), results: report, failures }, null, 2));
console.log('Interaction QA: ' + games.length + ' games, ' + failures.length + ' failure(s).');
if (failures.length) process.exit(1);
