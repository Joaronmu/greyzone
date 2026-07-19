const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto('http://127.0.0.1:8123/stealth-game-3d.html', { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: 'poster_ref_start.png' });
  // try to move into the game world: click center to lock pointer, press W a bit
  try {
    await page.mouse.move(640, 360);
    await page.mouse.click(640, 360);
    await page.waitForTimeout(500);
    // walk forward a little by holding W, look around with mouse
    await page.keyboard.down('w');
    await page.waitForTimeout(1200);
    await page.keyboard.up('w');
    await page.mouse.move(740, 360);
    await page.waitForTimeout(300);
    await page.mouse.move(560, 340);
    await page.waitForTimeout(600);
    await page.screenshot({ path: 'poster_ref_game.png' });
    // crouch and look at an enemy direction
    await page.keyboard.press('c');
    await page.waitForTimeout(400);
    await page.screenshot({ path: 'poster_ref_crouch.png' });
  } catch(e) { console.log('move err', e.message); }
  const st = await page.evaluate(() => (typeof st!=='undefined')?st:'?').catch(()=>'?');
  console.log('st=', st);
  await browser.close();
})();
