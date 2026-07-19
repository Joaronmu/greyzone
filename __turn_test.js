const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader','--no-sandbox'] });
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERR: '+e.message));
  await page.goto('http://127.0.0.1:8123/stealth-game-3d.html', { waitUntil: 'load' });
  await page.waitForTimeout(500);

  const res = await page.evaluate(() => {
    walls.length=0; conts.length=0; fc=false; boss=null; miniBoss=null; // 开阔无墙
    const dt=1/60;
    function mk(va,dl){return {x:100,y:100,r:ER,va,al:true,sp:ESP,hx:100,hy:100,pt:{x:200,y:100},pp:false,ppt:0,epr:PRAD,dl,_chkT:0,_chkX:100,_chkY:100,_wf:0,_stuck:0,_lastA:null};}
    // e1: dl=0, va=π(西), 目标在东(200,100)→desired=0, 应转向
    const e1=mk(Math.PI,0); const va1=e1.va;
    for(let i=0;i<60;i++) uep(e1,dt);
    const turned = Math.abs(na(e1.va-va1)) > 0.1;
    // e2: dl=0.5(检测到玩家), va=π, 目标东, 应中止转向(va 不变)
    const e2=mk(Math.PI,0.5); const va2=e2.va;
    for(let i=0;i<60;i++) uep(e2,dt);
    const still = Math.abs(na(e2.va-va2)) < 0.01;
    return {turned, still, e1va:+e1.va.toFixed(2), e2va:+e2.va.toFixed(2)};
  });
  console.log(JSON.stringify(res,null,1));
  console.log('ERRORS:', errs.length?errs.slice(0,5):'none');
  const ok = res.turned && res.still;
  console.log(ok?'PASS':'FAIL');
  await browser.close();
  process.exit(ok?0:1);
})();
