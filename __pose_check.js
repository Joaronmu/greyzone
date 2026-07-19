const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const URL = 'http://127.0.0.1:8123/stealth-game-3d.html';
const OUT = 'C:/Users/零零/WorkBuddy/2026-07-06-17-11-58';
const models = [
  { key: 'enemy', geo: 'enemyGeo', scale: 0.85 },
  { key: 'mini',  geo: 'bossGeo',  scale: 0.85 },
  { key: 'zboss', geo: 'zGeo',     scale: 0.9  },
];

(async () => {
  const browser = await chromium.launch({
    args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--no-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 600, height: 700 } });
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push(String(e)));

  await page.goto(URL, { waitUntil: 'load' });
  // wait for all model geos (top-level `let` globals — use bare identifiers, not window.)
  try {
    await page.waitForFunction(() => enemyGeo && bossGeo && zGeo, { timeout: 90000 });
  } catch (e) {
    console.log('waitForFunction failed. captured errors:', errs.length);
    errs.slice(0, 20).forEach(x => console.log('  ', x));
    // dump what globals exist
    const probe = await page.evaluate(() => ({
      hasEnemy: typeof enemyGeo !== 'undefined' && !!enemyGeo,
      hasBoss: typeof bossGeo !== 'undefined' && !!bossGeo,
      hasZ: typeof zGeo !== 'undefined' && !!zGeo,
      hasTHREE: typeof THREE !== 'undefined',
      hasRenderer: typeof renderer !== 'undefined',
    }));
    console.log('probe:', JSON.stringify(probe));
    await browser.close();
    process.exit(1);
  }
  // stop the game loop so our renders stick
  await page.evaluate(() => { window.requestAnimationFrame = () => 0; });

  for (const m of models) {
    for (const view of ['front', 'side', 'top']) {
      await page.evaluate(({ geoName, scale, view }) => {
        const THREE = window.THREE;
        const geo = geoName === 'enemyGeo' ? enemyGeo : geoName === 'bossGeo' ? bossGeo : zGeo;
        const mat = new THREE.MeshStandardMaterial({ color: 0xc8c8c8, roughness: 1, metalness: 0 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.scale.setScalar(scale);
        const sc = new THREE.Scene();
        sc.background = new THREE.Color(0xf0f0f0);
        sc.add(mesh);
        sc.add(new THREE.HemisphereLight(0xffffff, 0x333333, 1.0));
        const dir = new THREE.DirectionalLight(0xffffff, 1.2);
        sc.add(dir);
        const bbox = new THREE.Box3().setFromObject(mesh);
        const center = bbox.getCenter(new THREE.Vector3());
        const size = bbox.getSize(new THREE.Vector3());
        const d = Math.max(size.x, size.y, size.z) * 0.6 + 1;
        let cam;
        const halfW = size.x * 0.6 + 1, halfH = size.y * 0.6 + 1;
        if (view === 'front') {
          cam = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, 0.1, 10000);
          cam.position.set(center.x, center.y, center.z + d * 3);
          dir.position.set(center.x + d, center.y + d, center.z + d * 3);
        } else if (view === 'side') {
          const hw = size.z * 0.6 + 1;
          cam = new THREE.OrthographicCamera(-hw, hw, halfH, -halfH, 0.1, 10000);
          cam.position.set(center.x + d * 3, center.y, center.z);
          dir.position.set(center.x + d * 3, center.y + d, center.z + d);
        } else {
          const hw = size.x * 0.6 + 1, hh = size.z * 0.6 + 1;
          cam = new THREE.OrthographicCamera(-hw, hw, hh, -hh, 0.1, 10000);
          cam.position.set(center.x, center.y + d * 3, center.z);
          cam.up.set(0, 0, -1);
          dir.position.set(center.x + d, center.y + d * 3, center.z - d);
        }
        cam.lookAt(center);
        renderer.render(sc, cam);
        window.__poseInfo = { size: [size.x.toFixed(2), size.y.toFixed(2), size.z.toFixed(2)], center: [center.x.toFixed(2), center.y.toFixed(2), center.z.toFixed(2)] };
      }, { geoName: m.geo, scale: m.scale, view });
      const el = await page.$('canvas');
      await el.screenshot({ path: path.join(OUT, `pose_${m.key}_${view}.png`) });
      const info = await page.evaluate(() => window.__poseInfo);
      console.log(`${m.key}/${view} size=`, info.size, 'center=', info.center);
    }
  }
  console.log('ERRORS:', errs.length);
  errs.slice(0, 10).forEach(e => console.log('  ', e));
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
