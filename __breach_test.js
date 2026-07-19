const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader','--no-sandbox'] });
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERR: '+e.message));
  await page.goto('http://127.0.0.1:8123/stealth-game-3d.html', { waitUntil: 'load' });
  await page.waitForTimeout(500);

  const res = await page.evaluate(() => {
    const stats = { total:0, fail:0, failCases:[] };
    for(let i=0;i<2000;i++){
      initBreach(0);
      stats.total++;
      let ok=true, reason='';
      // 3目标互异
      if(bTargets[0]===bTargets[1]||bTargets[0]===bTargets[2]||bTargets[1]===bTargets[2]){ok=false;reason='目标值重复';}
      // 第1步: row锁第0行, t0 在第0行存在且唯一
      let c0=-1,cnt0=0;for(let c=0;c<4;c++){if(bGrid[0][c]===bTargets[0]){c0=c;cnt0++;}}
      if(c0<0){ok=false;reason='第0行无t0';}else if(cnt0!==1){ok=false;reason='第0行t0不唯一('+cnt0+')';}
      // 第2步: col锁c0列, t1 在c0列存在且唯一
      if(c0>=0){let r1=-1,cnt1=0;for(let r=0;r<4;r++){if(bGrid[r][c0]===bTargets[1]){r1=r;cnt1++;}}
        if(r1<0){ok=false;reason='c0列无t1';}else if(cnt1!==1){ok=false;reason='c0列t1不唯一('+cnt1+')';}
        // 第3步: row锁r1行, t2 在r1行存在且唯一
        if(r1>=0){let cnt2=0;for(let c=0;c<4;c++){if(bGrid[r1][c]===bTargets[2])cnt2++;}
          if(cnt2===0){ok=false;reason='r1行无t2';}else if(cnt2!==1){ok=false;reason='r1行t2不唯一('+cnt2+')';}
        }
      }
      if(!ok){stats.fail++;if(stats.failCases.length<3)stats.failCases.push({bTargets:[...bTargets],reason,row0:[...bGrid[0]]});}
    }
    // 验证高亮: drawBreach 不报错且 inLine 高亮存在(检查 canvas 像素变化较难,仅确认无报错)
    initBreach(0); bMode=true;
    try{ drawBreach(); stats.drawOk=true; }catch(e){ stats.drawOk=false; stats.drawErr=String(e); }
    return stats;
  });
  console.log(JSON.stringify(res,null,1));
  console.log('ERRORS:', errs.length?errs.slice(0,5):'none');
  await browser.close();
})();
