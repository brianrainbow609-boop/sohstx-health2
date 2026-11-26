import { chromium } from 'playwright';
import fs from 'node:fs';

const games = JSON.parse(fs.readFileSync('games/catalog.json', 'utf8'));
const base = process.env.GAME_QA_BASE_URL || 'http://127.0.0.1:4173';
const browser = await chromium.launch({ headless: true });
const failures = [];
fs.mkdirSync('artifacts/game-screenshots', { recursive: true });
try {
  for (const game of games) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    const page = await context.newPage();
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
      await page.screenshot({ path: 'artifacts/game-screenshots/' + game.dir.replaceAll('/', '_') + '-mobile.png', fullPage: true });
      const installUrl = base + '/' + game.dir + '/install.html';
      const installResponse = await page.goto(installUrl, { waitUntil: 'networkidle', timeout: 20000 });
      if (!installResponse?.ok()) failures.push(game.title + ': install page returned HTTP ' + installResponse?.status());
      if (!(await page.locator('body').innerText()).trim()) failures.push(game.title + ': install page body is empty');
      await page.screenshot({ path: 'artifacts/game-screenshots/' + game.dir.replaceAll('/', '_') + '-install-mobile.png', fullPage: true });
      const desktop = await browser.newPage({ viewport: { width: 1365, height: 900 } });
      await desktop.setDefaultTimeout(10000);
      const desktopResponse = await desktop.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
      if (!desktopResponse?.ok()) failures.push(game.title + ': desktop page returned HTTP ' + desktopResponse?.status());
      await desktop.screenshot({ path: 'artifacts/game-screenshots/' + game.dir.replaceAll('/', '_') + '-desktop.png', fullPage: true });
      await desktop.close();
      console.log((pageErrors.length || failedLocalRequests.length ? 'FAIL ' : 'PASS ') + game.title + ' — game and install pages');
    } catch (error) {
      failures.push(game.title + ': navigation/test failed: ' + error.message);
      console.log('FAIL ' + game.title + ' — ' + error.message);
    }
    await context.close();
  }
} finally {
  await browser.close();
}
console.log('Browser smoke test: ' + games.length + ' catalog games, ' + failures.length + ' failure(s).');
if (failures.length) {
  for (const failure of failures) console.error('FAIL ' + failure);
  process.exit(1);
}
