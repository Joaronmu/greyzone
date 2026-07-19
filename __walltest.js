const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
  const page = await browser.newPage();
  const errs = [];
  page.on('console', m => { if (m.type()==='error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('PAGEERR: '+e.message));
  await page.goto('http://127.0.0.1:8123/stealth-game-3d.html', { waitUntil: 'load' });
  await page.waitForTimeout(700);

  const res = await page.evaluate(() => {
    fc=false; boss=null; miniBoss=null;
    const dt=1/60;
    function mkEnemy(x,y,va,hx,hy){return {x,y,r:ER,va,al:true,sp:ESP,hx:(hx??x),hy:(hy??y),pt:{x,y},pp:false,ppt:0,epr:PRAD};}
    function sim(e, steps){
      let pva=e.va, vaAbs=0, pathLen=0, sx=e.x, sy=e.y, returns=0, lastRet=-999;
      for(let i=0;i<steps;i++){
        uep(e,dt);
        vaAbs+=Math.abs(na(e.va-pva));
        pathLen+=Math.hypot(e.x-(e._px??e.x), e.y-(e._py??e.y));
        e._px=e.x; e._py=e.y; pva=e.va;
        if(Math.hypot(e.x-sx,e.y-sy)<8 && i-lastRet>30){returns++; lastRet=i;}
      }
      const netDisp=Math.hypot(e.x-sx,e.y-sy);
      return {end:`${e.x.toFixed(0)},${e.y.toFixed(0)}`, vaTurns:+(vaAbs/(2*Math.PI)).toFixed(2), pathLen:+pathLen.toFixed(0), eff:+(netDisp/(pathLen||1)).toFixed(2), returns};
    }
    const out={};

    // s7: L形凸角(墙角外)，敌人贴墙绕过
    walls.length=0; conts.length=0;
    walls.push({x:400,y:400,w:120,h:20});   // 横墙
    walls.push({x:500,y:400,w:20,h:120});   // 竖墙(构成L外角)
    const e7=mkEnemy(470,460,0, 470,460); e7.pt={x:600,y:460};
    out.s7_Lcorner = sim(e7,700);

    // s8: 凹角内(U形小凹)，敌人在凹角内目标在外
    walls.length=0;
    walls.push({x:400,y:400,w:20,h:120});   // 左壁
    walls.push({x:400,y:500,w:120,h:20});   // 底
    walls.push({x:500,y:400,w:20,h:120});   // 右壁
    const e8=mkEnemy(460,460,Math.PI/2, 460,460); e8.pt={x:460,y:580};
    out.s8_concave = sim(e8,700);

    // s9: 墙后目标(目标在墙另一侧，最易转圈)：长墙，目标正对墙后
    walls.length=0;
    walls.push({x:490,y:300,w:20,h:300});
    const e9=mkEnemy(450,450,0, 450,450); e9.pt={x:560,y:450};
    out.s9_behindWall = sim(e9,800);

    // s10: 真实地图靠墙出生点——每关找靠墙的空格放敌人，目标设对角
    const real={};
    for(let lv=0;lv<5;lv++){
      const map=LVS[lv]&&LVS[lv].map; if(!map)continue;
      bw(map);
      // 找靠墙空格(邻居有墙)
      const wallAdj=[];
      for(let r=1;r<R-1;r++)for(let c=1;c<C-1;c++){
        if(map[r][c]!==0)continue;
        let n=0;
        if(map[r-1][c]===1||map[r+1][c]===1||map[r][c-1]===1||map[r][c+1]===1)n++;
        if(n>=1)wallAdj.push({c,r});
      }
      let spin=0,total=0;const samples=[];
      for(let s=0;s<10;s++){
        const p=wallAdj[Math.floor(Math.random()*wallAdj.length)];
        const bp={x:p.c*T+T/2,y:p.r*T+T/2};
        const e=mkEnemy(bp.x,bp.y,Math.random()*6.28);
        e.pt=rpt(e); // 真实rpt目标(出生点附近)
        const r=sim(e,500);
        total++;
        if(r.vaTurns>2.5){spin++; if(samples.length<3)samples.push({start:`${p.c},${p.r}`,vt:r.vaTurns,eff:r.eff,ret:r.returns,end:r.end});}
      }
      real['lv'+lv]={spin,total,rate:+(spin/total).toFixed(2),samples};
    }
    out.real=real;
    return out;
  });
  console.log(JSON.stringify(res,null,1));
  console.log('ERRORS:', errs.length?errs.slice(0,5):'none');
  await browser.close();
})();
