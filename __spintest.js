const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
  const page = await browser.newPage();
  const errs = [];
  page.on('console', m => { if (m.type()==='error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('PAGEERR: '+e.message));
  await page.goto('http://127.0.0.1:8123/stealth-game-3d.html', { waitUntil: 'load' });
  await page.waitForTimeout(600);

  const res = await page.evaluate(() => {
    fc = false; boss = null;
    const dt = 1/60;
    function mkEnemy(x,y,va){return {x,y,r:ER*0.6,va,al:true,sp:ESP,hx:x,hy:y,pt:{x,y},pp:false,ppt:0,epr:PRAD};}
    function sim(e, steps){
      let px=e.x,py=e.y,pva=e.va, stationRot=0, pathLen=0,rev=0,minX=1e9,maxX=-1e9,minY=1e9,maxY=-1e9,prevDy=0;
      for(let i=0;i<steps;i++){ uep(e,dt);
        const moved=Math.hypot(e.x-px,e.y-py);
        pathLen+=moved;
        if(moved<0.01) stationRot+=Math.abs(na(e.va-pva));
        const dy=e.y-py;
        if((prevDy<-0.001&&dy>0.001)||(prevDy>0.001&&dy<-0.001))rev++;
        prevDy=dy;
        if(e.x<minX)minX=e.x;if(e.x>maxX)maxX=e.x;if(e.y<minY)minY=e.y;if(e.y>maxY)maxY=e.y;
        px=e.x;py=e.y;pva=e.va;
      }
      return {x:+e.x.toFixed(1),y:+e.y.toFixed(1),va:+e.va.toFixed(2),pathLen:+pathLen.toFixed(1),stationRot:+stationRot.toFixed(2),yRange:+((maxY-minY)).toFixed(1),dyReversals:rev};
    }
    // 场景1：墙角（两面墙夹住），应脱离且不空转
    walls.length=0; conts.length=0;
    walls.push({x:540,y:440,w:20,h:120}); // 右竖墙
    walls.push({x:440,y:440,w:100,h:20}); // 上横墙
    const e1=mkEnemy(500,500,0); e1.pt={x:520,y:520};
    const s1=sim(e1,600);

    // 场景2：目标在墙另一侧，应贴墙滑向目标不弹开/不空转
    walls.length=0;
    walls.push({x:540,y:300,w:20,h:300}); // 一道竖墙，目标在墙右侧
    const e2=mkEnemy(500,450,0); e2.pt={x:700,y:450}; // 目标在墙右(540~560)对面
    const s2=sim(e2,800);

    // 场景3：完全封死(四面墙)，应冻结朝向不疯狂打转
    walls.length=0;
    walls.push({x:470,y:470,w:60,h:10}); // 上
    walls.push({x:470,y:520,w:60,h:10}); // 下
    walls.push({x:470,y:480,w:10,h:40}); // 左
    walls.push({x:520,y:480,w:10,h:40}); // 右
    const e3=mkEnemy(495,500,0); e3.pt={x:495,y:500};
    const s3=sim(e3,300);

    return {s1,s2,s3};
  });
  console.log('RESULT:', JSON.stringify(res,null,1));
  console.log('ERRORS:', errs.length ? errs.slice(0,5) : 'none');
  await browser.close();
  const ok = res.s1.stationRot<1 && res.s1.pathLen>30
          && res.s2.stationRot<1.5 && res.s2.pathLen>30
          && res.s3.stationRot<2; // 封死时几乎不转(冻结朝向)
  console.log(ok?'PASS: 三场景均不打转':'FAIL: 仍有打转');
  process.exit(ok?0:1);
})();
