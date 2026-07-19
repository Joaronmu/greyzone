const fs=require('fs');
const code=fs.readFileSync('__build/vendor.js','utf8');
global.window=global; global.self=global;
(0,eval)(code);
const THREE=global.THREE, FBXLoader=global.FBXLoader, skelClone=global.skelClone;
console.log('THREE rev',THREE&&THREE.REVISION,'FBXLoader?',!!FBXLoader,'skelClone?',!!skelClone);
const fbx=fs.readFileSync('C:/Users/零零/Downloads/Rifle Walk To Stop.fbx');
const buf=fbx.buffer.slice(fbx.byteOffset,fbx.byteOffset+fbx.byteLength);
const loader=new FBXLoader();
loader.parse(buf,'',(obj)=>{
  const box=new THREE.Box3().setFromObject(obj);
  const size=new THREE.Vector3();box.getSize(size);
  console.log('PARSE OK  bbox=',size.x.toFixed(1),size.y.toFixed(1),size.z.toFixed(1),
    ' clips=',obj.animations.length, obj.animations.map(a=>a.name));
  const cl=skelClone(obj); console.log('skelClone OK type=',cl.type,'children=',cl.children.length);
},(err)=>{console.error('PARSE ERR',err&&err.stack||err);});
