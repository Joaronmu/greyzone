import re

HTML = "stealth-game-3d.html"
B64  = "boss_model.b64"

html = open(HTML, "r", encoding="utf-8").read()
b64  = open(B64, "r", encoding="ascii").read().strip()

# 1) insert bmodel data div right before <div id="wrap">
bmodel_div = '<script type="text/plain" id="bmodel">' + b64 + '</script>\n'
assert html.count('<div id="wrap">') >= 1, "wrap not found"
html = html.replace('<div id="wrap">', bmodel_div + '<div id="wrap">', 1)

# 2) insert boss loader JS block right before function turretHud(){
boss_loader = """// ===== 小boss FBX 模型（PM3D）→ mini-boss 共用几何/贴图（生成要求同 y目标）=====
let bossGeo=null,bossTex=null,bossMats=[];
let BOSS_SCL=0.85;
(function(){
 const el=document.getElementById('bmodel');if(!el)return;
 try{
  const bin=Uint8Array.from(atob(el.textContent.replace(/\\s/g,'')),c=>c.charCodeAt(0)).buffer;
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
  bossGeo=g;
  const url=URL.createObjectURL(new Blob([new Uint8Array(bin,o,texlen)],{type:'image/png'}));
  new THREE.TextureLoader().load(url,(t)=>{t.flipY=false;t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;bossTex=t;for(const m of bossMats){m.map=t;m.needsUpdate=true;}},undefined,(e)=>console.warn('boss tex fail',e));
 }catch(e){console.warn('boss model load fail',e);}
})();
function bossMakeMat(){const m=new THREE.MeshStandardMaterial({color:0xffffff,map:bossTex,roughness:0.62,metalness:0.08,emissive:0x000000,emissiveIntensity:0});bossMats.push(m);return m;}
"""
assert "function turretHud(){" in html, "turretHud not found"
html = html.replace("function turretHud(){", boss_loader + "function turretHud(){", 1)

# 3) rewrite makeMiniMesh to use bossGeo (FBX) with fallback to humanoid
old_mini = """function makeMiniMesh(e){
const H=buildHumanoid(BR-2,0x4488ff,0x1133aa);const g=new THREE.Group();g.add(H.bob);H.bob.scale.setScalar(HUM_S);
const barY=40+(BR-2)*0.7+6;
const bg=new THREE.Sprite(new THREE.SpriteMaterial({color:0x222222,transparent:true,opacity:0.85}));bg.scale.set(30,5,1);bg.position.y=barY;H.bob.add(bg);
const fill=new THREE.Sprite(new THREE.SpriteMaterial({color:0x4488ff,transparent:true}));fill.scale.set(30,5,1);fill.position.copy(bg.position);H.bob.add(fill);
const sec=new THREE.Mesh(makeConeGeo(),new THREE.MeshBasicMaterial({color:0x4488ff,transparent:true,opacity:0.13,side:THREE.DoubleSide,depthWrite:false}));sec.position.y=0;g.add(sec);
const ring=new THREE.Mesh(new THREE.TorusGeometry(BR+4,1.8,8,28),new THREE.MeshBasicMaterial({color:0x00e676}));ring.rotation.x=Math.PI/2;ring.position.y=18;ring.visible=false;g.add(ring);
scene.add(g);return {g,bob:H.bob,body:H.torso,legL:H.legL,legR:H.legR,armL:H.armLP,armR:H.armRP,fill,sec,ring,type:'mini'};
}"""
new_mini = """function makeMiniMesh(e){
const g=new THREE.Group();
if(bossGeo){
 const bob=new THREE.Group();g.add(bob);
 const mesh=new THREE.Mesh(bossGeo,bossMakeMat());mesh.scale.setScalar(BOSS_SCL);bob.add(mesh);
 const barY=42;
 const bg=new THREE.Sprite(new THREE.SpriteMaterial({color:0x222222,transparent:true,opacity:0.85}));bg.scale.set(30,5,1);bg.position.y=barY;bob.add(bg);
 const fill=new THREE.Sprite(new THREE.SpriteMaterial({color:0x4488ff,transparent:true}));fill.scale.set(30,5,1);fill.position.copy(bg.position);bob.add(fill);
 const sec=new THREE.Mesh(makeConeGeo(),new THREE.MeshBasicMaterial({color:0x4488ff,transparent:true,opacity:0.13,side:THREE.DoubleSide,depthWrite:false}));sec.position.y=0;g.add(sec);
 const ring=new THREE.Mesh(new THREE.TorusGeometry(BR+4,1.8,8,28),new THREE.MeshBasicMaterial({color:0x00e676}));ring.rotation.x=Math.PI/2;ring.position.y=18;ring.visible=false;g.add(ring);
 e._phase=e._phase||Math.random()*6.28;e._px=e.x;e._py=e.y;
 scene.add(g);return {g,bob,mesh,fill,sec,ring,type:'mini'};
}
const H=buildHumanoid(BR-2,0x4488ff,0x1133aa);g.add(H.bob);H.bob.scale.setScalar(HUM_S);
const barY=40+(BR-2)*0.7+6;
const bg=new THREE.Sprite(new THREE.SpriteMaterial({color:0x222222,transparent:true,opacity:0.85}));bg.scale.set(30,5,1);bg.position.y=barY;H.bob.add(bg);
const fill=new THREE.Sprite(new THREE.SpriteMaterial({color:0x4488ff,transparent:true}));fill.scale.set(30,5,1);fill.position.copy(bg.position);H.bob.add(fill);
const sec=new THREE.Mesh(makeConeGeo(),new THREE.MeshBasicMaterial({color:0x4488ff,transparent:true,opacity:0.13,side:THREE.DoubleSide,depthWrite:false}));sec.position.y=0;g.add(sec);
const ring=new THREE.Mesh(new THREE.TorusGeometry(BR+4,1.8,8,28),new THREE.MeshBasicMaterial({color:0x00e676}));ring.rotation.x=Math.PI/2;ring.position.y=18;ring.visible=false;g.add(ring);
scene.add(g);return {g,bob:H.bob,body:H.torso,legL:H.legL,legR:H.legR,armL:H.armLP,armR:H.armRP,fill,sec,ring,type:'mini'};
}"""
assert old_mini in html, "old makeMiniMesh not found"
html = html.replace(old_mini, new_mini, 1)

