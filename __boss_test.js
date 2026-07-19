const { chromium } = require('playwright');
(async () => {
  const errors = [], consoleMsgs = [];
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
  });
  const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
  page.on('console', m => consoleMsgs.push(m.type()+': '+m.text()));
  page.on('pageerror', e => errors.push('PAGEERROR: '+e.message));
  try {
    await page.goto('http://127.0.0.1:8123/stealth-game-3d.html', { waitUntil: 'load', timeout: 40000 });
  } catch (e) { errors.push('GOTO: '+e.message); }
  await page.waitForTimeout(3000);

  // 1) verify all three PM3D models parsed
  const models = await page.evaluate(() => {
    function info(g){ if(!g) return null; const p=g.getAttribute('position'); const i=g.getIndex(); return {verts: p?p.count:0, idx: i?i.count:0}; }
    return {
      boss:   info(typeof bossGeo!=='undefined'?bossGeo:null),
      enemy:  info(typeof enemyGeo!=='undefined'?enemyGeo:null),
      turret: info(typeof turretGeo!=='undefined'?turretGeo:null),
      bossTex: !!bossTex, enemyTex: !!enemyTex, turretTex: !!turretTex
    };
  });

  // 2) jump to level 4 floor 0 (spawns mini boss), position player to face it
  const scene2 = await page.evaluate(() => {
    il(4,0);
    return { miniBossExists: !!miniBoss, mb: miniBoss?{x:miniBoss.x,y:miniBoss.y}:null, st, fp: typeof fp };
  });
  await page.waitForTimeout(1500);

  // 3) check meshMap has a 'mini' entry whose mesh uses bossGeo
  const meshInfo = await page.evaluate(() => {
    let found=null, counts={};
    meshMap.forEach((rec,ent)=>{
      counts[rec.type]=(counts[rec.type]||0)+1;
      if(rec.type==='mini'){ found={ hasMesh: !!rec.mesh, geoIsBoss: rec.mesh && rec.mesh.geometry===bossGeo, hasMap: rec.mesh && rec.mesh.material && !!rec.mesh.material.map, scl: rec.mesh?rec.mesh.scale.x:null }; }
    });
    return { counts, found };
  });

  // 4) position player near mini boss, first-person, face it, screenshot
  await page.evaluate(() => {
    if(miniBoss){
      pl.x = miniBoss.x - 70; pl.y = miniBoss.y;
      const dx=miniBoss.x-pl.x, dy=miniBoss.y-pl.y;
      fpYaw = Math.atan2(dy,dx); fpPitch=0; crouch=false;
      fp = true;
    }
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'boss_shot.png' });

  console.log('=== MODELS ==='); console.log(JSON.stringify(models));
  console.log('=== SCENE(lv4f0) ==='); console.log(JSON.stringify(scene2));
  console.log('=== MESHMAP ==='); console.log(JSON.stringify(meshInfo));
  console.log('=== ERRORS ('+errors.length+') ==='); errors.forEach(e=>console.log(e));
  console.log('=== CONSOLE (warn/err only) ===');
  consoleMsgs.filter(m=>/warn|error/i.test(m)).slice(0,15).forEach(m=>console.log(m));
  await browser.close();
})();
