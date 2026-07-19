import struct, zlib, sys, os, json
import numpy as np

PATH = sys.argv[1] if len(sys.argv) > 1 else "C:/Users/零零/Downloads/Firing Rifle.fbx"
OUTBIN = sys.argv[2] if len(sys.argv) > 2 else "enemy_rig.bin"

data = open(PATH, "rb").read()
version = struct.unpack_from("<I", data, 23)[0]
USE64 = version >= 7500
HDR = 27

def u(off, n=4):
    return struct.unpack_from("<Q", data, off)[0] if (n == 8) else struct.unpack_from("<I", data, off)[0]

class N:
    __slots__ = ("ch", "props", "name", "end")
    def __init__(s): s.ch = []; s.props = []; s.name = b""; s.end = 0

def psz(tc, off):
    if tc == "Y": return 2
    if tc == "C": return 1
    if tc in "IF": return 4
    if tc in "DL": return 8
    if tc in "RS": return 4 + u(off)
    if tc in "fidbl": return 12 + struct.unpack_from("<III", data, off)[2]
    return 0

def propval(tc, off):
    if tc == "Y": return struct.unpack_from("<h", data, off)[0]
    if tc == "C": return data[off] != 0
    if tc == "I": return struct.unpack_from("<i", data, off)[0]
    if tc == "F": return struct.unpack_from("<f", data, off)[0]
    if tc == "D": return struct.unpack_from("<d", data, off)[0]
    if tc == "L": return struct.unpack_from("<q", data, off)[0]
    if tc in "RS":
        ln = u(off); return data[off+4:off+4+ln]
    if tc in "fidbl":
        a, e, c = struct.unpack_from("<III", data, off); return data[off+12:off+12+c]
    return None

def rn(off):
    if USE64:
        eo, np_, pl = struct.unpack_from("<QQQ", data, off); off += 24
    else:
        eo, np_, pl = struct.unpack_from("<III", data, off); off += 12
    nl = data[off]; off += 1; nm = data[off:off+nl]; off += nl
    n = N(); n.name = nm; n.end = eo
    for _ in range(np_):
        tc = chr(data[off]); off += 1
        v = propval(tc, off); n.props.append((tc, v)); off += psz(tc, off)
    while off < eo:
        pe = u(off, 8 if USE64 else 4)
        if pe == 0: break
        c = rn(off); n.ch.append(c); off = c.end
    return n

top = []; off = HDR
while off < len(data):
    pe = u(off, 8 if USE64 else 4)
    if pe == 0: break
    n = rn(off); top.append(n); off = n.end

objs = next(t for t in top if t.name == b"Objects")
conns_node = next((t for t in top if t.name == b"Connections"), None)

def prop_str(p):
    if not p or p[0] not in ("S",): return None
    s = p[1].decode("utf-8", "replace")
    if "\x00" in s: s = s.split("\x00", 1)[0]
    return s
def prop_int(p):
    if not p: return None
    if p[0] == "L": return p[1]
    if p[0] == "I": return p[1]
    return None

obj_by_id = {}; models = []
for c in objs.ch:
    if c.name == b"Model":
        oid = prop_int(c.props[0]); nm = prop_str(c.props[1]); typ = prop_str(c.props[2])
        obj_by_id[oid] = ("Model", nm, typ, c); models.append((oid, nm, typ, c))
    elif c.name in (b"Geometry", b"Deformer", b"AnimationStack", b"AnimationLayer", b"AnimationCurveNode", b"AnimationCurve", b"Pose"):
        oid = prop_int(c.props[0])
        typ = prop_str(c.props[2]) if c.name in (b"Deformer", b"Pose") and len(c.props) >= 3 else None
        nm = prop_str(c.props[1]) if c.name in (b"AnimationStack",) and len(c.props) > 1 else None
        obj_by_id[oid] = (c.name.decode(), nm, typ, c)

