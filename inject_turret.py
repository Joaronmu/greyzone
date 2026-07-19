import re
html=open("stealth-game-3d.html","r",encoding="utf-8").read()
b64=open("turret_model.b64","r").read().strip()

# 1) inline turret model
assert html.count("<body>\n")==1
html=html.replace("<body>\n", "<body>\n<script type=\"text/plain\" id=\"tmodel\">"+b64+"</script>\n", 1)

# 2) turret loader + consts + hud + tuning (after enemy loader)
anchor_emat="function enemyMakeMat(){const m=new THREE.MeshStandardMaterial({color:0xffffff,map:enemyTex,roughness:0.62,metalness:0.08,emissive:0x000000,emissiveIntensity:0});enemyMats.push(m);return m;}"
assert html.count(anchor_emat)==1
turret_block = r'''
// ===== 机枪 FBX 模型（PM3D）+ 枪口=扇形圆心 =====
let turretGeo=null,turretTex=null,turretMats=[];
let TURRET_ROT=0, TURRET_MUZZLE=15, TURRET_SCL=0.6;
(function(){
 const el=document.getElementById('tmodel');if(!el)return;
 try{
  const bin=Uint8Array.from(atob(el.textContent.replace(/\s/g,'')),c=>c.charCodeAt(0)).buffer;
  const dv=new DataView(bin);
  if(String.fromCharCode(dv.getUint8(0),dv.getUint8(1),dv.getUint8(2),dv.getUint8(3))!=='PM3D')return;
  let o=4;const nclu=dv.getUint32(o,true);o+=4;const ntri=dv.getUint32(o,true);o+=4;const texlen=dv.getUint32(o,true);o+=4;
  const pos=new Float32Array(bin,o,nclu*3);o+=nclu*12;
  const nrm=new Float32Array(bin,o,nclu*3);o+=nclu*12;
  const uv=new Float32Array(bin,o,nclu*2);o+=nclu*8;
  const idx=new Uint32Array(bin,o,ntri*3);o+=ntri*12;
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.BufferAttribute(pos,3));
  g.setAttribute('normal',new THREE.BufferAttribute(nrm,3));
  g.setAttribute('uv',new THREE.BufferAttribute(uv,2));
  g.setIndex(new THREE.BufferAttribute(idx,1));
  g.computeBoundingBox();
  const bb=g.boundingBox;const cx0=(bb.min.x+bb.max.x)/2,cz0=(bb.min.z+bb.max.z)/2;
  g.translate(-cx0,-bb.min.y,-cz0);
  turretGeo=g;
  const url=URL.createObjectURL(new Blob([new Uint8Array(bin,o,texlen)],{type:'image/png'}));
  new THREE.TextureLoader().load(url,(t)=>{t.flipY=false;t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;turretTex=t;for(const m of turretMats){m.map=t;m.needsUpdate=true;}},undefined,(e)=>console.warn('turret tex fail',e));
 }catch(e){console.warn('turret model load fail',e);}
})();
function turretMakeMat(){const m=new THREE.MeshStandardMaterial({color:0xffffff,map:turretTex,roughness:0.5,metalness:0.3});turretMats.push(m);return m;}
function turretHud(){octx.fillStyle="rgba(0,0,0,.55)";octx.fillRect(W/2-190,60,380,18);octx.fillStyle="#ffcf40";octx.font='11px "Segoe UI",monospace';octx.textAlign="center";octx.fillText("机枪 ROT="+TURRET_ROT.toFixed(2)+" MUZZLE="+TURRET_MUZZLE.toFixed(0)+"  [N/M转向 ,/.枪口距]",W/2,73);}
window.addEventListener("keydown",function(e){const k=e.key;let h=true;
 if(k==='n')TURRET_ROT-=0.1;else if(k==='m')TURRET_ROT+=0.1;
 else if(k===',')TURRET_MUZZLE-=1;else if(k==='.')TURRET_MUZZLE+=1;
 else h=false;
 if(h){e.preventDefault();meshMap.forEach((rec,ent)=>{if(rec.type==='turret'&&rec.mesh){rec.mesh.rotation.y=TURRET_ROT;rec.mesh.scale.setScalar(TURRET_SCL);}});console.log("TURRET ROT",TURRET_ROT,"MUZZLE",TURRET_MUZZLE);}
},true);
'''
html=html.replace(anchor_emat, anchor_emat+turret_block, 1)