# 4) update updMini: add rec.mesh branch (facing + emissive) and guard rec.body
old_upd = """function updMini(rec,e){
rec.g.position.set(e.x,0,e.y);
if(rec.bob)rec.bob.position.y=Math.sin(nowT*0.003+1)*0.7;
const col=_cT.set(0x4488ff).lerp(new THREE.Color(0xff1744),e.dl);rec.body.material.color.copy(col);rec.body.material.emissive.copy(col).multiplyScalar(0.4);
rec.fill.material.color.copy(col);rec.fill.scale.x=Math.max(0.001,30*e.dl);
updateCone(rec,e.x,e.y,e.va,VA/2,e.vr,col,0.12+e.dl*0.15);
rec.ring.visible=!!(ig&&gt===e);
}"""
new_upd = """function updMini(rec,e){
rec.g.position.set(e.x,0,e.y);
if(rec.bob)rec.bob.position.y=Math.sin(nowT*0.003+1)*0.7;
const col=_cT.set(0x4488ff).lerp(new THREE.Color(0xff1744),e.dl);
if(rec.body){rec.body.material.color.copy(col);rec.body.material.emissive.copy(col).multiplyScalar(0.4);}
if(rec.mesh){rec.bob.rotation.y=-e.va+Math.PI/2;rec.mesh.material.emissive.setRGB(e.dl,0,0);rec.mesh.material.emissiveIntensity=e.dl*0.6;}
rec.fill.material.color.copy(col);rec.fill.scale.x=Math.max(0.001,30*e.dl);
updateCone(rec,e.x,e.y,e.va,VA/2,e.vr,col,0.12+e.dl*0.15);
rec.ring.visible=!!(ig&&gt===e);
}"""
assert old_upd in html, "old updMini not found"
html = html.replace(old_upd, new_upd, 1)

open(HTML, "w", encoding="utf-8").write(html)
print("INJECTED OK  new size:", len(html), "bytes")
