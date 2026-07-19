import struct, sys
import numpy as np

ENEMY_RIG = "enemy_rig.bin"
# (input PM3D bin, output RIG3D bin, label)
JOBS = [
    ("boss_model.bin", "mini_rig.bin", "mini-boss"),
    ("zmodel.bin",     "boss_rig.bin", "main-boss"),
]

# ---------- read PM3D ----------
def read_pm3d(path):
    data = open(path, "rb").read()
    assert data[:4] == b"PM3D", path
    o = 4
    nclu = struct.unpack_from("<I", data, o)[0]; o += 4
    ntri = struct.unpack_from("<I", data, o)[0]; o += 4
    texlen = struct.unpack_from("<I", data, o)[0]; o += 4
    pos = np.frombuffer(data, dtype="<f4", count=nclu * 3, offset=o).reshape(nclu, 3).copy(); o += nclu * 12
    nrm = np.frombuffer(data, dtype="<f4", count=nclu * 3, offset=o).reshape(nclu, 3).copy(); o += nclu * 12
    uv  = np.frombuffer(data, dtype="<f4", count=nclu * 2, offset=o).reshape(nclu, 2).copy(); o += nclu * 8
    idx = np.frombuffer(data, dtype="<u4", count=ntri * 3, offset=o).reshape(ntri, 3).copy(); o += ntri * 12
    return pos, nrm, uv, idx

# ---------- read RIG3D ----------
def read_rig3d(path):
    data = open(path, "rb").read()
    assert data[:5] == b"RIG3D", path
    o = 8
    nV, nT, nB, nCl = struct.unpack_from("<IIII", data, o); o += 16
    pos = np.frombuffer(data, dtype="<f4", count=nV * 3, offset=o).reshape(nV, 3).copy(); o += nV * 12
    uv  = np.frombuffer(data, dtype="<f4", count=nV * 2, offset=o).reshape(nV, 2).copy(); o += nV * 8
    nrm = np.frombuffer(data, dtype="<f4", count=nV * 3, offset=o).reshape(nV, 3).copy(); o += nV * 12
    idx = np.frombuffer(data, dtype="<u4", count=nT * 3, offset=o).reshape(nT, 3).copy(); o += nT * 12
    skinIdx = np.frombuffer(data, dtype="<u2", count=nV * 4, offset=o).reshape(nV, 4).copy(); o += nV * 8
    skinW   = np.frombuffer(data, dtype="<f4", count=nV * 4, offset=o).reshape(nV, 4).copy(); o += nV * 16
    defs = []
    for i in range(nB):
        parent = struct.unpack_from("<i", data, o)[0]; o += 4
        px, py, pz = struct.unpack_from("<fff", data, o); o += 12
        qx, qy, qz, qw = struct.unpack_from("<ffff", data, o); o += 16
        sx, sy, sz = struct.unpack_from("<fff", data, o); o += 12
        defs.append(dict(parent=parent, px=px, py=py, pz=pz, qx=qx, qy=qy, qz=qz, qw=qw, sx=sx, sy=sy, sz=sz))
    return pos, uv, nrm, idx, skinIdx, skinW, defs

def quat_to_mat(qx, qy, qz, qw):
    x, y, z, w = qx, qy, qz, qw
    R = np.array([
        [1 - 2*(y*y + z*z), 2*(x*y - z*w),   2*(x*z + y*w)],
        [2*(x*y + z*w),     1 - 2*(x*x + z*z), 2*(y*z - x*w)],
        [2*(x*z - y*w),     2*(y*z + x*w),   1 - 2*(x*x + y*y)]], dtype=np.float64)
    return R

def world_matrices(defs):
    W = [None] * len(defs)
    for i, d in enumerate(defs):
        R = quat_to_mat(d["qx"], d["qy"], d["qz"], d["qw"])
        L = np.eye(4); L[:3, :3] = R * np.array([d["sx"], d["sy"], d["sz"]])
        L[:3, 3] = [d["px"], d["py"], d["pz"]]
        W[i] = L if d["parent"] < 0 else W[d["parent"]] @ L
    return W

def bone_heads_tails(scaled_defs):
    W = world_matrices(scaled_defs)
    heads = np.array([W[i][:3, 3] for i in range(len(scaled_defs))])
    # tails: child head, or extended from parent for leaves
    children = {i: [] for i in range(len(scaled_defs))}
    for i, d in enumerate(scaled_defs):
        if d["parent"] >= 0:
            children[d["parent"]].append(i)
    seg_lens = []
    tails = np.zeros_like(heads)
    for i in range(len(scaled_defs)):
        ch = children[i]
        if ch:
            tails[i] = heads[ch[0]]
            seg_lens.append(np.linalg.norm(tails[i] - heads[i]))
        else:
            p = scaled_defs[i]["parent"]
            if p >= 0:
                d = heads[i] - heads[p]
                ln = np.linalg.norm(d)
                if ln > 1e-6:
                    tails[i] = heads[i] + d / ln * 0.15
                else:
                    tails[i] = heads[i] + np.array([0, -0.15, 0])
            else:
                tails[i] = heads[i] + np.array([0, -0.15, 0])
    avg = np.mean(seg_lens) if seg_lens else 0.15
    # fix any still-degenerate leaves using avg
    for i in range(len(scaled_defs)):
        if np.linalg.norm(tails[i] - heads[i]) < 1e-5:
            p = scaled_defs[i]["parent"]
            if p >= 0:
                d = heads[i] - heads[p]; ln = np.linalg.norm(d)
                tails[i] = heads[i] + (d / ln * avg) if ln > 1e-6 else heads[i] + np.array([0, -avg, 0])
            else:
                tails[i] = heads[i] + np.array([0, -avg, 0])
    return heads, tails

