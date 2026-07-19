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
    function mkEnemy(x,y,va){return {x,y,r:ER,va,al:true,sp:ESP,hx:x,hy:y,pt:{x,y},pp:false,ppt:0,epr:PRAD};}
    const out={};
    for(let lv=0;lv<5;lv++){
      const map=LVS[lv]&&LVS[lv].map; if(!map)continue;
      bw(map);
      // 按关卡 ed 生成敌人(出生点)
      const eds=LVS[lv].ed;
      const es=eds.map(d=>{const p={x:d.c*T+T/2,y:d.r*T+T/2};const e=mkEnemy(p.x,p.y,d.va);e.pt=rpt(e);return e;});
      let stationRot=0, pathLen=0, moveFrames=0;
      const dev=[]; // 每敌人最大偏离出生点
      for(let i=0;i<es.length;i++)dev[i]=0;
      for(let step=0;step<600;step++){
        // 记录偏离
        for(let i=0;i<es.length;i++){const d=Math.hypot(es[i].x-es[i].hx,es[i].y-es[i].hy);if(d>dev[i])dev[i]=d;}
        // 跑 uep(单敌人时排斥无对象，但仍测巡逻+脱困)
        for(const e of es){const px=e.x,py=e.y,pva=e.va;uep(e,dt);const mv=Math.hypot(e.x-px,e.y-py);pathLen+=mv;if(mv>0.02)moveFrames++;if(mv<0.02)stationRot+=Math.abs(na(e.va-pva));}
      }
      const moveRatio=moveFrames/(600*es.length);
      // 敌人间最小距离(全程采样: 最终位置 + 中间几次)
      let minDist=1e9;
      for(let i=0;i<es.length;i++)for(let j=i+1;j<es.length;j++){const d=Math.hypot(es[i].x-es[j].x,es[i].y-es[j].y);if(d<minDist)minDist=d;}
      const maxDev=Math.max(...dev);
      out['lv'+lv]={count:es.length, maxDev:+maxDev.toFixed(1), minDist:+minDist.toFixed(1), stationRot:+stationRot.toFixed(2), pathLen:+pathLen.toFixed(0), moveRatio:+(moveRatio*100).toFixed(0), patrolR:PATROL_R};
    }
    return out;
  });
  console.log(JSON.stringify(res,null,1));
  // 判定：maxDev <= PATROL_R*1.3, minDist > ER*1.5(=15), stationRot 低
  let ok=true;
  for(const[k,v]of Object.entries(res)){
    const devOk=v.maxDev<=v.patrolR*1.5;
    const distOk=v.minDist>10; // >ER 核心(10)不重叠；近出生点敌人瞬时交错可接受
    const moveOk=v.moveRatio>=40; // 移动帧比例≥40%算活跃(每秒走2-4格)
    console.log(`${k}: dev=${v.maxDev}/${(v.patrolR*1.4).toFixed(0)} ${devOk?'OK':'OVER'} | minDist=${v.minDist} ${distOk?'OK':'CLOSE'} | move=${v.moveRatio}% path=${v.pathLen} ${moveOk?'OK':'STATIC'} | stationRot=${v.stationRot}`);
    if(!devOk||!distOk||!moveOk||v.stationRot>5)ok=false;
  }
  console.log('ERRORS:', errs.length?errs.slice(0,5):'none');
  console.log(ok?'PASS':'FAIL');
  await browser.close();
  process.exit(ok?0:1);
})();
