import re
html=open("stealth-game-3d.html","r",encoding="utf-8").read()
b64=open("enemy_model.b64","r").read().strip()

# 1) inline enemy model
assert html.count("<body>\n")==1
html=html.replace("<body>\n", "<body>\n<script type=\"text/plain\" id=\"emodel\">"+b64+"</script>\n", 1)

# 2) enemy loader + shared geo/mat (after playerG setup)
loader = r'''
// ===== y目标 FBX 模型（PM3D）→ 敌人共用几何/贴图 =====
let enemyGeo=null,enemyTex=null,enemyMats=[];
(function(){
 const el=document.getElementById('emodel');if(!el)return;
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
  g.translate(-9.8,0,0); // 模型 x[0,19.6] 居中
  enemyGeo=g;
  const url=URL.createObjectURL(new Blob([new Uint8Array(bin,o,texlen)],{type:'image/png'}));
  new THREE.TextureLoader().load(url,(t)=>{t.flipY=false;t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;enemyTex=t;for(const m of enemyMats){m.map=t;m.needsUpdate=true;}},undefined,(e)=>console.warn('enemy tex fail',e));
 }catch(e){console.warn('enemy model load fail',e);}
})();
function enemyMakeMat(){const m=new THREE.MeshStandardMaterial({color:0xffffff,map:enemyTex,roughness:0.62,metalness:0.08,emissive:0x000000,emissiveIntensity:0});enemyMats.push(m);return m;}
'''
apg="scene.add(playerG);playerG.visible=false;"
assert html.count(apg)==1
html=html.replace(apg, apg+loader, 1)

# 3) replace makeEnemyMesh with FBX version (+ humanoid fallback)
old_fn='''function makeEnemyMesh(e){
const H=buildHumanoid(ER,0xffd740,0x553300);const g=new THREE.Group();g.add(H.bob);H.bob.scale.setScalar(HUM_S);
const barY=40+ER*0.7+6;
const bg=new THREE.Sprite(new THREE.SpriteMaterial({color:0x222222,transparent:true,opacity:0.85}));bg.scale.set(26,4,1);bg.position.y=barY;H.bob.add(bg);
const fill=new THREE.Sprite(new THREE.SpriteMaterial({color:0xffd740,transparent:true}));fill.scale.set(26,4,1);fill.position.copy(bg.position);H.bob.add(fill);
const sec=new THREE.Mesh(makeConeGeo(),new THREE.MeshBasicMaterial({color:0xffd740,transparent:true,opacity:0.12,side:THREE.DoubleSide,depthWrite:false}));sec.position.y=0;g.add(sec);
const ring=new THREE.Mesh(new THREE.TorusGeometry(ER+5,1.6,8,26),new THREE.MeshBasicMaterial({color:0x00e676}));ring.rotation.x=Math.PI/2;ring.position.y=15;ring.visible=false;g.add(ring);
e._phase=e._phase||Math.random()*6.28;e._px=e.x;e._py=e.y;
scene.add(g);return {g,bob:H.bob,body:H.torso,legL:H.legL,legR:H.legR,armL:H.armLP,armR:H.armRP,fill,sec,ring,type:'enemy'};
}'''
new_fn='''function makeEnemyMesh(e){
const g=new THREE.Group();
if(enemyGeo){
 const bob=new THREE.Group();g.add(bob);
 const mesh=new THREE.Mesh(enemyGeo,enemyMakeMat());mesh.scale.setScalar(0.85);bob.add(mesh);
 const barY=40;
 const bg=new THREE.Sprite(new THREE.SpriteMaterial({color:0x222222,transparent:true,opacity:0.85}));bg.scale.set(26,4,1);bg.position.y=barY;bob.add(bg);
 const fill=new THREE.Sprite(new THREE.SpriteMaterial({color:0xffd740,transparent:true}));fill.scale.set(26,4,1);fill.position.copy(bg.position);bob.add(fill);
 const sec=new THREE.Mesh(makeConeGeo(),new THREE.MeshBasicMaterial({color:0xffd740,transparent:true,opacity:0.12,side:THREE.DoubleSide,depthWrite:false}));sec.position.y=0;g.add(sec);
 const ring=new THREE.Mesh(new THREE.TorusGeometry(ER+5,1.6,8,26),new THREE.MeshBasicMaterial({color:0x00e676}));ring.rotation.x=Math.PI/2;ring.position.y=15;ring.visible=false;g.add(ring);
 e._phase=e._phase||Math.random()*6.28;e._px=e.x;e._py=e.y;
 scene.add(g);return {g,bob,mesh,fill,sec,ring,type:'enemy'};
}
const H=buildHumanoid(ER,0xffd740,0x553300);g.add(H.bob);H.bob.scale.setScalar(HUM_S);
const barY=40+ER*0.7+6;
const bg=new THREE.Sprite(new THREE.SpriteMaterial({color:0x222222,transparent:true,opacity:0.85}));bg.scale.set(26,4,1);bg.position.y=barY;H.bob.add(bg);
const fill=new THREE.Sprite(new THREE.SpriteMaterial({color:0xffd740,transparent:true}));fill.scale.set(26,4,1);fill.position.copy(bg.position);H.bob.add(fill);
const sec=new THREE.Mesh(makeConeGeo(),new THREE.MeshBasicMaterial({color:0xffd740,transparent:true,opacity:0.12,side:THREE.DoubleSide,depthWrite:false}));sec.position.y=0;g.add(sec);
const ring=new THREE.Mesh(new THREE.TorusGeometry(ER+5,1.6,8,26),new THREE.MeshBasicMaterial({color:0x00e676}));ring.rotation.x=Math.PI/2;ring.position.y=15;ring.visible=false;g.add(ring);
e._phase=e._phase||Math.random()*6.28;e._px=e.x;e._py=e.y;
scene.add(g);return {g,bob:H.bob,body:H.torso,legL:H.legL,legR:H.legR,armL:H.armLP,armR:H.armRP,fill,sec,ring,type:'enemy'};
}'''
assert html.count(old_fn)==1, "makeEnemyMesh not found uniquely"
html=html.replace(old_fn, new_fn, 1)

# 4) updEnemy: add facing + emissive alert glow
anchor="if(rec.bob)rec.bob.position.y=Math.abs(Math.sin(e._phase||0))*1.6;"
assert html.count(anchor)==1
html=html.replace(anchor, anchor+"\nif(rec.mesh){rec.bob.rotation.y=-e.va;rec.mesh.material.emissive.setRGB(e.dl,0,0);rec.mesh.material.emissiveIntensity=e.dl*0.6;}", 1)

open("stealth-game-3d.html","w",encoding="utf-8").write(html)
print("injected enemy model. new size:",len(html),"bytes (",round(len(html)/1e6,2),"MB )")
