const { chromium } = require('playwright');
const URL = 'http://127.0.0.1:8123/stealth-game-3d.html';

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 640, height: 760 } });
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForFunction(() => bossGeo && zGeo && miniRig && bossRig, { timeout: 60000 });
  await page.waitForTimeout(200);
  const res = await page.evaluate(() => {
    const THREE = window.THREE;
    function bbox(sk) {
      const mesh = sk.mesh; mesh.rotation.set(0,0,0); mesh.position.set(0,0,0);
      mesh.updateMatrixWorld(true);
      const b = new THREE.Box3().setFromObject(mesh);
      const s = b.getSize(new THREE.Vector3());
      return { x:+s.x.toFixed(2), y:+s.y.toFixed(2), z:+s.z.toFixed(2) };
    }
    function legVertexMove(sk) {
      // find vertex with strongest weight on legLup (bone 31)
      const geo = sk.mesh.geometry;
      const si = geo.attributes.skinIndex.array, sw = geo.attributes.skinWeight.array, pos = geo.attributes.position.array;
      let best=-1, bestW=0;
      for (let i=0;i<pos.length/3;i++){
        for (let k=0;k<4;k++){ if (si[i*4+k]===31 && sw[i*4+k]>bestW){ bestW=sw[i*4+k]; best=i; } }
      }
      if (best<0) return null;
      // bind world pos via skinning matrices
      const mesh=sk.mesh; mesh.rotation.set(0,0,0); mesh.position.set(0,0,0);
      _setBoneQ(sk.legLup,0); mesh.updateMatrixWorld(true);
      const bind=vertexWorld(mesh, best);
      _setBoneQ(sk.legLup,0.42); mesh.updateMatrixWorld(true);
      const posed=vertexWorld(mesh, best);
      _setBoneQ(sk.legLup,0);
      const dx=posed.x-bind.x, dy=posed.y-bind.y, dz=posed.z-bind.z;
      return { bestW:+bestW.toFixed(3), bind:[+bind.x.toFixed(2),+bind.y.toFixed(2),+bind.z.toFixed(2)], posed:[+posed.x.toFixed(2),+posed.y.toFixed(2),+posed.z.toFixed(2)], move:+Math.hypot(dx,dy,dz).toFixed(3), d:[+dx.toFixed(2),+dy.toFixed(2),+dz.toFixed(2)] };
    }
    function vertexWorld(mesh, vi) {
      const skel = mesh.skeleton, bones = skel.bones, inv = skel.boneInverses;
      const si = mesh.geometry.attributes.skinIndex.array, sw = mesh.geometry.attributes.skinWeight.array, pos = mesh.geometry.attributes.position.array;
      const px=pos[vi*3], py=pos[vi*3+1], pz=pos[vi*3+2];
      const v = new THREE.Vector3(px,py,pz);
      const out = new THREE.Vector3();
      const tmp = new THREE.Vector3(), m = new THREE.Matrix4();
      for (let k=0;k<4;k++){
        const bi = si[vi*4+k], w = sw[vi*4+k];
        if (!w) continue;
        // skinned = bone.matrixWorld * boneInverses * bindPos
        m.multiplyMatrices(bones[bi].matrixWorld, inv[bi]);
        out.add(tmp.copy(v).applyMatrix4(m).multiplyScalar(w));
      }
      return out;
    }
    const out = {};
    for (const [name, builder] of [['mini', ()=>buildMiniSkinned()], ['main', ()=>buildBossSkinned()]]) {
      const sk = builder();
      const bindB = bbox(sk);
      _setBoneQ(sk.legLup,0.42); _setBoneQ(sk.legRup,-0.42);
      _setBoneQ(sk.legL,0.25); _setBoneQ(sk.legR,0.0);
      const walkB = bbox(sk);
      _setBoneQ(sk.legLup,0); _setBoneQ(sk.legRup,0); _setBoneQ(sk.legL,0); _setBoneQ(sk.legR,0);
      const mv = legVertexMove(sk);
      out[name] = { bindBBox:bindB, walkBBox:walkB, legVertex:mv };
    }
    return out;
  });
  console.log(JSON.stringify(res, null, 2));
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
