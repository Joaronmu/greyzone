const { chromium } = require('playwright');
(async () => {
  const errors = [], consoleMsgs = [];
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox']
  });
  const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
  page.on('console', m => { if (m.type()==='error') consoleMsgs.push('ERR: '+m.text()); });
  page.on('pageerror', e => errors.push('PAGEERR: '+e.message));
  await page.goto('http://127.0.0.1:8123/stealth-game-3d.html', { waitUntil: 'load', timeout: 40000 });
  await page.waitForTimeout(2500);

  await page.evaluate(() => { il(4,0); });   // level 5, floor 0 -> spawns mini-boss
  await page.waitForTimeout(1200);
  // place player far so dl~0
  await page.evaluate(() => { if(miniBoss){ pl.x = miniBoss.x - 240; pl.y = miniBoss.y; fp=false; } });
  await page.waitForTimeout(1200);

  const res = await page.evaluate(() => {
    let out = { miniFound:false, enemyFound:false };
    meshMap.forEach((rec,ent)=>{
      const hex = rec.sec.material.color.getHexString();
      if(rec.type==='mini'){ out.miniFound=true; out.mini={ secHex:hex, dl:ent.dl, vr:ent.vr, epr:ent.epr }; }
      if(rec.type==='enemy' && !out.enemyFound){ out.enemyFound=true; out.enemy={ secHex:hex, vr:ent.vr }; }
    });
    return out;
  });

  console.log('hasMini=', res.miniFound, 'hasEnemy=', res.enemyFound);
  console.log('MINI cone =', res.mini && res.mini.secHex, 'vr=', res.mini && res.mini.vr, 'dl=', res.mini && res.mini.dl);
  console.log('ENEMY cone =', res.enemy && res.enemy.secHex, 'vr=', res.enemy && res.enemy.vr);
  console.log('errors=', errors.length, errors.slice(0,5).join(' | '), 'consoleErr=', consoleMsgs.length);
  await browser.close();
  const ok = res.miniFound && res.mini.secHex==='4488ff' && res.mini.vr===res.enemy.vr && errors.length===0;
  console.log(ok ? 'PASS: mini cone BLUE at rest, vr matches enemy, no errors' : 'CHECK ABOVE');
})();
