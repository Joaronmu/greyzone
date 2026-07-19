const esbuild=require('esbuild');
const fs=require('fs');
const entry=`
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { clone as skelClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
const g=(typeof window!=='undefined'?window:globalThis);
g.THREE = THREE;
THREE.FBXLoader = FBXLoader;
THREE.skelClone = skelClone;
`;
fs.writeFileSync('entry.js',entry);
esbuild.build({
  entryPoints:['entry.js'],
  bundle:true,
  format:'iife',
  minify:true,
  outfile:'vendor.js'
}).then(()=>{
  const s=fs.readFileSync('vendor.js','utf8');
  console.log('SIZE',s.length);
  console.log('HAS_THREE_NS', s.includes('THREE') );
  console.log('HAS_FBXLoader', s.includes('FBXLoader'));
}).catch(e=>{console.error(e);process.exit(1)});