conns = []
if conns_node:
    for c in conns_node.ch:
        if c.name != b"C": continue
        ct = prop_str(c.props[0]); src = prop_int(c.props[1]); dst = prop_int(c.props[2])
        pr = prop_str(c.props[3]) if len(c.props) > 3 else None
        conns.append((ct, src, dst, pr))

oo_to = {}; op_to = {}
for ct, src, dst, pr in conns:
    if ct == "OO": oo_to.setdefault(dst, []).append(src); oo_to.setdefault(src, [])
    elif ct == "OP": op_to.setdefault(dst, []).append((src, pr))

# ---- mesh ----
mesh_model = None; geom = None; geom_id = None
for oid, nm, typ, node in models:
    if typ == "Mesh":
        mesh_model = oid
        for ch in oo_to.get(oid, []):
            if ch in obj_by_id and obj_by_id[ch][0] == "Geometry":
                geom = obj_by_id[ch][3]; geom_id = ch; break
        if geom: break

def arr_typed(node, key):
    for cc in node.ch:
        if cc.name == key and cc.props:
            tc = cc.props[0][0]; raw = cc.props[0][1]
            try: raw = zlib.decompress(raw)
            except: pass
            if tc == 'd': return np.frombuffer(raw, dtype='<f8')
            if tc == 'f': return np.frombuffer(raw, dtype='<f4')
            if tc == 'i': return np.frombuffer(raw, dtype='<i4')
            if tc == 'l': return np.frombuffer(raw, dtype='<i8')
            return np.frombuffer(raw, dtype='<f4')
    return None

va = arr_typed(geom, b"Vertices"); verts = va.reshape(-1, 3).astype(np.float32).copy()
pb = arr_typed(geom, b"PolygonVertexIndex"); pvi = pb.astype(np.int64)
tris = []
poly = []
for v in pvi:
    if v < 0:
        poly.append(-v - 1)
        for k in range(1, len(poly) - 1): tris.append((poly[0], poly[k], poly[k + 1]))
        poly = []
    else: poly.append(int(v))
tris = np.array(tris, dtype=np.uint32).reshape(-1, 3)
uv = None
for cc in geom.ch:
    if cc.name == b"LayerElementUV":
        ua = arr_typed(cc, b"UV")
        if ua is not None: uv = ua.reshape(-1, 2).astype(np.float32).copy()
        break
nrm = None
for cc in geom.ch:
    if cc.name == b"LayerElementNormal":
        na = arr_typed(cc, b"Normals")
        if na is not None: nrm = na.reshape(-1, 3).astype(np.float32).copy()
        break
# FBX normals/uv may be per-face-vertex (ByPolygonVertex). If len > nV, index-map them.
if nrm is not None and len(nrm) == len(pvi):
    nrm = nrm[:len(pvi)]  # fallback; will be per-corner — handle below
if uv is not None:
    uv_idx = None
    for cc2 in (c for c in geom.ch if c.name == b"LayerElementUV"):
        ui = arr_typed(cc2, b"UVIndex")
        if ui is not None: uv_idx = ui
nV = len(verts)
print(f"mesh: V={nV} T={len(tris)} uv={'Y' if uv is not None else 'N'} norm={'Y' if nrm is not None else 'N'}")

# ---- bones + hierarchy + rest Lcl props ----
bones = {}; bone_order = []
for oid, nm, typ, node in models:
    if typ == "LimbNode":
        bones[oid] = {"name": nm, "id": oid, "parentId": None}
        bone_order.append(oid)
for ct, src, dst, pr in conns:
    if ct == "OO" and src in bones and dst in bones:
        bones[src]["parentId"] = dst
id2idx = {bid: i for i, bid in enumerate(bone_order)}

