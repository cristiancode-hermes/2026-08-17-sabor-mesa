const puppeteer = require('/opt/data/node_modules/puppeteer');
const BASE = 'https://sabor-mesa.proyectos.cristiancode.dev';
const routes = ['/', '/carta', '/reservar', '/login'];
const viewports = [390, 768, 1024, 1280];

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/opt/data/.cache/puppeteer/chrome/linux-149.0.7827.22/chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-crashpad-forwarding'],
  });
  const results = [];
  for (const route of routes) {
    for (const w of viewports) {
      const page = await browser.newPage();
      await page.setViewport({ width: w, height: 844 });
      const errors = [];
      page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 150)); });
      page.on('pageerror', e => errors.push('PAGEERROR: ' + String(e).slice(0, 150)));
      const resp = await page.goto(BASE + route, { waitUntil: 'networkidle2', timeout: 30000 }).catch(e => null);
      await new Promise(r => setTimeout(r, 1200));
      const info = await page.evaluate(() => {
        const de = document.documentElement;
        const imgs = Array.from(document.querySelectorAll('img'));
        return {
          title: document.title,
          bodyH: document.body ? document.body.scrollHeight : 0,
          overflowX: de.scrollWidth > de.clientWidth + 1,
          scrollW: de.scrollWidth,
          clientW: de.clientWidth,
          brokenImgs: imgs.filter(i => i.complete && i.naturalWidth === 0).length,
          imgs: imgs.length,
          h1: document.querySelector('h1')?.textContent?.trim().slice(0, 60) || '',
        };
      });
      results.push({
        route, w, status: resp ? resp.status() : 'ERR',
        ...info, consoleErrors: errors.slice(0, 5),
      });
      await page.close();
    }
  }
  await browser.close();
  for (const r of results) {
    const flags = [];
    if (r.status >= 400) flags.push('HTTP' + r.status);
    if (r.overflowX) flags.push('OVERFLOW_X');
    if (r.brokenImgs > 0) flags.push('BROKEN_IMG');
    if (r.consoleErrors.length) flags.push('CONSOLE_ERR:' + r.consoleErrors[0].slice(0, 80));
    console.log(`${r.route.padEnd(12)} ${String(r.w).padStart(4)}px status=${r.status} overflow=${r.overflowX ? 'YES' : 'no'} imgs=${r.imgs} broken=${r.brokenImgs} ${flags.length ? '⚠️ ' + flags.join(' | ') : '✅'}`);
  }
})();