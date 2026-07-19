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

  const setup = await page.evaluate(() => {
    let found=null;
    for (let li=0; li<5 && !found; li++)
      for (let cf=0; cf<3 && !found; cf++){
        il(li,cf);
        if (typeof conts!=='undefined' && conts.length>0) found={li,cf,n:conts.length};
      }
    return found;
  });
  await page.waitForTimeout(1500);

  const res = await page.evaluate(() => {
    const out = { contGeoLoaded: !!contGeo, contTexLoaded: !!contTex,
                  contMeshes: (typeof contMeshes!=='undefined'?contMeshes.length:0),
                  usingContGeo: 0, sampleScale: null, collision: null };
    if (typeof contMeshes!=='undefined') {
      for (const m of contMeshes) {
        if (m.geometry === contGeo) { out.usingContGeo++; if(out.sampleScale===null) out.sampleScale = m.scale.x; }
      }
    }
    if (typeof conts!=='undefined' && conts.length>0) {
      const c = conts[0];
      out.collision = { atCenter: cw(c.x, c.y, 1), farAway: cw(c.x + 200, c.y + 200, 1) };
    }
    return out;
  });

  console.log('level found=', JSON.stringify(setup));
  console.log('contGeoLoaded=', res.contGeoLoaded, 'contTexLoaded=', res.contTexLoaded);
  console.log('contMeshes=', res.contMeshes, 'usingContGeo=', res.usingContGeo, 'scale=', res.sampleScale);
  console.log('collision(should be true/false)=', JSON.stringify(res.collision));
  console.log('errors=', errors.length, errors.slice(0,5).join(' | '), 'consoleErr=', consoleMsgs.length);
  await browser.close();
  const ok = res.contGeoLoaded && res.usingContGeo > 0 && res.collision && res.collision.atCenter===true && res.collision.farAway===false && errors.length===0;
  console.log(ok ? 'PASS: trash model replaces container visual, collision preserved' : 'CHECK ABOVE');
})();