# extract Properties70 Lcl Translation/Rotation/Scaling per bone (rest pose)
def props70_lcl(node):
    out = {"T": (0, 0, 0), "R": (0, 0, 0), "S": (1, 1, 1), "PreR": None}
    for cc in node.ch:
        if cc.name == b"Properties70":
            for p in cc.ch:
                if p.name != b"P" or len(p.props) < 7: continue
                nm = prop_str(p.props[0])
                # P layout: name, type, subtype, flag, val0, val1, val2  (doubles at idx 4..6)
                vals = []
                for i in range(4, 7):
                    pp = p.props[i]
                    if pp[0] in ("D", "F"): vals.append(float(pp[1]))
                    elif pp[0] in ("I", "L", "Y"): vals.append(float(pp[1]))
                    else: vals.append(0.0)
                if nm == "Lcl Translation": out["T"] = tuple(vals)
                elif nm == "Lcl Rotation": out["R"] = tuple(vals)
                elif nm == "Lcl Scaling": out["S"] = tuple(vals)
                elif nm == "PreRotation": out["PreR"] = tuple(vals)
    return out

rest = []
for bid in bone_order:
    node = obj_by_id[bid][3]
    pr = props70_lcl(node)
    pidx = id2idx[bones[bid]["parentId"]] if bones[bid]["parentId"] in id2idx else -1
    rest.append({"parentIdx": pidx, "T": pr["T"], "R": pr["R"], "S": pr["S"], "PreR": pr["PreR"]})

def euler_xyz_deg_to_quat(rx, ry, rz):
    x = np.radians(rx); y = np.radians(ry); z = np.radians(rz)
    c1, s1 = np.cos(x/2), np.sin(x/2); c2, s2 = np.cos(y/2), np.sin(y/2); c3, s3 = np.cos(z/2), np.sin(z/2)
    qw = c1*c2*c3 - s1*s2*s3
    qx = s1*c2*c3 + c1*s2*s3
    qy = c1*s2*c3 - s1*c2*s3
    qz = c1*c2*s3 + s1*s2*c3
    return (qx, qy, qz, qw)

def quat_mul(a, b):
    ax, ay, az, aw = a; bx, by, bz, bw = b
    return (aw*bx + ax*bw + ay*bz - az*by,
            aw*by - ax*bz + ay*bw + az*bx,
            aw*bz + ax*by - ay*bx + az*bw,
            aw*bw - ax*bx - ay*by - az*bz)

# ==== BIND POSE from cluster TransformLink (authoritative) ====
# FBX affine matrices are row-vector (translation in last row) -> transpose to column-vector (three.js)
def mat_from_fbx(vals):
    return np.array(vals, dtype=np.float64).reshape(4, 4).T

def quat_from_mat(R):
    tr = R[0, 0] + R[1, 1] + R[2, 2]
    if tr > 0:
        S = np.sqrt(tr + 1.0) * 2
        w = 0.25 * S; x = (R[2, 1] - R[1, 2]) / S; y = (R[0, 2] - R[2, 0]) / S; z = (R[1, 0] - R[0, 1]) / S
    elif R[0, 0] > R[1, 1] and R[0, 0] > R[2, 2]:
        S = np.sqrt(1.0 + R[0, 0] - R[1, 1] - R[2, 2]) * 2
        w = (R[2, 1] - R[1, 2]) / S; x = 0.25 * S; y = (R[0, 1] + R[1, 0]) / S; z = (R[0, 2] + R[2, 0]) / S
    elif R[1, 1] > R[2, 2]:
        S = np.sqrt(1.0 + R[1, 1] - R[0, 0] - R[2, 2]) * 2
        w = (R[0, 2] - R[2, 0]) / S; x = (R[0, 1] + R[1, 0]) / S; y = 0.25 * S; z = (R[1, 2] + R[2, 1]) / S
    else:
        S = np.sqrt(1.0 + R[2, 2] - R[0, 0] - R[1, 1]) * 2
        w = (R[1, 0] - R[0, 1]) / S; x = (R[0, 2] + R[2, 0]) / S; y = (R[1, 2] + R[2, 1]) / S; z = 0.25 * S
    return (float(x), float(y), float(z), float(w))

