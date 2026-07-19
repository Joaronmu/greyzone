const { chromium } = require('playwright');
const path = require('path');
const URL = 'http://127.0.0.1:8123/stealth-game-3d.html';
const OUT = 'C:/Users/零零/WorkBuddy/2026-07-06-17-11-58';

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 640, height: 760 } });
  const errs = [];
  page.on('console', m => { if (m.type() === 'error' && !/GL Driver|VALIDATE/.test(m.text())) errs.push(m.text()); });
  page.on('pageerror', e => errs.push(String(e)));
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof enemyRig !== 'undefined' && enemyRig !== null, { timeout: 60000 });
  await page.evaluate(() => { window.requestAnimationFrame = () => 0; });

  for (const view of ['front', 'side']) {
    await page.evaluate(({ view }) => {
      const THREE = window.THREE;
      const rec = buildEnemySkinned();       // ENEMY_PLAY_ANIM=false -> stays at bind pose
      const mesh = rec.mesh;
      mesh.updateMatrixWorld(true);
      const sc = new THREE.Scene();
      sc.background = new THREE.Color(0xf0f0f0);
      sc.add(mesh);
      sc.add(new THREE.HemisphereLight(0xffffff, 0x333333, 1.1));
      const dir = new THREE.DirectionalLight(0xffffff, 1.2); sc.add(dir);
      const bbox = new THREE.Box3().setFromObject(mesh);
      const center = bbox.getCenter(new THREE.Vector3());
      const size = bbox.getSize(new THREE.Vector3());
      const d = Math.max(size.x, size.y, size.z) * 0.6 + 1;
      const halfW = size.x * 0.6 + 1, halfH = size.y * 0.6 + 1;
      let cam;
      if (view === 'front') {
        cam = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, 0.1, 100000);
        cam.position.set(center.x, center.y, center.z + d * 3);
        dir.position.set(center.x + d, center.y + d, center.z + d * 3);
      } else {
        const hw = size.z * 0.6 + 1;
        cam = new THREE.OrthographicCamera(-hw, hw, halfH, -halfH, 0.1, 100000);
        cam.position.set(center.x + d * 3, center.y, center.z);
        dir.position.set(center.x + d * 3, center.y + d, center.z + d);
      }
      cam.lookAt(center);
      renderer.render(sc, cam);
    }, { view });
    const el = await page.$('canvas');
    await el.screenshot({ path: path.join(OUT, `hand_${view}.png`) });
    console.log('rendered', view);
  }
  console.log('ERRORS:', errs.length);
  errs.slice(0, 10).forEach(e => console.log('  ', e));
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
