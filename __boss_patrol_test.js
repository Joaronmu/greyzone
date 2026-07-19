const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const url = 'file://' + path.resolve('stealth-game-3d.html');
  const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader', '--use-gl=swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
  await page.goto(url);
  await page.waitForTimeout(1200);

  // ---- boss：加载 boss 层，强制 fc=true（最严：原本 fc 下 boss 会自转漂移），步进 AI ----
  await page.evaluate(() => il(2, 1));
  await page.waitForTimeout(200);
  const b0 = await page.evaluate(() => boss ? { x: boss.x, y: boss.y, hx: boss.hx, hy: boss.hy, epr: boss.epr } : null);
  console.log('boss home:', b0 && `(${b0.hx.toFixed(0)},${b0.hy.toFixed(0)}) epr=${b0 && b0.epr}`);
  // 步进 300 步，fc=true
  await page.evaluate(() => {
    fc = true;
    const dt = 0.05;
    for (let i = 0; i < 300; i++) { if (boss && boss.al) { uev(boss, dt); uep(boss, dt); } }
  });
  const b1 = await page.evaluate(() => boss ? { x: boss.x, y: boss.y, hx: boss.hx, hy: boss.hy } : null);
  if (b0 && b1) {
    const drift = Math.hypot(b1.hx - b0.hx, b1.hy - b0.hy);
    const dist = Math.hypot(b1.x - b1.hx, b1.y - b1.hy);
    console.log(`boss: homeDrift=${drift.toFixed(1)} distFromHome=${dist.toFixed(1)} (fc=true)`);
  } else console.log('boss missing!');

  // ---- miniBoss：加载第4关0层 ----
  await page.evaluate(() => il(4, 0));
  await page.waitForTimeout(200);
  const m0 = await page.evaluate(() => miniBoss ? { x: miniBoss.x, y: miniBoss.y, hx: miniBoss.hx, hy: miniBoss.hy, epr: miniBoss.epr } : null);
  console.log('miniBoss home:', m0 && `(${m0.hx.toFixed(0)},${m0.hy.toFixed(0)}) epr=${m0 && m0.epr}`);
  await page.evaluate(() => {
    const dt = 0.05;
    for (let i = 0; i < 300; i++) { if (miniBoss && miniBoss.al) { uev(miniBoss, dt); uep(miniBoss, dt); } }
  });
  const m1 = await page.evaluate(() => miniBoss ? { x: miniBoss.x, y: miniBoss.y, hx: miniBoss.hx, hy: miniBoss.hy } : null);
  if (m0 && m1) {
    const drift = Math.hypot(m1.hx - m0.hx, m1.hy - m0.hy);
    const dist = Math.hypot(m1.x - m1.hx, m1.y - m1.hy);
    console.log(`miniBoss: homeDrift=${drift.toFixed(1)} distFromHome=${dist.toFixed(1)}`);
  } else console.log('miniBoss missing!');

  console.log('\nTOTAL ERRORS:', errors.length);
  errors.slice(0, 6).forEach(e => console.log(' -', e));
  await browser.close();
  const bOk = b0 && b1 && Math.hypot(b1.hx - b0.hx, b1.hy - b0.hy) < 1;
  const mOk = m0 && m1 && Math.hypot(m1.hx - m0.hx, m1.hy - m0.hy) < 1;
  const ok = errors.length === 0 && bOk && mOk;
  console.log(ok ? 'PASS' : 'FAIL');
  process.exit(ok ? 0 : 2);
})().catch(e => { console.error('TEST CRASH:', e); process.exit(3); });
