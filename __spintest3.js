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
      let px=e.x,py=e.y,pva=e.va, stationRot=0, pathLen=0,minX=1e9,maxX=-1e9,minY=1e9,maxY=-1e9;
      let stuckFrames=0, vaReversals=0, prevVaDelta=0;
      const sx=e.x, sy=e.y;
      for(let i=0;i<steps;i++){ uep(e,dt);
        const moved=Math.hypot(e.x-px,e.y-py);
        pathLen+=moved;
        if(moved<0.02){ stationRot+=Math.abs(na(e.va-pva)); stuckFrames++; }
        const dv=na(e.va-pva);
        if((prevVaDelta>0.005&&dv<-0.005)||(prevVaDelta<-0.005&&dv>0.005)) vaReversals++;
        prevVaDelta=dv;
        if(e.x<minX)minX=e.x;if(e.x>maxX)maxX=e.x;if(e.y<minY)minY=e.y;if(e.y>maxY)maxY=e.y;
        px=e.x;py=e.y;pva=e.va;
      }
      const netDisp=Math.hypot(e.x-sx,e.y-sy);
      return {x:+e.x.toFixed(0),y:+e.y.toFixed(0),pathLen:+pathLen.toFixed(0),stationRot:+stationRot.toFixed(2),stuckFrames,vaReversals,eff:+(netDisp/(pathLen||1)).toFixed(2),range:+((maxX-minX)+(maxY-minY)).toFixed(0)};
    }
    const out = {};

    // s4: U形凹槽（三面墙，开口朝右），敌人在U底，目标在U外右侧
    walls.length=0; conts.length=0;
    walls.push({x:400,y:380,w:120,h:20});  // 上墙
    walls.push({x:400,y:540,w:120,h:20});  // 下墙
    walls.push({x:400,y:380,w:20,h:180});  // 左墙(底)
    const e4=mkEnemy(470,460,Math.PI); e4.pt={x:700,y:460}; // 目标在右侧外
    out.s4_U = sim(e4,900);

    // s5: 死胡同（三面墙，开口朝下），敌人在尽头，目标在开口外下方
    walls.length=0;
    walls.push({x:440,y:360,w:120,h:20});  // 顶墙
    walls.push({x:440,y:360,w:20,h:140});  // 左墙
    walls.push({x:540,y:360,w:20,h:140});  // 右墙
    const e5=mkEnemy(500,400,0); e5.pt={x:500,y:700}; // 目标在下方外
    out.s5_deadend = sim(e5,900);

    // s6: 窄走廊掉头——敌人在窄走廊中段，目标在身后(需掉头)
    walls.length=0;
    walls.push({x:460,y:300,w:20,h:400}); // 左墙
    walls.push({x:520,y:300,w:20,h:400}); // 右墙(走廊宽40)
    const e6=mkEnemy(500,500,0); e6.pt={x:500,y:350}; // 目标在走廊另一端(身后)
    out.s6_corridor = sim(e6,600);

    // s7~: 真实关卡地图随机放敌人
    const real = {};
    for(let lv=0;lv<5;lv++){
      const map = LVS[lv] && LVS[lv].map;
      if(!map) continue;
      bw(map);
      const empties=[];
      for(let r=1;r<R-1;r++)for(let c=1;c<C-1;c++) if(map[r][c]===0) empties.push({c,r});
      let spin=0, total=0, samples=[];
      for(let s=0;s<20;s++){
        const p=empties[Math.floor(Math.random()*empties.length)];
        const bp={x:p.c*T+T/2,y:p.r*T+T/2};
        const tg=empties[(s*7+3)%empties.length];
        const tp={x:tg.c*T+T/2,y:tg.r*T+T/2};
        const e=mkEnemy(bp.x,bp.y,Math.random()*6.28); e.pt={x:tp.x,y:tp.y};
        const r=sim(e,600);
        total++;
        if(r.stationRot>3 || r.vaReversals>40 || r.eff<0.15){ spin++; samples.push({start:`${p.c},${p.r}`,pathLen:r.pathLen,stationRot:r.stationRot,vaRev:r.vaReversals,eff:r.eff,range:r.range}); }
      }
      real['lv'+lv] = { spin, total, rate:+(spin/total).toFixed(2), samples:samples.slice(0,3) };
    }
    out.real = real;
    return out;
  });
  // 精简分析
  let tot=0,spin=0,severe=0;
  const detail=[];
  for(const[k,v] of Object.entries(res.real)){tot+=v.total;spin+=v.spin;for(const s of v.samples){if(s.range<50)severe++;detail.push(`${k}:${s.start} range${s.range} eff${s.eff} vaRev${s.vaRev}`);}}
  console.log(`打转 ${spin}/${tot} = ${(spin/tot*100).toFixed(0)}% | 严重小范围(range<50): ${severe}`);
  console.log(detail.join(' | '));
  console.log('ERRORS:', errs.length ? errs.slice(0,5) : 'none');
  await browser.close();
})();
