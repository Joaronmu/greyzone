const { chromium } = require('playwright');
(async () => {
  const errors = [];
  const consoleMsgs = [];
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
  });
  const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
  page.on('console', m => consoleMsgs.push(m.type()+': '+m.text()));
  page.on('pageerror', e => errors.push('PAGEERROR: '+e.message));
  try {
    await page.goto('http://127.0.0.1:8123/stealth-game-3d.html', { waitUntil: 'load', timeout: 30000 });
  } catch (e) { errors.push('GOTO: '+e.message); }
  // wait for a couple seconds of animation
  await page.waitForTimeout(3500);
  // probe state from the page
  const probe = await page.evaluate(() => {
    const gl = document.getElementById('gl');
    const ov = document.getElementById('ov');
    const errbox = document.getElementById('errbox');
    let glOk=false, glPixelsNonBlank=false;
    try {
      const ctx = gl.getContext('webgl') || gl.getContext('webgl2');
      glOk = !!ctx;
      if (ctx) {
        const px = new Uint8Array(4*100);
        ctx.readPixels(0,0,10,10,ctx.RGBA,ctx.UNSIGNED_BYTE,px);
        glPixelsNonBlank = px.some(v=>v!==0);
      }
    } catch(e){}
    return {
      hasGL: !!gl, glW: gl?gl.width:0, glH: gl?gl.height:0,
      hasOV: !!ov, ovW: ov?ov.width:0, ovH: ov?ov.height:0,
      glOk, glPixelsNonBlank,
      errboxText: errbox? errbox.textContent : null,
      gameVer: (typeof GAME_VER!=='undefined')?GAME_VER:'undef',
      stVar: (typeof st!=='undefined')?st:'undef'
    };
  });
  await page.screenshot({ path: 'render_shot.png' });
  console.log('=== PROBE ===');
  console.log(JSON.stringify(probe, null, 2));
  console.log('=== PAGE ERRORS ('+errors.length+') ===');
  errors.forEach(e=>console.log(e));
  console.log('=== CONSOLE ('+consoleMsgs.length+') ===');
  consoleMsgs.slice(0,20).forEach(m=>console.log(m));
  await browser.close();
})();
