const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
  const page = await browser.newPage({ viewport:{width:900,height:700} });
  const errs=[]; page.on('pageerror',e=>errs.push('PAGEERR: '+e.message));
  page.on('console',m=>{ if(m.type()==='error') errs.push(m.text()); });
  await page.goto('http://127.0.0.1:8123/stealth-game-3d.html',{waitUntil:'load'});
  await page.waitForFunction(()=>typeof enemyRig!=='undefined' && enemyRig && enemyRig.boneDefs && enemyRig.boneDefs.length>0, {timeout:6000});
  const out = await page.evaluate(async ()=>{
    const rig=enemyRig; const bd=rig.boneDefs; const bones=[];
    for(let i=0;i<bd.length;i++){const b=new THREE.Bone();b.position.set(bd[i].px,bd[i].py,bd[i].pz);b.quaternion.set(bd[i].qx,bd[i].qy,bd[i].qz,bd[i].qw);b.scale.set(bd[i].sx,bd[i].sy,bd[i].sz);b.userData.rest=b.quaternion.clone();bones.push(b);}
    for(let i=0;i<bd.length;i++){if(bd[i].parent>=0)bones[bd[i].parent].add(bones[i]);}
    const skel=new THREE.Skeleton(bones);
    const mesh=new THREE.SkinnedMesh(rig.geo, new THREE.MeshStandardMaterial({color:0x88ccff,roughness:0.7,metalness:0.05}));
    mesh.scale.setScalar(ENEMY_RIG_SCL); mesh.add(bones[0]); mesh.bind(skel);
    scene.add(mesh); mesh.position.set(W/2,0,H/2);
    const X=new THREE.Vector3(1,0,0), q=new THREE.Quaternion();
    const setQ=(bi,ang)=>{q.setFromAxisAngle(X,ang);bones[bi].quaternion.copy(bones[bi].userData.rest).multiply(q);};
    setQ(31,0.5); setQ(36,-0.5); setQ(32,0.35); setQ(37,0.35); setQ(8,-0.2); setQ(20,0.2);
    mesh.updateMatrixWorld(true); skel.update();
    // 记录脚底相对髋的高度，确认腿没飞起
    const hipY=bones[0].getWorldPosition(new THREE.Vector3()).y;
    const lf=bones[33].getWorldPosition(new THREE.Vector3());
    const rf=bones[38].getWorldPosition(new THREE.Vector3());
    return {bones:bd.length, hipY:+hipY.toFixed(1), leftFoot:{x:+lf.x.toFixed(1),y:+lf.y.toFixed(1),z:+lf.z.toFixed(1)}, rightFoot:{x:+rf.x.toFixed(1),y:+rf.y.toFixed(1),z:+rf.z.toFixed(1)}};
  });
  await page.evaluate(()=>{ camera.position.set(W/2+600,250,H/2+0.1); camera.lookAt(W/2,150,H/2); renderer.render(scene,camera); });
  await page.screenshot({path:'walk_side.png'});
  await page.evaluate(()=>{ camera.position.set(W/2+0.1,250,H/2+600); camera.lookAt(W/2,150,H/2); renderer.render(scene,camera); });
  await page.screenshot({path:'walk_front.png'});
  console.log('OUT',JSON.stringify(out),'ERR',errs.length?errs.slice(0,3):'none');
  await browser.close();
})();
