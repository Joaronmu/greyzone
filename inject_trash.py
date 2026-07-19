HTML = "stealth-game-3d.html"
B64  = "trash_model.b64"

html = open(HTML, "r", encoding="utf-8").read()
b64  = open(B64, "r", encoding="ascii").read().strip()

# 1) insert cmodel data div right before <div id="wrap">
cmodel_div = '<script type="text/plain" id="cmodel">' + b64 + '</script>\n'
assert html.count('<div id="wrap">') >= 1
html = html.replace('<div id="wrap">', cmodel_div + '<div id="wrap">', 1)

# 2) insert container (trash) loader JS right after zMakeMat()
anchor = "function zMakeMat(){const m=new THREE.MeshStandardMaterial({color:0xffffff,map:zTex,roughness:0.62,metalness:0.08,emissive:0x000000,emissiveIntensity:0});zMats.push(m);return m;}"
assert anchor in html, "zMakeMat anchor not found"
c_loader = """
// ===== 垃圾桶(容器) FBX 模型（PM3D）→ 地图容器共用几何/贴图（保留 CONTHX/CONTHY 实体判定）=====
let contGeo=null,contTex=null,contMats=[];
(function(){
 const el=document.getElementById('cmodel');if(!el)return;
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
  contGeo=g;
  if(texlen>0){
   const url=URL.createObjectURL(new Blob([new Uint8Array(bin,o,texlen)],{type:'image/png'}));
   new THREE.TextureLoader().load(url,(t)=>{t.flipY=false;t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;contTex=t;for(const m of contMats){m.map=t;m.needsUpdate=true;}},undefined,(e)=>console.warn('cont tex fail',e));
  }
 }catch(e){console.warn('cont model load fail',e);}
})();
function contMakeMat(){const m=new THREE.MeshStandardMaterial({color:0xffffff,map:contTex,roughness:0.8,metalness:0.05,emissive:0x000000,emissiveIntensity:0});contMats.push(m);return m;}
"""
html = html.replace(anchor, anchor + c_loader, 1)

# 3) rewrite makeBodyMesh to use contGeo (trash) with cylinder fallback
old_body = """function makeBodyMesh(d){
const r=d.ib?BR:ER-1;const g=new THREE.Group();
const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,14,16),new THREE.MeshStandardMaterial({color:d.ib?0x555555:0x666666,roughness:0.9}));m.position.y=7;g.add(m);
scene.add(g);return {g,type:'body'};
}"""
new_body = """function makeBodyMesh(d){
const g=new THREE.Group();
if(contGeo){
 const sc=d.ib?1.4:1.0;
 const m=new THREE.Mesh(contGeo,contMakeMat());m.scale.setScalar(sc);g.add(m);
}else{
 const r=d.ib?BR:ER-1;
 const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,14,16),new THREE.MeshStandardMaterial({color:d.ib?0x555555:0x666666,roughness:0.9}));m.position.y=7;g.add(m);
}
scene.add(g);return {g,type:'body'};
}"""
assert old_body in html, "old makeBodyMesh not found"
html = html.replace(old_body, new_body, 1)

open(HTML, "w", encoding="utf-8").write(html)
print("INJECTED OK  new size:", len(html), "bytes")
