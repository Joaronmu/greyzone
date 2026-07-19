const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
  const page = await browser.newPage({ viewport:{width:1000,height:700} });
  const errs=[]; page.on('pageerror',e=>errs.push('PAGEERR: '+e.message));
  page.on('console',m=>{ if(m.type()==='error') errs.push(m.text()); });
  await page.goto('http://127.0.0.1:8123/stealth-game-3d.html',{waitUntil:'load'});
  await page.waitForFunction(()=>typeof enemyRig!=='undefined'&&enemyRig&&enemyRig.boneDefs, {timeout:6000});
  await page.waitForTimeout(1500); // 让游戏循环跑一会

  const r = await page.evaluate(()=>{
    // 找一个骨骼版敌人 rec + 实体 e
    let rec=null,e=null;
    meshMap.forEach((v,k)=>{ if(!rec && v.type==='enemy' && v.legLup){ rec=v; e=k; } });
    if(!rec||!e) return {found:false};
    const rest = rec.legLup.userData.rest;
    const q0 = {x:rec.legLup.quaternion.x,y:rec.legLup.quaternion.y,z:rec.legLup.quaternion.z,w:rec.legLup.quaternion.w};
    // 强制让该敌人"移动"一帧：模拟位移再调 updEnemy
    const ox=e.x, oy=e.y;
    e.x+=5; e.y+=3;       // 制造 mv>0.12
    e._walk=1; e._phase=(e._phase||0)+0.8;
    updEnemy(rec,e);
    const q1 = {x:rec.legLup.quaternion.x,y:rec.legLup.quaternion.y,z:rec.legLup.quaternion.z,w:rec.legLup.quaternion.w};
    const dq=Math.hypot(q1.x-rest.x,q1.y-rest.y,q1.z-rest.z,q1.w-rest.w);
    e.x=ox; e.y=oy; // 还原
    return {found:true, legLup:'ok', legRup:!!rec.legRup, legL:!!rec.legL, armLup:!!rec.armLup,
            qRest:{x:+rest.x.toFixed(3),y:+rest.y.toFixed(3),z:+rest.z.toFixed(3),w:+rest.w.toFixed(3)},
            qDriven:{x:+q1.x.toFixed(3),y:+q1.y.toFixed(3),z:+q1.z.toFixed(3),w:+q1.w.toFixed(3)},
            deltaFromRest:+dq.toFixed(4)};
  });
  console.log('RESULT:', JSON.stringify(r));
  console.log('ERRORS:', errs.length?errs.slice(0,5):'none');
  await page.screenshot({path:'walk_ingame.png'});
  await browser.close();
  const ok = r.found && r.deltaFromRest>0.01;
  console.log(ok?'PASS: 腿骨被程序化驱动，偏离 rest':'FAIL: 腿骨未动');
  process.exit(ok?0:1);
})();
