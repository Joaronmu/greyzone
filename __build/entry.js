import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { clone as skelClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
const g = (typeof window!=='undefined'?window:globalThis);
g.THREE = THREE;
g.FBXLoader = FBXLoader;
g.skelClone = skelClone;
