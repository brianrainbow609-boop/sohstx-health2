import { chromium } from 'playwright';
import fs from 'node:fs';

const games = JSON.parse(fs.readFileSync('games/catalog.json', 'utf8'));
const base = process.env.GAME_QA_BASE_URL || 'http://127.0.0.1:4173';
const browser = await chromium.launch({ headless: true });
const failures = [];
try {
  for (const game of games) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.setBypassServiceWorker(true);
    const pageErrors = [];
    const failedLocalRequests = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    page.on('requestfailed', request => {
      if (request.url().startsWith(base)) failedLocalRequests.push(request.url() + ' (' + request.failure()?.errorText + ')');
    });
    const url = base + '/' + game.dir + '/';
    try {
      const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
      if (!response?.ok()) failures.push(game.title + ': page returned HTTP ' + response?.status());
      if (!(await page.title()).trim()) failures.push(game.title + ': document title is empty');
      if (!(await page.locator('body').innerText()).trim()) failures.push(game.title + ': page body is empty');
      await page.waitForTimeout(400);
      if (pageErrors.length) failures.push(game.title + ': runtime errors: ' + pageErrors.join(' | '));
      if (failedLocalRequests.length) failures.push(game.title + ': failed local requests: ' + failedLocalRequests.join(' | '));
      console.log((pageErrors.length || failedLocalRequests.length ? 'FAIL ' : 'PASS ') + game.title + ' — ' + url);
    } catch (error) {
      failures.push(game.title + ': navigation/test failed: ' + error.message);
      console.log('FAIL ' + game.title + ' — ' + error.message);
    }
    await page.close();
  }
} finally {
  await browser.close();
}
console.log('Browser smoke test: ' + games.length + ' catalog games, ' + failures.length + ' failure(s).');
if (failures.length) {
  for (const failure of failures) console.error('FAIL ' + failure);
  process.exit(1);
}
