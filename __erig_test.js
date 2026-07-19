const { chromium } = require('playwright');
const path = require('path');
const URL = 'http://127.0.0.1:8123/stealth-game-3d.html';
const OUT = 'C:/Users/零零/WorkBuddy/2026-07-06-17-11-58';

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  page.on('console', m => { if (m.type() === 'error' && !/GL Driver|VALIDATE/.test(m.text())) errs.push(m.text()); });
  page.on('pageerror', e => errs.push(String(e)));
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof enemyRig !== 'undefined' && enemyRig !== null, { timeout: 60000 });
  const info = await page.evaluate(() => {
    return {
      rigLoaded: !!enemyRig,
      nBones: enemyRig ? enemyRig.boneDefs.length : 0,
      clipDur: enemyRig && enemyRig.clip ? +enemyRig.clip.duration.toFixed(3) : 0,
    };
  });
  console.log('enemyRig:', JSON.stringify(info));
  // let it run a few frames so enemies spawn + animate
  await page.waitForTimeout(2500);
  const enemyInfo = await page.evaluate(() => {
    let sk = 0, mix = 0, total = 0;
    for (const [ent, rec] of meshMap) {
      if (rec.type === 'enemy') {
        total++;
        if (rec.mesh && rec.mesh.isSkinnedMesh) sk++;
        if (rec.mixer) mix++;
      }
    }
    return { total, skinned: sk, withMixer: mix };
  });
  console.log('enemies:', JSON.stringify(enemyInfo));
  // screenshot
  await page.screenshot({ path: path.join(OUT, 'erig_ingame.png') });
  console.log('ERRORS:', errs.length);
  errs.slice(0, 10).forEach(e => console.log('  ', e));
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
