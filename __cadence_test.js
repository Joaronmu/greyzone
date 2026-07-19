const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
  const page = await browser.newPage({ viewport:{width:1000,height:700} });
  const errs=[]; page.on('pageerror',e=>errs.push('PAGEERR: '+e.message));
  page.on('console',m=>{ if(m.type()==='error') errs.push(m.text()); });
  await page.goto('http://127.0.0.1:8123/stealth-game-3d.html',{waitUntil:'load'});
  await page.waitForFunction(()=>typeof enemyRig!=='undefined'&&enemyRig&&enemyRig.boneDefs, {timeout:6000});
  await page.waitForTimeout(1200);

  const r = await page.evaluate(()=>{
    let rec=null,e=null;
    meshMap.forEach((v,k)=>{ if(!rec && v.type==='enemy' && v.legLup){ rec=v; e=k; } });
    if(!rec||!e) return {found:false};
    // 模拟匀速行走 3 秒（60fps → 180 帧），测量步频
    gdt=1/60;
    e._walk=1; e._phase=0; e._px=undefined; e._py=undefined;
    const ox=e.x, oy=e.y;
    const frames=180, dt=1/60;
    let zeroCross=0, prev=Math.sin(0);
    for(let i=0;i<frames;i++){
      e.x+=ESP;            // 全速前进，每帧位移=ESP
      updEnemy(rec,e);
      const s=Math.sin(e._phase||0);
      if((prev<=0 && s>0) || (prev>=0 && s<0)) zeroCross++;
      prev=s;
    }
    // 每个完整步态周期(左右各一步)相位走 2π；过零次数≈2×周期数(每周期2次过零)
    const cycles=(e._phase||0)/(2*Math.PI);
    const hzByPhase=cycles/3;          // 周期/秒(步态周期频率)
    const stepsPerSec=cycles*2/3;      // 步/秒(每周期2步)
    e.x=ox; e.y=oy;
    return {found:true, cycles:+cycles.toFixed(2), gaitHz:+hzByPhase.toFixed(2), stepsPerSec:+stepsPerSec.toFixed(2), zeroCross};
  });
  console.log('RESULT:', JSON.stringify(r));
  console.log('ERRORS:', errs.length?errs.slice(0,3):'none');
  await browser.close();
  // 现实步行：~2 步/秒、~1Hz 步态周期。允许 0.8~1.4Hz。
  const ok = r.found && r.gaitHz>0.7 && r.gaitHz<1.4 && r.stepsPerSec>1.4 && r.stepsPerSec<2.6;
  console.log(ok?`PASS: 步频 ${r.stepsPerSec}步/秒 (≈${r.gaitHz}Hz)，接近现实`:`FAIL: 步频 ${r.stepsPerSec}步/秒偏离现实`);
  process.exit(ok?0:1);
})();