def compute_weights(verts, heads, tails, n_nearest=4):
    N, B = len(verts), len(heads)
    d2 = np.empty((N, B), dtype=np.float64)
    AB = tails - heads
    L2 = (AB * AB).sum(1)
    for b in range(B):
        if L2[b] < 1e-9:
            d2[:, b] = ((verts - heads[b]) ** 2).sum(1)
        else:
            t = np.clip(((verts - heads[b]) @ AB[b]) / L2[b], 0, 1)
            proj = heads[b] + np.outer(t, AB[b])
            d2[:, b] = ((verts - proj) ** 2).sum(1)
    idx = np.argpartition(d2, n_nearest - 1, axis=1)[:, :n_nearest]
    w = np.take_along_axis(d2, idx, axis=1)
    w = 1.0 / (w + 1e-3)
    w /= w.sum(1, keepdims=True)
    return idx.astype(np.uint16), w.astype(np.float32)

def write_skin(path, pos, skinIdx, skinW, defs):
    # SKIN block: geometry is reused from existing PM3D (bossGeo/zGeo), so we only
    # store skin weights + boneDefs (in the same vertex order as the PM3D pos array).
    buf = bytearray()
    buf += b"SKIN"
    nV, nB = len(pos), len(defs)
    buf += struct.pack("<II", nV, nB)
    buf += np.ascontiguousarray(skinIdx, "<u2").tobytes()
    buf += np.ascontiguousarray(skinW, "<f4").tobytes()
    for d in defs:
        buf += struct.pack("<i", d["parent"])
        buf += struct.pack("<fff", d["px"], d["py"], d["pz"])
        buf += struct.pack("<ffff", d["qx"], d["qy"], d["qz"], d["qw"])
        buf += struct.pack("<fff", d["sx"], d["sy"], d["sz"])
    open(path, "wb").write(buf)
    print(f"  WROTE {path}: {nV} verts, {nB} bones, {len(buf)} bytes")

# ---------- main ----------
e_pos, e_uv, e_nrm, e_idx, e_si, e_sw, e_defs = read_rig3d(ENEMY_RIG)
enemy_h = e_pos[:, 1].max() - e_pos[:, 1].min()
print(f"enemy rig: {len(e_defs)} bones, height={enemy_h:.3f}, leg idx LUp=31 L=32 RUp=36 R=37")
# enemy bind bbox (for sanity)
eb = e_pos
print(f"  enemy geo bbox x[{eb[:,0].min():.3f},{eb[:,0].max():.3f}] y[{eb[:,1].min():.3f},{eb[:,1].max():.3f}] z[{eb[:,2].min():.3f},{eb[:,2].max():.3f}]")

for pmin, out, label in JOBS:
    pos, nrm, uv, idx = read_pm3d(pmin)
    bh = pos[:, 1].max() - pos[:, 1].min()
    s = bh / enemy_h
    print(f"\n[{label}] {pmin}: V={len(pos)} T={len(idx)} height={bh:.3f} scale={s:.4f}")
    # scale enemy defs positions into boss space
    scaled = []
    for d in e_defs:
        scaled.append(dict(parent=d["parent"], px=d["px"]*s, py=d["py"]*s, pz=d["pz"]*s,
                           qx=d["qx"], qy=d["qy"], qz=d["qz"], qw=d["qw"],
                           sx=d["sx"], sy=d["sy"], sz=d["sz"]))
    heads, tails = bone_heads_tails(scaled)
    # align skeleton bbox to mesh bbox (center x/z; feet y -> mesh min y)
    skel_min = heads.min(0); skel_max = heads.max(0)
    mesh_cx = pos[:, 0].mean(); mesh_cz = pos[:, 2].mean(); mesh_minY = pos[:, 1].min()
    dx = mesh_cx - (skel_min[0] + skel_max[0]) / 2
    dz = mesh_cz - (skel_min[2] + skel_max[2]) / 2
    dy = mesh_minY - skel_min[1]
    # apply offset to ROOT bone local position (shifts all descendants)
    scaled[0]["px"] += dx; scaled[0]["py"] += dy; scaled[0]["pz"] += dz
    heads, tails = bone_heads_tails(scaled)
    # sanity: legs
    print(f"  after align: skel feet y={heads.min(0)[1]:.3f} (mesh feet {mesh_minY:.3f}), head y={heads.max(0)[1]:.3f}")
    print(f"  leg LUp31 head={heads[31].round(3)}  L32={heads[32].round(3)}  RUp36={heads[36].round(3)}  R37={heads[37].round(3)}")
    skinIdx, skinW = compute_weights(pos, heads, tails, 4)
    # verify a few lower-body verts map to leg bones
    low = np.where(pos[:, 1] < bh * 0.45)[0]
    if len(low):
        dom = skinIdx[low].reshape(-1)
        from collections import Counter
        c = Counter(dom.tolist())
        print(f"  lower-body dominant bones: {c.most_common(6)}")
    write_skin(out, pos, skinIdx, skinW, scaled)
