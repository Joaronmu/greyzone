const { chromium } = require('playwright');
const path = require('path');
const URL = 'http://127.0.0.1:8123/stealth-game-3d.html';
const OUT = 'C:/Users/零零/WorkBuddy/2026-07-06-17-11-58';

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 640, height: 760 } });
  const errs = [], logs = [];
  page.on('console', m => {
    const t = m.text();
    if (/Rig loaded|miniRig|bossRig/.test(t)) logs.push(t);
    if (m.type() === 'error' && !/GL Driver|VALIDATE/.test(t)) errs.push(t);
  });
  page.on('pageerror', e => errs.push(String(e)));
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof bossGeo !== 'undefined' && bossGeo && typeof zGeo !== 'undefined' && zGeo && miniRig && bossRig, { timeout: 60000 });
  await page.waitForTimeout(300); // let textures begin loading

  // build + pose + render each boss
  const result = await page.evaluate(() => {
    const THREE = window.THREE;
    function renderBoss(sk, tag, posed, view) {
      const mesh = sk.mesh;
      mesh.rotation.set(0,0,0); mesh.position.set(0,0,0);
      mesh.updateMatrixWorld(true);
      if (posed) {
        _setBoneQ(sk.legLup, 0.42); _setBoneQ(sk.legRup, -0.42);
        _setBoneQ(sk.legL, Math.max(0,0.42)*0.6); _setBoneQ(sk.legR, Math.max(0,-0.42)*0.6);
        _setBoneQ(sk.armLup, -0.2); _setBoneQ(sk.armRup, 0.2);
      }
      mesh.updateMatrixWorld(true);
      const sc = new THREE.Scene();
      sc.background = new THREE.Color(0xf0f0f0);
      sc.add(mesh);
      sc.add(new THREE.HemisphereLight(0xffffff, 0x333333, 1.1));
      const dir = new THREE.DirectionalLight(0xffffff, 1.2); sc.add(dir);
      const bbox = new THREE.Box3().setFromObject(mesh);
      const center = bbox.getCenter(new THREE.Vector3());
      const size = bbox.getSize(new THREE.Vector3());
      const halfH = size.y * 0.62 + 1;
      let cam;
      if (view === 'side') {
        const hw = size.z * 0.7 + 1;
        const d = Math.max(size.x, size.y) + 2;
        cam = new THREE.OrthographicCamera(-hw, hw, halfH, -halfH, 0.1, 100000);
        cam.position.set(center.x, center.y, center.z + d * 4);
        dir.position.set(center.x + d, center.y + d, center.z + d * 4);
      } else {
        const hw = size.x * 0.62 + 1;
        const d = Math.max(size.y, size.z) + 2;
        cam = new THREE.OrthographicCamera(-hw, hw, halfH, -halfH, 0.1, 100000);
        cam.position.set(center.x + d * 4, center.y, center.z);
        dir.position.set(center.x + d * 4, center.y + d, center.z + d);
      }
      cam.lookAt(center);
      renderer.render(sc, cam);
    }
    function quatAngle(a, b) {
      const dot = Math.abs(a.x*b.x + a.y*b.y + a.z*b.z + a.w*b.w);
      return 2 * Math.acos(Math.min(1, Math.max(-1, dot)));
    }
    const skMini = buildMiniSkinned();
    const skBoss = buildBossSkinned();
    const dev = {};
    // pose then measure deviation
    _setBoneQ(skMini.legLup, 0.42); _setBoneQ(skBoss.legLup, 0.42);
    dev.mini_legLup = quatAngle(skMini.legLup.quaternion, skMini.legLup.userData.rest);
    dev.boss_legLup = quatAngle(skBoss.legLup.quaternion, skBoss.legLup.userData.rest);
    // reset
    _setBoneQ(skMini.legLup, 0); _setBoneQ(skBoss.legLup, 0);
    // bind pose renders
    renderBoss(skMini, 'mini', false, 'side');
    return dev;
  });

  // side/bind shots
  await page.evaluate(() => { buildMiniSkinned; /* noop */ });
  // re-render in sequence and screenshot
  const shots = [
    { who: 'mini', posed: false, view: 'side', file: 'boss_mini_bind_side.png' },
    { who: 'mini', posed: true,  view: 'side', file: 'boss_mini_walk_side.png' },
    { who: 'mini', posed: true,  view: 'front', file: 'boss_mini_walk_front.png' },
    { who: 'main', posed: false, view: 'side', file: 'boss_main_bind_side.png' },
    { who: 'main', posed: true,  view: 'side', file: 'boss_main_walk_side.png' },
    { who: 'main', posed: true,  view: 'front', file: 'boss_main_walk_front.png' },
  ];
  for (const s of shots) {
    await page.evaluate((s) => {
      const THREE = window.THREE;
      const sk = s.who === 'mini' ? buildMiniSkinned() : buildBossSkinned();
      const mesh = sk.mesh; mesh.rotation.set(0,0,0); mesh.position.set(0,0,0); mesh.updateMatrixWorld(true);
      if (s.posed) {
        _setBoneQ(sk.legLup, 0.42); _setBoneQ(sk.legRup, -0.42);
        _setBoneQ(sk.legL, Math.max(0,0.42)*0.6); _setBoneQ(sk.legR, Math.max(0,-0.42)*0.6);
        _setBoneQ(sk.armLup, -0.2); _setBoneQ(sk.armRup, 0.2);
      }
      mesh.updateMatrixWorld(true);
      const sc = new THREE.Scene(); sc.background = new THREE.Color(0xf0f0f0); sc.add(mesh);
      sc.add(new THREE.HemisphereLight(0xffffff, 0x333333, 1.1));
      const dir = new THREE.DirectionalLight(0xffffff, 1.2); sc.add(dir);
      const bbox = new THREE.Box3().setFromObject(mesh);
      const center = bbox.getCenter(new THREE.Vector3());
      const size = bbox.getSize(new THREE.Vector3());
      const halfH = size.y * 0.62 + 1;
      let cam;
      if (s.view === 'side') {
        const hw = size.z * 0.7 + 1, d = Math.max(size.x, size.y) + 2;
        cam = new THREE.OrthographicCamera(-hw, hw, halfH, -halfH, 0.1, 100000);
        cam.position.set(center.x, center.y, center.z + d * 4);
        dir.position.set(center.x + d, center.y + d, center.z + d * 4);
      } else {
        const hw = size.x * 0.62 + 1, d = Math.max(size.y, size.z) + 2;
        cam = new THREE.OrthographicCamera(-hw, hw, halfH, -halfH, 0.1, 100000);
        cam.position.set(center.x + d * 4, center.y, center.z);
        dir.position.set(center.x + d * 4, center.y + d, center.z + d);
      }
      cam.lookAt(center);
      renderer.render(sc, cam);
    }, s);
    const el = await page.$('canvas');
    await el.screenshot({ path: path.join(OUT, s.file) });
    console.log('rendered', s.file);
  }
  console.log('LOGS:', logs.join(' | '));
  console.log('LEG DEVIATION (rad):', JSON.stringify(result), '(expect ~0.42)');
  console.log('ERRORS:', errs.length);
  errs.slice(0, 10).forEach(e => console.log('  ', e));
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
