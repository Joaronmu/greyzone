const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader','--no-sandbox'] });
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERR: '+e.message));
  page.on('console', m => { if (m.type()==='error' && !/VALIDATE|GL Driver/.test(m.text())) errs.push(m.text()); });
  await page.goto('http://127.0.0.1:8123/stealth-game-3d.html', { waitUntil: 'load' });
  await page.waitForFunction(() => bossRig && zGeo, { timeout: 60000 });
  await page.waitForTimeout(500);
  const res = await page.evaluate(() => {
    const THREE = window.THREE;
    walls.length=0; conts.length=0; // 无墙，测纯视野
    pl.x=500; pl.y=550; // 玩家在 boss 附近，视线无遮挡
    const e = {x:500, y:500, va:0, al:true, dl:0, _phase:0.3, _walk:0.5};
    const rec = makeBossMesh(e);
    // 相机看向 boss(在视野内)
    camera.position.set(500, 800, 500); camera.lookAt(500, 0, 500); camera.updateProjectionMatrix();
    renderer.render(scene, camera);
    const s1=w2s(500,500);
    updBoss(rec, e);
    const visIn = rec.skull ? rec.skull.visible : null;
    // 相机转开看远处(boss 不在视野)
    camera.position.set(500, 800, 2000); camera.lookAt(500, 0, 2000); camera.updateProjectionMatrix();
    renderer.render(scene, camera);
    const s2=w2s(500,500);
    updBoss(rec, e);
    const visOut = rec.skull ? rec.skull.visible : null;
    // 遮挡: boss 在屏幕内但 pl→boss 视线被墙挡
    camera.position.set(500, 800, 500); camera.lookAt(500, 0, 500); camera.updateProjectionMatrix();
    walls.length=0; walls.push({x:496,y:520,w:8,h:20}); // pl(500,550)→boss(500,500) 之间一道墙
    renderer.render(scene, camera);
    updBoss(rec, e);
    const visBlocked = rec.skull ? rec.skull.visible : null;
    walls.length=0;
    return {
      hasSkull: !!rec.skull,
      hasMap: rec.skull && !!rec.skull.material.map,
      skullY: rec.skull && +rec.skull.position.y.toFixed(1),
      visIn, visOut, visBlocked,
      camType: camera.isOrthographicCamera?'ortho':'persp',
    };
  });
  console.log(JSON.stringify(res,null,1));
  console.log('ERRORS:', errs.length?errs.slice(0,5):'none');
  const ok = res.hasSkull && res.hasMap && res.visIn===true && res.visOut===false && res.visBlocked===false;
  console.log(ok?'PASS':'FAIL');
  await browser.close();
  process.exit(ok?0:1);
})();
