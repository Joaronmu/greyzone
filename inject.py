import re
html=open("stealth-game-3d.html","r",encoding="utf-8").read()
b64=open("player_model.b64","r").read().strip()

# 1) base64 model as inert script tag
assert html.count("<body>\n")==1
html=html.replace("<body>\n", "<body>\n<script type=\"text/plain\" id=\"pmodel\">"+b64+"</script>\n", 1)

# 2) scene.add(camera) so camera children render
ac="camera.lookAt(W/2,0,H/2);"
assert html.count(ac)==1
html=html.replace(ac, ac+"\nscene.add(camera);", 1)

# 3) viewmodel loader + tuning
vm_code = r'''
// ===== PM3D 第一人称手臂 viewmodel（玩家自选模型）+ 调试定位 =====
let pViewModel=null;
const vmCfg={px:0,py:-18,pz:-16,ry:Math.PI,scl:1.0};
function vmApply(){if(!pViewModel)return;pViewModel.position.set(vmCfg.px,vmCfg.py,vmCfg.pz);pViewModel.rotation.set(0,vmCfg.ry,0);pViewModel.scale.setScalar(vmCfg.scl);}
function vmHud(){if(!pViewModel)return;octx.fillStyle="rgba(0,0,0,.55)";octx.fillRect(W/2-210,40,420,18);octx.fillStyle="#39ff14";octx.font='11px "Segoe UI",monospace';octx.textAlign="center";octx.fillText("VM py="+vmCfg.py.toFixed(0)+" pz="+vmCfg.pz.toFixed(0)+" px="+vmCfg.px.toFixed(0)+" rotY="+vmCfg.ry.toFixed(2)+" scl="+vmCfg.scl.toFixed(2)+"  [T/G上下 Y/U前后 J/K转向 Z/X缩放]",W/2,53);}
(function(){
 const el=document.getElementById('pmodel');if(!el)return;
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
  const mat=new THREE.MeshStandardMaterial({color:0xcca070,roughness:0.62,metalness:0.08});
  const mesh=new THREE.Mesh(g,mat);mesh.renderOrder=999;
  mesh.position.x=-10;
  const grp=new THREE.Group();grp.add(mesh);
  camera.add(grp);pViewModel=grp;pViewModel.visible=false;vmApply();
  const url=URL.createObjectURL(new Blob([new Uint8Array(bin,o,texlen)],{type:'image/png'}));
  new THREE.TextureLoader().load(url,(tex)=>{tex.flipY=false;tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=4;mat.map=tex;mat.needsUpdate=true;},undefined,(e)=>console.warn('pmodel tex fail',e));
 }catch(e){console.warn('pmodel load fail',e)}
})();
// 调试定位键（定稿后可整段删除）
window.addEventListener("keydown",function(e){if(!pViewModel)return;const k=e.key.toLowerCase();let h=true;
 if(k==='t')vmCfg.py+=1;else if(k==='g')vmCfg.py-=1;
 else if(k==='y')vmCfg.pz+=1;else if(k==='u')vmCfg.pz-=1;
 else if(k==='j')vmCfg.ry+=0.1;else if(k==='k')vmCfg.ry-=0.1;
 else if(k==='z')vmCfg.scl+=0.05;else if(k==='x')vmCfg.scl-=0.05;
 else h=false;
 if(h){e.preventDefault();vmApply();console.log("VM",JSON.stringify(vmCfg));}
},true);
'''
apg="scene.add(playerG);playerG.visible=false;"
assert html.count(apg)==1
html=html.replace(apg, apg+vm_code, 1)

# 4) per-frame visibility + crouch sync
av="playerG.visible=!fp;"
assert html.count(av)==1
html=html.replace(av, av+"if(pViewModel){const _c=(fp&&st===0&&!ig&&!bMode&&!cMode&&!termMode);pViewModel.visible=_c;if(_c){pViewModel.position.y=vmCfg.py+(crouch?-6:0);}}", 1)

# 5) vmHud call in loop overlay
ah="dhud();drawWorldLabels();"
assert html.count(ah)==1
html=html.replace(ah, ah+"vmHud();", 1)

open("stealth-game-3d.html","w",encoding="utf-8").write(html)
print("injected. new size:",len(html),"bytes (",round(len(html)/1e6,2),"MB )")
