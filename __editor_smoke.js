const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const url = 'file://' + path.resolve('stealth-game-3d.html');
  const browser = await chromium.launch({
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=swiftshader', '--ignore-gpu-blocklist']
  });
  const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

  await page.goto(url);
  await page.waitForTimeout(1500);

  const errbox = await page.$('#errbox');
  console.log('errbox present after load:', !!errbox);
  console.log('errors after load:', errors.length);

  // 进入编辑器
  await page.keyboard.press('e');
  await page.waitForTimeout(300);
  const edc = await page.$('#edc');
  const edp = await page.$('#ed-panel');
  const edcDisp = edc ? await edc.evaluate(e => e.style.display) : 'MISSING';
  console.log('editor #edc display:', edcDisp, '| #ed-panel present:', !!edp);

  // 选掩体工具并点击画布中心放掩体
  if (edp) {
    await edp.$('button[data-t="cover"]').then(b => b && b.click());
  }
  await page.mouse.move(450, 300);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(150);

  // 应用并重载 -> 写 localStorage
  if (edp) {
    await edp.$('#ed-apply').then(b => b && b.click());
  }
  await page.waitForTimeout(300);
  const ls = await page.evaluate(() => localStorage.getItem('stealth_editor_overrides_v1'));
  console.log('localStorage override written:', !!ls);
  if (ls) {
    const o = JSON.parse(ls);
    const k = Object.keys(o);
    console.log('override keys:', k);
    if (k[0]) {
      const map = o[k[0]].map;
      let wall = 0; map.forEach(r => r.forEach(v => { if (v === 1) wall++; }));
      console.log('wall cells in saved override:', wall);
    }
  }

  // 玩家朝向测试：切到玩家工具，读取当前 eps 位置，点它自身格 → va 应 +π/4
  if (edp) {
    await edp.$('button[data-t="player"]').then(b => b && b.click());
  }
  await page.waitForTimeout(100);
  const epsBefore = await page.evaluate(() => eps && { c: eps.c, r: eps.r, va: eps.va || 0 });
  console.log('player eps before rotate:', JSON.stringify(epsBefore));
  if (epsBefore) {
    // 把格子中心转成画布坐标（复用 cellAt 反推）
    const clickXY = await page.evaluate(p => {
      const cs = Math.min((W - 40) / C, (H - 40) / R);
      const ox = (W - cs * C) / 2, oy = (H - cs * R) / 2;
      const rect = document.getElementById('edc').getBoundingClientRect();
      const sx = (ox + p.c * cs + cs / 2) * (rect.width / W) + rect.left;
      const sy = (oy + p.r * cs + cs / 2) * (rect.height / H) + rect.top;
      return { x: sx, y: sy };
    }, epsBefore);
    await page.mouse.move(clickXY.x, clickXY.y);
    await page.mouse.down();
    await page.mouse.up();
    await page.waitForTimeout(120);
    const epsAfter = await page.evaluate(() => eps && { c: eps.c, r: eps.r, va: eps.va || 0 });
    console.log('player eps after rotate:', JSON.stringify(epsAfter));
    const rotated = epsAfter && Math.abs(epsAfter.va - epsBefore.va - Math.PI / 4) < 0.01;
    console.log('player facing rotated by +45deg:', rotated);
    // 应用并检查 localStorage 里 ps.va 已写入
    if (edp) await edp.$('#ed-apply').then(b => b && b.click());
    await page.waitForTimeout(200);
    const ls2 = await page.evaluate(() => localStorage.getItem('stealth_editor_overrides_v1'));
    let savedVa = null;
    if (ls2) {
      const o2 = JSON.parse(ls2);
      const k2 = Object.keys(o2);
      savedVa = o2[k2[0]] && o2[k2[0]].ps && o2[k2[0]].ps.va;
      console.log('saved ps.va:', savedVa);
    }
    // 关键：重载后游戏内 pl.fa 与 fpYaw 是否都同步到出生朝向
    const inGame = await page.evaluate(() => ({ fa: pl.fa, yaw: fpYaw }));
    console.log('in-game pl.fa:', inGame.fa, '| fpYaw:', inGame.yaw);
    const synced = savedVa != null &&
      Math.abs(inGame.fa - savedVa) < 0.01 &&
      Math.abs(inGame.yaw - savedVa) < 0.01;
    console.log('in-game facing synced to spawn va:', synced);
  }

  // 退出编辑器
  await page.keyboard.press('e');
  await page.waitForTimeout(300);
  const edcDisp2 = edc ? await edc.evaluate(e => e.style.display) : 'MISSING';
  console.log('editor #edc display after exit:', edcDisp2);

  console.log('TOTAL ERRORS:', errors.length);
  errors.slice(0, 10).forEach(e => console.log(' -', e));

  await browser.close();
  process.exit(errors.length === 0 && edcDisp === 'block' && edcDisp2 === 'none' ? 0 : 2);
})().catch(e => { console.error('TEST CRASH:', e); process.exit(3); });