def decompose(M):
    T = M[0:3, 3].astype(np.float64)
    m3 = M[0:3, 0:3].astype(np.float64).copy()
    sx = np.linalg.norm(m3[:, 0]) or 1.0
    sy = np.linalg.norm(m3[:, 1]) or 1.0
    sz = np.linalg.norm(m3[:, 2]) or 1.0
    Rm = m3.copy(); Rm[:, 0] /= sx; Rm[:, 1] /= sy; Rm[:, 2] /= sz
    if np.linalg.det(Rm) < 0:  # fix reflection
        Rm[:, 0] *= -1; sx = -sx
    return (float(T[0]), float(T[1]), float(T[2])), quat_from_mat(Rm), (float(sx), float(sy), float(sz))

# cluster -> bone map + cluster TransformLink world matrices
cl_to_bone = {}
for ct, src, dst, pr in conns:
    if ct != "OO": continue
    if src in obj_by_id and obj_by_id[src][0] == "Deformer" and obj_by_id[src][2] == "Cluster" and dst in id2idx:
        cl_to_bone[src] = dst
    elif dst in obj_by_id and obj_by_id[dst][0] == "Deformer" and obj_by_id[dst][2] == "Cluster" and src in id2idx:
        cl_to_bone[dst] = src

bone_world = {}  # bone_idx -> 4x4 column-vector world bind matrix
for clid, boneid in cl_to_bone.items():
    node = obj_by_id[clid][3]
    tl = arr_typed(node, b"TransformLink")
    if tl is not None and len(tl) >= 16:
        bone_world[id2idx[boneid]] = mat_from_fbx(tl[:16])

# fallback world for bones without a cluster: parentWorld @ localFromLcl
def local_mat_from_lcl(r):
    q = euler_xyz_deg_to_quat(*r["R"])
    if r["PreR"] is not None:
        q = quat_mul(euler_xyz_deg_to_quat(*r["PreR"]), q)
    x, y, z, w = q
    R = np.array([
        [1-2*(y*y+z*z), 2*(x*y-z*w),   2*(x*z+y*w)],
        [2*(x*y+z*w),   1-2*(x*x+z*z), 2*(y*z-x*w)],
        [2*(x*z-y*w),   2*(y*z+x*w),   1-2*(x*x+y*y)]], dtype=np.float64)
    M = np.eye(4); M[0:3, 0:3] = R * np.array(r["S"]); M[0:3, 3] = r["T"]
    return M

for i in range(len(bone_order)):
    if i in bone_world: continue
    r = rest[i]; pidx = r["parentIdx"]
    pw = bone_world.get(pidx, np.eye(4)) if pidx >= 0 else np.eye(4)
    bone_world[i] = pw @ local_mat_from_lcl(r)

# local bind = inv(parentWorld) @ world  -> decompose to T/quat/S
rest_quat = []
for i in range(len(bone_order)):
    pidx = rest[i]["parentIdx"]
    pw = bone_world.get(pidx, np.eye(4)) if pidx >= 0 else np.eye(4)
    Lc = np.linalg.inv(pw) @ bone_world[i]
    T, q, S = decompose(Lc)
    rest[i]["T"] = T; rest[i]["S"] = S
    rest_quat.append(q)

print(f"bones: {len(bones)} (bind from TransformLink: {len(cl_to_bone)}/{len(bone_order)})")

# ---- skin: clusters -> per-vertex (boneIdx, weight) ----
cluster_to_bone = {}
for ct, src, dst, pr in conns:
    if ct != "OO": continue
    # cluster may be src OR dst; the other end is the bone (LimbNode)
    if src in obj_by_id and obj_by_id[src][0] == "Deformer" and obj_by_id[src][2] == "Cluster" and dst in id2idx:
        cluster_to_bone[src] = dst
    elif dst in obj_by_id and obj_by_id[dst][0] == "Deformer" and obj_by_id[dst][2] == "Cluster" and src in id2idx:
        cluster_to_bone[dst] = src
skin_id = None
for ct, src, dst, pr in conns:
    if ct == "OO" and src in obj_by_id and obj_by_id[src][0] == "Deformer" and obj_by_id[src][2] == "Skin" and dst == geom_id:
        skin_id = src
