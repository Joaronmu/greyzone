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

  // jump to a boss floor
  await page.evaluate(() => { il(2,1); });
  await page.waitForTimeout(1500);

  // place player away from boss so dl stays ~0 (rest = orange)
  await page.evaluate(() => {
    if(boss){ pl.x = boss.x - 200; pl.y = boss.y; fp=false; }
  });
  await page.waitForTimeout(1200);

  const res = await page.evaluate(() => {
    let out = { found:false };
    meshMap.forEach((rec,ent)=>{
      if(rec.type==='boss'){
        out.found=true;
        const c = rec.sec.material.color;
        out.secColor = { r: Math.round(c.r*255), g: Math.round(c.g*255), b: Math.round(c.b*255), hex: c.getHexString() };
        out.dl = ent.dl;
        out.hasMesh = !!rec.mesh;
        out.geoIsZ = rec.mesh && rec.mesh.geometry === zGeo;
      }
    });
    return out;
  });

  console.log('=== BOSS SEC COLOR (rest, dl~0) ==='); console.log(JSON.stringify(res,null,2));
  console.log('=== ERRORS ('+errors.length+') ==='); errors.forEach(e=>console.log(e));
  console.log('=== CONSOLE (warn/err) ===');
  consoleMsgs.filter(m=>/warn|error/i.test(m)).slice(0,15).forEach(m=>console.log(m));
  await browser.close();
})();
