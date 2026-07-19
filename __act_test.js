const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader','--no-sandbox'] });
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERR: '+e.message));
  await page.goto('http://127.0.0.1:8123/stealth-game-3d.html', { waitUntil: 'load' });
  await page.waitForTimeout(700);

  const res = await page.evaluate(() => {
    const out = {};
    // 1) 初始 playerActed 应 false
    out.initFalse = (playerActed === false);
    // 2) 玩家不动(up 不移动) → playerActed 仍 false
    keys.w=keys.a=keys.s=keys.d=keys.arrowup=keys.arrowdown=keys.arrowleft=keys.arrowright=false; up(1/60);
    out.afterNoMove = playerActed;
    // 3) 敌人在 playerActed=false 时不移动(模拟主循环 if(playerActed) uep)
    const e = {x:ens[0]?ens[0].x:100, y:ens[0]?ens[0].y:100, r:ER, va:0, al:true, sp:ESP, hx:100, hy:100, pt:{x:120,y:100}, pp:false, ppt:0, epr:PRAD};
    const x0=e.x, y0=e.y;
    for(let i=0;i<60;i++){ if(playerActed) uep(e,1/60); }
    out.enemyStill = Math.hypot(e.x-x0, e.y-y0) < 0.01; // 应 true(不动)
    // 4) 玩家按 w 移动 → playerActed=true
    out.cond = {st,ig,cMode,bMode,termMode,fp};
    keys.w=true; up(1/60);
    out.afterMove = playerActed;
    // 5) playerActed=true 后 uep 跑，敌人应移动
    for(let i=0;i<60;i++){ if(playerActed) uep(e,1/60); }
    out.enemyMoved = Math.hypot(e.x-x0, e.y-y0) > 0.5; // 应 true(动了)
    return out;
  });
  console.log(JSON.stringify(res,null,1));
  console.log('ERRORS:', errs.length?errs.slice(0,5):'none');
  const ok = res.initFalse && res.afterNoMove===false && res.enemyStill && res.afterMove===true && res.enemyMoved;
  console.log(ok?'PASS':'FAIL');
  await browser.close();
  process.exit(ok?0:1);
})();