clusters = []
if skin_id:
    for ct, src, dst, pr in conns:
        if ct == "OO" and dst == skin_id and src in obj_by_id and obj_by_id[src][2] == "Cluster":
            clusters.append(src)

vw = [{} for _ in range(nV)]
for cl in clusters:
    bone = cluster_to_bone.get(cl)
    if bone is None: continue
    bid = id2idx[bone]
    node = obj_by_id[cl][3]
    ib = arr_typed(node, b"Indexes"); wb = arr_typed(node, b"Weights")
    if ib is None or wb is None: continue
    for vi, wi in zip(ib.astype(np.int64), wb.astype(np.float64)):
        if 0 <= vi < nV: vw[vi][bid] = float(wi)
skinIdx = np.zeros((nV, 4), dtype=np.uint16)
skinW = np.zeros((nV, 4), dtype=np.float32)
for i in range(nV):
    items = sorted(vw[i].items(), key=lambda x: -x[1])[:4]
    s = sum(w for _, w in items) or 1.0
    for k, (bid, wv) in enumerate(items):
        skinIdx[i, k] = bid; skinW[i, k] = wv / s
print(f"clusters: {len(clusters)}")

# ---- animation: full curves ----
FBX_TPS = 46186158000
stacks = [oid for oid, v in obj_by_id.items() if v[0] == "AnimationStack"]

def parse_curve(cid):
    node = obj_by_id[cid][3]
    kt = arr_typed(node, b"KeyTime"); kv = arr_typed(node, b"KeyValueFloat")
    t = (kt.astype(np.float64) / FBX_TPS).astype(np.float32) if kt is not None else np.array([], np.float32)
    v = kv.astype(np.float32) if kv is not None else np.array([], np.float32)
    return t, v

clips = []
for sid in stacks:
    name = obj_by_id[sid][1] or "clip"
    layers = [s for (ct, s, d, p) in conns if ct == "OO" and d == sid and s in obj_by_id and obj_by_id[s][0] == "AnimationLayer"]
    if not layers: continue
    layer = layers[0]
    cnode_ids = [s for (ct, s, d, p) in conns if ct == "OO" and d == layer and s in obj_by_id and obj_by_id[s][0] == "AnimationCurveNode"]
    tracks = {}  # bone -> {"t":{x,y,z}, "r":..., "s":...}
    for cn in cnode_ids:
        bone = None; chan = None
        for (ct, s, d, p) in conns:
            if ct == "OP" and s == cn and d in bones and p:
                if p.startswith("Lcl T"): chan = "t"
                elif p.startswith("Lcl R"): chan = "r"
                elif p.startswith("Lcl S"): chan = "s"
                bone = d
        if bone is None: continue
        xs = ys = zs = None
        for (ct, s, d, p) in conns:
            if ct == "OP" and d == cn and p and s in obj_by_id and obj_by_id[s][0] == "AnimationCurve":
                if p.endswith("d|X"): xs = s
                elif p.endswith("d|Y"): ys = s
                elif p.endswith("d|Z"): zs = s
        chan_data = {}
        for ax, cid in (("x", xs), ("y", ys), ("z", zs)):
            if cid is None: continue
            chan_data[ax] = parse_curve(cid)
        tracks.setdefault(bone, {})[chan] = chan_data
    # build track list with merged per-channel times
    trk_list = []
    dur = 0.0
    for bone, chans in tracks.items():
        bid = id2idx[bone]
        def merge(channel):
            ch = chans.get(channel)
            if not ch: return None
            arrs = [ch[a][0] for a in ch if len(ch[a][0])]
            if not arrs: return None
            ts = sorted(set(np.concatenate(arrs).tolist()))
            ts = np.array(ts, dtype=np.float32)
            vals = np.zeros((len(ts), 3), dtype=np.float32)
            tm = {float(t): i for i, t in enumerate(ts)}
            for ax in ("x", "y", "z"):
                if ax in ch and len(ch[ax][0]):
                    tt, vv = ch[ax]
                    for k in range(len(tt)):
                        idx = tm.get(float(tt[k]))
                        if idx is not None: vals[idx, "xyz".index(ax)] = vv[k]
            return ts, vals
        pt = merge("t"); rt = merge("r"); st_ = merge("s")
        # strip root motion -> in-place: root bone (parent==-1) 的 X/Z 位移锁到首帧，保留 Y(走路bob)
        if rest[bid]["parentIdx"] == -1 and pt is not None:
            _ts, _v = pt
            _v[:, 0] = _v[0, 0]
            _v[:, 2] = _v[0, 2]
            pt = (_ts, _v)
            print(f"  [root-motion stripped] bone{bid}({bones[bone]['name']}): X/Z locked to first frame, Y kept")
        for d in (pt, rt, st_):
            if d is not None and len(d[0]): dur = max(dur, float(d[0][-1]))
        # convert rotation euler deg -> quat
        rq = None
        if rt is not None:
            rts, rvals = rt
            q = np.zeros((len(rts), 4), dtype=np.float32)
            for i in range(len(rts)):
                # apply PreRotation if present
                ql = euler_xyz_deg_to_quat(rvals[i, 0], rvals[i, 1], rvals[i, 2])
                pre = rest[id2idx[bone]]["PreR"]
                if pre is not None:
                    qpre = euler_xyz_deg_to_quat(*pre)
                    ql = quat_mul(qpre, ql)
                q[i] = ql
            rq = (rts, q)
        trk_list.append({"bone": bid, "p": pt, "r": rq, "s": st_})
    clips.append({"name": name, "duration": dur, "tracks": trk_list})
    print(f"clip '{name}' dur={dur:.3f}s tracks={len(trk_list)}")

