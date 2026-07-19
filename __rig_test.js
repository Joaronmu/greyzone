const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const URL = 'http://127.0.0.1:8123/stealth-game-3d.html';
const OUT = 'C:/Users/零零/WorkBuddy/2026-07-06-17-11-58';

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 500, height: 600 } });
  const errs = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
  page.on('pageerror', e => errs.push(String(e)));
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof THREE !== 'undefined' && typeof enemyGeo !== 'undefined', { timeout: 60000 });
  await page.evaluate(() => { window.requestAnimationFrame = () => 0; });

  const setup = await page.evaluate(async () => {
    const THREE = window.THREE;
    const resp = await fetch('enemy_rig.bin');
    const ab = await resp.arrayBuffer();
    const dv = new DataView(ab);
    let o = 0;
    const magic = String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3), dv.getUint8(4));
    if (magic !== 'RIG3D') return { error: 'bad magic ' + magic };
    o = 6 + 2; // version + 2 pad
    const nV = dv.getUint32(o, true); o += 4;
    const nT = dv.getUint32(o, true); o += 4;
    const nB = dv.getUint32(o, true); o += 4;
    const nCl = dv.getUint32(o, true); o += 4;
    const pos = new Float32Array(ab, o, nV * 3); o += nV * 12;
    const uv = new Float32Array(ab, o, nV * 2); o += nV * 8;
    const nrm = new Float32Array(ab, o, nV * 3); o += nV * 12;
    const idx = new Uint32Array(ab, o, nT * 3); o += nT * 12;
    const skinIdx = new Uint16Array(ab, o, nV * 4); o += nV * 8;
    const skinW = new Float32Array(ab, o, nV * 4); o += nV * 16;
    const bones = [];
    for (let i = 0; i < nB; i++) {
      const parent = dv.getInt32(o, true); o += 4;
      const px = dv.getFloat32(o, true), py = dv.getFloat32(o + 4, true), pz = dv.getFloat32(o + 8, true); o += 12;
      const qx = dv.getFloat32(o, true), qy = dv.getFloat32(o + 4, true), qz = dv.getFloat32(o + 8, true), qw = dv.getFloat32(o + 12, true); o += 16;
      const sx = dv.getFloat32(o, true), sy = dv.getFloat32(o + 4, true), sz = dv.getFloat32(o + 8, true); o += 12;
      bones.push({ parent, px, py, pz, qx, qy, qz, qw, sx, sy, sz });
    }
    const clips = [];
    for (let c = 0; c < nCl; c++) {
      const nl = dv.getUint32(o, true); o += 4;
      o += nl;
      while (o % 4 !== 0) o++; // pad name to 4
      const dur = dv.getFloat32(o, true); o += 4;
      const nTr = dv.getUint32(o, true); o += 4;
      const tracks = [];
      for (let t = 0; t < nTr; t++) {
        const bi = dv.getUint32(o, true); o += 4;
        const readSet = (comp) => {
          const n = dv.getUint32(o, true); o += 4;
          if (!n) return null;
          const T = new Float32Array(ab, o, n); o += n * 4;
          const V = new Float32Array(ab, o, n * comp); o += n * comp * 4;
          return { T, V };
        };
        const p = readSet(3);
        const r = readSet(4);
        const s = readSet(3);
        tracks.push({ bi, p, r, s });
      }
      clips.push({ dur, tracks });
    }
    // geometry
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    geo.setAttribute('skinIndex', new THREE.BufferAttribute(skinIdx, 4));
    geo.setAttribute('skinWeight', new THREE.BufferAttribute(skinW, 4));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    // bones
    const boneObjs = [];
    for (let i = 0; i < nB; i++) {
      const b = new THREE.Bone();
      b.name = 'b' + i;
      b.position.set(bones[i].px, bones[i].py, bones[i].pz);
      b.quaternion.set(bones[i].qx, bones[i].qy, bones[i].qz, bones[i].qw);
      b.scale.set(bones[i].sx, bones[i].sy, bones[i].sz);
      boneObjs.push(b);
    }
    for (let i = 0; i < nB; i++) {
      const p = bones[i].parent;
      if (p >= 0) boneObjs[p].add(boneObjs[i]);
    }
    const skel = new THREE.Skeleton(boneObjs);
    // scene + camera + lights
    const sc = new THREE.Scene();
    sc.background = new THREE.Color(0x222222);
    sc.add(new THREE.HemisphereLight(0xffffff, 0x222222, 1.2));
    const dl = new THREE.DirectionalLight(0xffffff, 1.2); dl.position.set(1, 2, 1); sc.add(dl);
    const cam = new THREE.PerspectiveCamera(40, 500 / 600, 0.1, 100);
    cam.position.set(0, 1.1, 4.5); cam.lookAt(0, 1.0, 0);
    // material with existing enemy texture
    const mat = new THREE.MeshStandardMaterial({ map: window.enemyTex || null, roughness: 0.62, metalness: 0.08, side: THREE.DoubleSide });
    const mesh = new THREE.SkinnedMesh(geo, mat);
    mesh.add(boneObjs[0]);
    sc.add(mesh);                 // add to scene first
    sc.updateMatrixWorld(true);   // compute bind-pose world matrices BEFORE bind
    mesh.bind(skel);              // now boneInverses computed from correct bind world
    // clip + mixer
    const clip = clips[0];
    const tracks = [];
    for (const t of clip.tracks) {
      const bn = 'b' + t.bi;
      if (t.p) tracks.push(new THREE.VectorKeyframeTrack(bn + '.position', t.p.T, t.p.V));
      if (t.r) tracks.push(new THREE.QuaternionKeyframeTrack(bn + '.quaternion', t.r.T, t.r.V));
      if (t.s) tracks.push(new THREE.VectorKeyframeTrack(bn + '.scale', t.s.T, t.s.V));
    }
    const ac = new THREE.AnimationClip('fire', clip.dur, tracks);
    const mixer = new THREE.AnimationMixer(mesh);
    const action = mixer.clipAction(ac);
    action.play();
    window.__rig = { sc, cam, mesh, mixer, renderer, dur: clip.dur, nB, nTr: clip.tracks.length };
    return { ok: true, nV, nT, nB, nCl, dur: clip.dur, nTr: clip.tracks.length };
  });
  console.log('setup:', JSON.stringify(setup));

  // render frames
  const frames = [0, 0.25, 0.5, 0.75, 1.0, 1.367];
  for (const t of frames) {
    await page.evaluate((tt) => {
      const r = window.__rig;
      r.mixer.setTime(tt);
      r.renderer.render(r.sc, r.cam);
    }, t);
    const el = await page.$('canvas');
    await el.screenshot({ path: path.join(OUT, `rig_frame_${String(t).replace('.', '_')}.png`) });
    console.log(`frame t=${t} rendered`);
  }
  // diagnostics
  const diag = await page.evaluate(() => {
    const r = window.__rig;
    const THREE = window.THREE;
    r.mesh.geometry.computeBoundingBox();
    const bb = r.mesh.geometry.boundingBox;
    const pos = r.mesh.geometry.attributes.position;
    const sw = r.mesh.geometry.attributes.skinWeight;
    const si = r.mesh.geometry.attributes.skinIndex;
    const hips = r.mesh.skeleton.bones[0];
    // sample vertex 0
    const p0 = [pos.getX(0), pos.getY(0), pos.getZ(0)];
    const sw0 = [sw.getX(0), sw.getY(0), sw.getZ(0), sw.getW(0)];
    const si0 = [si.getX(0), si.getY(0), si.getZ(0), si.getW(0)];
    // bone world at t=0 vs t=0.5
    r.mixer.setTime(0); r.sc.updateMatrixWorld(true);
    const w0 = hips.matrixWorld.elements.slice(12, 15).map(x => +x.toFixed(3));
    r.mixer.setTime(0.5); r.sc.updateMatrixWorld(true);
    const w5 = hips.matrixWorld.elements.slice(12, 15).map(x => +x.toFixed(3));
    // center pixel
    r.renderer.render(r.sc, r.cam);
    const px = new Uint8Array(4); r.renderer.readRenderTargetPixels ? null : null;
    const gl = r.renderer.getContext();
    const read = new Uint8Array(4); gl.readPixels(250, 300, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, read);
    return {
      posCount: pos.count,
      geoBB: [bb.min.toArray().map(x => +x.toFixed(3)), bb.max.toArray().map(x => +x.toFixed(3))],
      p0, sw0, si0,
      hipsLocal: [hips.position.x, hips.position.y, hips.position.z],
      hipsWorld_t0: w0, hipsWorld_t5: w5,
      centerPixel: Array.from(read),
      nBones: r.mesh.skeleton.bones.length,
      boneInverses0: r.mesh.skeleton.boneInverses[0].elements.slice(12, 15).map(x => +x.toFixed(3)),
    };
  });
  console.log('diag:', JSON.stringify(diag, null, 2));
  console.log('ERRORS:', errs.length);
  errs.slice(0, 15).forEach(e => console.log('  ', e));
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