# 3) makeTurretMesh replacement
old_tm='''function makeTurretMesh(t){
const g=new THREE.Group();
const base=new THREE.Mesh(new THREE.BoxGeometry(18,30,18),new THREE.MeshStandardMaterial({color:0x333a44,metalness:0.6,roughness:0.4}));base.position.y=15;g.add(base);
const barrelPivot=new THREE.Group();g.add(barrelPivot);
const barrel=new THREE.Mesh(new THREE.BoxGeometry(22,6,6),new THREE.MeshStandardMaterial({color:0xcc1111,emissive:0x550000,emissiveIntensity:0.4}));barrel.position.set(11,18,0);barrelPivot.add(barrel);
const ring=new THREE.Mesh(new THREE.RingGeometry(t.vr-2,t.vr,56),new THREE.MeshBasicMaterial({color:0x990000,transparent:true,opacity:0.5,side:THREE.DoubleSide,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.y=0.5;g.add(ring);
const sec=new THREE.Mesh(makeConeGeo(),new THREE.MeshBasicMaterial({color:0x990000,transparent:true,opacity:0.13,side:THREE.DoubleSide,depthWrite:false}));sec.position.y=0;g.add(sec);
scene.add(g);return {g,base,barrelPivot,barrel,ring,sec,type:'turret'};
}'''
new_tm='''function makeTurretMesh(t){
const g=new THREE.Group();
const barrelPivot=new THREE.Group();g.add(barrelPivot);
let mesh=null;
if(turretGeo){
 mesh=new THREE.Mesh(turretGeo,turretMakeMat());mesh.scale.setScalar(TURRET_SCL);mesh.rotation.y=TURRET_ROT;barrelPivot.add(mesh);
}else{
 const base=new THREE.Mesh(new THREE.BoxGeometry(18,30,18),new THREE.MeshStandardMaterial({color:0x333a44,metalness:0.6,roughness:0.4}));base.position.y=15;g.add(base);
 const barrel=new THREE.Mesh(new THREE.BoxGeometry(22,6,6),new THREE.MeshStandardMaterial({color:0xcc1111,emissive:0x550000,emissiveIntensity:0.4}));barrel.position.set(11,18,0);barrelPivot.add(barrel);
}
const ring=new THREE.Mesh(new THREE.RingGeometry(t.vr-2,t.vr,56),new THREE.MeshBasicMaterial({color:0x990000,transparent:true,opacity:0.5,side:THREE.DoubleSide,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.y=0.5;g.add(ring);
const sec=new THREE.Mesh(makeConeGeo(),new THREE.MeshBasicMaterial({color:0x990000,transparent:true,opacity:0.13,side:THREE.DoubleSide,depthWrite:false}));sec.position.y=0;g.add(sec);
scene.add(g);return {g,barrelPivot,mesh,ring,sec,type:'turret'};
}'''
assert html.count(old_tm)==1, "makeTurretMesh not found"
html=html.replace(old_tm, new_tm, 1)

# 4) updTurret replacement
old_ut='''function updTurret(rec,t){
rec.g.position.set(t.x,0,t.y);
rec.barrelPivot.rotation.y=-t.va;
const c=rec.sec.material.color;c.setRGB(0.6+0.4*t.dl,0.05,0.05);
updateCone(rec,t.x,t.y,t.va,VA/2,t.vr,c,0.12+t.dl*0.3);
rec.ring.material.opacity=0.4+t.dl*0.5;rec.ring.material.color.copy(c);
}'''
new_ut='''function updTurret(rec,t){
rec.g.position.set(t.x,0,t.y);
rec.barrelPivot.rotation.y=-t.va;
const mx=t.x+TURRET_MUZZLE*Math.cos(t.va),my=t.y+TURRET_MUZZLE*Math.sin(t.va);
const c=rec.sec.material.color;c.setRGB(0.6+0.4*t.dl,0.05,0.05);
rec.sec.position.set(mx-t.x,0,my-t.y);
rec.ring.position.set(mx-t.x,0.5,my-t.y);
updateCone(rec,mx,my,t.va,VA/2,t.vr,c,0.12+t.dl*0.3);
rec.ring.material.opacity=0.4+t.dl*0.5;rec.ring.material.color.copy(c);
}'''
assert html.count(old_ut)==1, "updTurret not found"
html=html.replace(old_ut, new_ut, 1)

# 5) udet turret detection from muzzle
anchor_iv="const r2=iv(t,pl,VA,t.vr);"
assert html.count(anchor_iv)==1
html=html.replace(anchor_iv, "const _tmx=t.x+TURRET_MUZZLE*Math.cos(t.va),_tmy=t.y+TURRET_MUZZLE*Math.sin(t.va),r2=iv({x:_tmx,y:_tmy,va:t.va},pl,VA,t.vr);", 1)

# 6) minimap turret cone from muzzle
anchor_mm="const px=cx(t.x),py=y+t.y*s;"
assert html.count(anchor_mm)==1
html=html.replace(anchor_mm, "const px=cx(t.x+TURRET_MUZZLE*Math.cos(t.va)),py=y+(t.y+TURRET_MUZZLE*Math.sin(t.va))*s;", 1)

# 7) turretHud call in loop
anchor_loop="dhud();drawWorldLabels();"
assert html.count(anchor_loop)==1
html=html.replace(anchor_loop, anchor_loop+"turretHud();", 1)

open("stealth-game-3d.html","w",encoding="utf-8").write(html)
print("injected turret model. new size:",len(html),"bytes (",round(len(html)/1e6,2),"MB )")