# ---- write RIG3D ----
buf = bytearray()
buf += b"RIG3D"; buf += struct.pack("<B", 1); buf += b"\x00\x00"  # 2 pad bytes -> data at 4-aligned offset 24
buf += struct.pack("<IIII", nV, len(tris), len(bones), len(clips))
buf += verts.astype("<f4").tobytes()
buf += (uv.astype("<f4").tobytes() if uv is not None and len(uv) == nV else np.zeros((nV, 2), np.float32).tobytes())
buf += (nrm.astype("<f4").tobytes() if nrm is not None and len(nrm) == nV else np.zeros((nV, 3), np.float32).tobytes())
buf += tris.astype("<u4").tobytes()
buf += skinIdx.astype("<u2").tobytes()
buf += skinW.astype("<f4").tobytes()
# bones (44 bytes each, 4-aligned)
for i, r in enumerate(rest):
    buf += struct.pack("<i", r["parentIdx"])
    buf += np.array(r["T"], dtype="<f4").tobytes()
    buf += np.array(rest_quat[i], dtype="<f4").tobytes()
    buf += np.array(r["S"], dtype="<f4").tobytes()
# clips
for c in clips:
    nb = c["name"].encode("utf-8")
    buf += struct.pack("<I", len(nb)); buf += nb
    while len(buf) % 4 != 0: buf += b"\x00"  # pad name to 4
    buf += struct.pack("<fI", c["duration"], len(c["tracks"]))
    for t in c["tracks"]:
        buf += struct.pack("<I", t["bone"])
        for ch in ("p", "r", "s"):
            d = t[ch]
            if d is None:
                buf += struct.pack("<I", 0)
            else:
                ts, vals = d
                buf += struct.pack("<I", len(ts))
                buf += ts.astype("<f4").tobytes()
                buf += vals.astype("<f4").tobytes()
open(OUTBIN, "wb").write(buf)
print(f"WROTE {OUTBIN} ({len(buf)} bytes)")
# also b64
import base64
b64 = base64.b64encode(bytes(buf)).decode()
open(OUTBIN.replace(".bin", ".b64"), "w").write(b64)
print(f"WROTE {OUTBIN.replace('.bin','.b64')} ({len(b64)} bytes)")
