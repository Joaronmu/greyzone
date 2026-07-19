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

  // jump to a floor that spawns a mini-boss: level 4 floor 0 (li===4 && fi!==2)
  await page.evaluate(() => { il(4,0); });
  await page.waitForTimeout(1500);

  // place player far from mini so dl~0
  await page.evaluate(() => {
    if(miniBoss){ pl.x = miniBoss.x - 220; pl.y = miniBoss.y; fp=false; }
  });
  await page.waitForTimeout(1200);

  const res = await page.evaluate(() => {
    let out = { miniFound:false, enemyFound:false };
    meshMap.forEach((rec,ent)=>{
      const c = rec.sec.material.color;
      const hex = c.getHexString();
      if(rec.type==='mini'){
        out.miniFound=true;
        out.mini = { secHex:hex, dl:ent.dl, vr:ent.vr, epr:ent.epr, geoIsBoss: rec.mesh && rec.mesh.geometry===bossGeo };
      }
      if(rec.type==='enemy' && !out.enemyFound){
        out.enemyFound=true;
        out.enemy = { secHex:hex, vr:ent.vr };
      }
    });
    return out;
  });

  console.log('=== MINI vs ENEMY (rest, dl~0) ==='); console.log(JSON.stringify(res,null,2));
  console.log('=== ERRORS ('+errors.length+') ==='); errors.forEach(e=>console.log(e));
  console.log('=== CONSOLE (warn/err) ===');
  consoleMsgs.filter(m=>/warn|error/i.test(m)).slice(0,15).forEach(m=>console.log(m));
  await browser.close();
})();
