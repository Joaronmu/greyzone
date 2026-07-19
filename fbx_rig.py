import struct, zlib, sys, json, os
import numpy as np

PATH = sys.argv[1] if len(sys.argv) > 1 else "C:/Users/零零/Downloads/Firing Rifle.fbx"
OUTJ = sys.argv[2] if len(sys.argv) > 2 else "rig_data.json"
OUTB = sys.argv[3] if len(sys.argv) > 3 else "rig_data.bin"

data = open(PATH, "rb").read()
version = struct.unpack_from("<I", data, 23)[0]
USE64 = version >= 7500
HDR = 27

def u(off, n=4):
    if n == 4: return struct.unpack_from("<I", data, off)[0]
    return struct.unpack_from("<Q", data, off)[0]

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
    base = off
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
        pe = u(off) if USE64 else u(off)
        if pe == 0: break
        c = rn(off); n.ch.append(c); off = c.end
    return n

top = []; off = HDR
while off < len(data):
    pe = u(off)
    if pe == 0: break
    n = rn(off); top.append(n); off = n.end

objs = next(t for t in top if t.name == b"Objects")
conns_node = next((t for t in top if t.name == b"Connections"), None)

# ---- index objects by id ----
def prop_str(p):
    if not p or p[0] not in ("S",): return None
    s = p[1].decode("utf-8", "replace")
    # FBX Model name may carry "\x00\x01Type" junk — cut at first NUL
    if "\x00" in s: s = s.split("\x00", 1)[0]
    return s
def prop_int(p):
    if not p: return None
    if p[0] == "L": return p[1]
    if p[0] == "I": return p[1]
    return None

obj_by_id = {}   # id -> (name, type, node)
models = []      # (id, name, type)
for c in objs.ch:
    if c.name == b"Model":
        oid = prop_int(c.props[0]); nm = prop_str(c.props[1]); typ = prop_str(c.props[2])
        obj_by_id[oid] = ("Model", nm, typ, c); models.append((oid, nm, typ, c))
    elif c.name == b"Geometry":
        oid = prop_int(c.props[0]); obj_by_id[oid] = ("Geometry", None, None, c)
    elif c.name == b"Deformer":
        oid = prop_int(c.props[0]); typ = prop_str(c.props[2]) if len(c.props) >= 3 else None
        obj_by_id[oid] = ("Deformer", None, typ, c)
    elif c.name == b"AnimationStack":
        oid = prop_int(c.props[0]); nm = prop_str(c.props[1]) if len(c.props) > 1 else "clip"
        obj_by_id[oid] = ("AnimationStack", nm, None, c)
    elif c.name == b"AnimationLayer":
        oid = prop_int(c.props[0]); obj_by_id[oid] = ("AnimationLayer", None, None, c)
    elif c.name == b"AnimationCurveNode":
        oid = prop_int(c.props[0]); obj_by_id[oid] = ("AnimationCurveNode", None, None, c)
    elif c.name == b"AnimationCurve":
        oid = prop_int(c.props[0]); obj_by_id[oid] = ("AnimationCurve", None, None, c)
    elif c.name == b"Pose":
        oid = prop_int(c.props[0]); typ = prop_str(c.props[2]) if len(c.props) >= 3 else None
        obj_by_id[oid] = ("Pose", None, typ, c)

# ---- connections ----
conns = []  # (ctype, src, dst, prop)
if conns_node:
    for c in conns_node.ch:
        if c.name != b"C": continue
        ct = prop_str(c.props[0])
        src = prop_int(c.props[1]); dst = prop_int(c.props[2])
        pr = prop_str(c.props[3]) if len(c.props) > 3 else None
        conns.append((ct, src, dst, pr))

# children of each obj (OO): map id -> list of child ids, and parent map
children = {}; parent = {}
oo_to = {}  # dst -> [src...]
op_to = {}  # dst -> [(src, prop)]
for ct, src, dst, pr in conns:
    if ct == "OO":
        oo_to.setdefault(dst, []).append(src)
        oo_to.setdefault(src, [])  # ensure
        parent[src] = dst
    elif ct == "OP":
        op_to.setdefault(dst, []).append((src, pr))

# ---- find mesh geometry (the Model 'Mesh' -> its Geometry) ----
mesh_model = None; geom = None
for oid, nm, typ, node in models:
    if typ == "Mesh":
        mesh_model = oid
        for ch in oo_to.get(oid, []):
            if ch in obj_by_id and obj_by_id[ch][0] == "Geometry":
                geom = obj_by_id[ch][3]; geom_id = ch
                break
        if geom: break

def arr_bytes(node, key):
    for cc in node.ch:
        if cc.name == key and cc.props:
            raw = cc.props[0][1]
            try: raw = zlib.decompress(raw)
            except: pass
            return raw
    return None

def arr_typed(node, key):
    """Return (np.array, dtype) reading the property's type code ('d'->f8, 'f'->f4, 'i'->i4)."""
    for cc in node.ch:
        if cc.name == key and cc.props:
            tc = cc.props[0][0]
            raw = cc.props[0][1]
            try: raw = zlib.decompress(raw)
            except: pass
            if tc == 'd': return np.frombuffer(raw, dtype='<f8'), 'f8'
            if tc == 'f': return np.frombuffer(raw, dtype='<f4'), 'f4'
            if tc == 'i': return np.frombuffer(raw, dtype='<i4'), 'i4'
            if tc == 'l': return np.frombuffer(raw, dtype='<i8'), 'i8'
            return np.frombuffer(raw, dtype='<f4'), 'f4'
    return None, None

# vertices
verts = None
va, _ = arr_typed(geom, b"Vertices")
if va is not None:
    verts = va.reshape(-1, 3).astype(np.float32).copy()
# faces
pvi = None
pb = arr_bytes(geom, b"PolygonVertexIndex")
if pb:
    pvi = np.frombuffer(pb, dtype="<i4").copy()
# decode triangles
tris = []
poly = []
for v in pvi:
    if v < 0:
        poly.append(-v - 1)
        # fan triangulate
        for k in range(1, len(poly) - 1):
            tris.append((poly[0], poly[k], poly[k + 1]))
        poly = []
    else:
        poly.append(v)
tris = np.array(tris, dtype=np.uint32).reshape(-1, 3)
# uv
uv = None
for cc in geom.ch:
    if cc.name == b"LayerElementUV":
        ua, _ = arr_typed(cc, b"UV")
        if ua is not None: uv = ua.reshape(-1, 2).astype(np.float32).copy()
        break
# normals
nrm = None
for cc in geom.ch:
    if cc.name == b"LayerElementNormal":
        na, _ = arr_typed(cc, b"Normals")
        if na is not None: nrm = na.reshape(-1, 3).astype(np.float32).copy()
        break

print(f"MESH: verts={len(verts)} tris={len(tris)} uv={'Y' if uv is not None else 'N'} norm={'Y' if nrm is not None else 'N'}")

# ---- skeleton: LimbNode models, hierarchy, bind pose from Pose/Matrix ----
bones = {}  # id -> {name, parentId, children}
bone_order = []
for oid, nm, typ, node in models:
    if typ == "LimbNode":
        bones[oid] = {"name": nm, "id": oid, "parentId": None, "children": []}
        bone_order.append(oid)
# hierarchy via OO parent
for ct, src, dst, pr in conns:
    if ct == "OO" and src in bones and dst in bones:
        bones[src]["parentId"] = dst
        bones[dst]["children"].append(src)

# bind pose: prefer Pose (BindPose) matrices; fallback to cluster TransformLink
bind_world = {}  # id -> 4x4 world matrix
for oid, (kind, nm, typ, node) in obj_by_id.items():
    if kind == "Pose" and typ == "BindPose":
        for pn in node.ch:
            if pn.name == b"PoseNode":
                nid = None; mat = None
                for cc in pn.ch:
                    if cc.name == b"Node":
                        nid = prop_int(cc.props[0])
                    elif cc.name == b"Matrix":
                        mb = arr_bytes(pn, b"Matrix")
                        if mb is not None:
                            if len(mb) == 128:
                                mat = np.frombuffer(mb, dtype="<f8").reshape(4, 4).copy()
                            elif len(mb) == 64:
                                mat = np.frombuffer(mb, dtype="<f4").reshape(4, 4).copy()
                            else:
                                mat = None  # unexpected size; skip (will use TransformLink)
                if nid is not None and mat is not None:
                    bind_world[nid] = mat

# ---- skin: find Skin deformer on geometry, then clusters ----
# Skin OO-> Geometry ; Cluster OO-> Skin ; Cluster OO-> bone(LimbNode)
cluster_to_bone = {}
for ct, src, dst, pr in conns:
    if ct == "OO" and src in obj_by_id and obj_by_id[src][0] == "Deformer" and obj_by_id[src][2] == "Cluster":
        if dst in bones:
            cluster_to_bone[src] = dst
# also skin->geom
skin_id = None
for ct, src, dst, pr in conns:
    if ct == "OO" and src in obj_by_id and obj_by_id[src][0] == "Deformer" and obj_by_id[src][2] == "Skin":
        if dst == geom_id:
            skin_id = src
# clusters under this skin
clusters = []
if skin_id:
    for ct, src, dst, pr in conns:
        if ct == "OO" and dst == skin_id and src in obj_by_id and obj_by_id[src][2] == "Cluster":
            clusters.append(src)

# extract per-cluster: Indexes, Weights, TransformLink
per_bone_weights = {}  # bone_id -> (vertIdx np.int32, weights np.float32)
transform_link = {}    # bone_id -> 4x4
for cl in clusters:
    bone = cluster_to_bone.get(cl)
    if bone is None: continue
    node = obj_by_id[cl][3]
    ib = arr_bytes(node, b"Indexes"); wb = arr_bytes(node, b"Weights")
    tl = arr_bytes(node, b"TransformLink")
    idx = np.frombuffer(ib, dtype="<i4") if ib else np.array([], dtype=np.int32)
    w = np.frombuffer(wb, dtype="<f8") if wb else np.array([], dtype=np.float64)
    per_bone_weights[bone] = (idx, w.astype(np.float32))
    if tl:
        transform_link[bone] = np.frombuffer(tl, dtype="<f8").reshape(4, 4).copy()

# fill bind_world from transform_link if missing
for b, m in transform_link.items():
    if b not in bind_world: bind_world[b] = m.astype(np.float32)

print(f"BONES: {len(bones)}  clusters: {len(clusters)}  bind_world: {len(bind_world)}")

# ---- animation ----
stacks = [oid for oid, (k, nm, t, n) in obj_by_id.items() if k == "AnimationStack"]
print(f"ANIM STACKS: {len(stacks)}")

FBX_TIME_PER_SEC = 46186158000
def parse_curve(curve_id):
    node = obj_by_id[curve_id][3]
    kt = arr_bytes(node, b"KeyTime"); kv = arr_bytes(node, b"KeyValueFloat")
    times = np.frombuffer(kt, dtype="<i8").astype(np.float64) / FBX_TIME_PER_SEC if kt else np.array([])
    vals = np.frombuffer(kv, dtype="<f4") if kv else np.array([])
    return times, vals

clips = []
for sid in stacks:
    clipname = obj_by_id[sid][1] or "clip"
    # layers
    layers = [s for (ct, s, d, p) in conns if ct == "OO" and d == sid and s in obj_by_id and obj_by_id[s][0] == "AnimationLayer"]
    if not layers: continue
    layer = layers[0]
    # curveNodes under layer
    cnode_ids = [s for (ct, s, d, p) in conns if ct == "OO" and d == layer and s in obj_by_id and obj_by_id[s][0] == "AnimationCurveNode"]
    tracks = {}  # bone_id -> {"t":{x,y,z}, "r":..., "s":...}
    for cn in cnode_ids:
        # this curveNode OP-links to a bone Model property "Lcl Translation/Rotation/Scaling"
        bone = None; chan = None
        for (ct, s, d, p) in conns:
            if ct == "OP" and s == cn and d in bones and p:
                if p.startswith("Lcl T"): chan = "t"
                elif p.startswith("Lcl R"): chan = "r"
                elif p.startswith("Lcl S"): chan = "s"
                bone = d
        if bone is None: continue
        # curves OP-linked to this curnode with d|X/d|Y/d|Z
        xs = ys = zs = None
        for (ct, s, d, p) in conns:
            if ct == "OP" and d == cn and p and s in obj_by_id and obj_by_id[s][0] == "AnimationCurve":
                if p.endswith("d|X") or p == "d|X": xs = s
                elif p.endswith("d|Y") or p == "d|Y": ys = s
                elif p.endswith("d|Z") or p == "d|Z": zs = s
        arr = {}
        for ax, cid in (("x", xs), ("y", ys), ("z", zs)):
            if cid is None: continue
            t, v = parse_curve(cid)
            arr[ax] = {"n": int(len(t)), "t0": float(t[0]) if len(t) else 0.0, "t1": float(t[-1]) if len(t) else 0.0,
                       "v0": float(v[0]) if len(v) else 0.0}
        tracks.setdefault(bone, {})[chan] = arr
    # build track list
    trk_list = []
    dur = 0.0
    for bone, chans in tracks.items():
        for chan, arr in chans.items():
            for ax, info in arr.items():
                if info["n"]: dur = max(dur, info["t1"])
        trk_list.append({"bone": bones[bone]["name"], "chans": chans})
    clips.append({"name": clipname, "duration": dur, "tracks": trk_list})
    print(f"  clip '{clipname}' dur={dur:.3f}s tracks={len(trk_list)}")

# ---- per-vertex skin weights (for reference mesh) ----
nV = len(verts)
# accumulate per vertex
vw = [{} for _ in range(nV)]
for bone, (idx, w) in per_bone_weights.items():
    bid = bone_order.index(bone)
    for vi, wi in zip(idx, w):
        if 0 <= vi < nV:
            vw[vi][bid] = float(wi)
skinIdx = np.zeros((nV, 4), dtype=np.int32)
skinW = np.zeros((nV, 4), dtype=np.float32)
for i in range(nV):
    items = sorted(vw[i].items(), key=lambda x: -x[1])[:4]
    s = sum(w for _, w in items) or 1.0
    for k, (bid, wv) in enumerate(items):
        skinIdx[i, k] = bid; skinW[i, k] = wv / s

# ---- compute bone rest LOCAL matrices from world bind ----
# order bones, parent idx
bone_list = []  # {name, parentIdx, world(4x4), local(4x4)}
id2idx = {bid: i for i, bid in enumerate(bone_order)}
for i, bid in enumerate(bone_order):
    b = bones[bid]
    pid = b["parentId"]
    pidx = id2idx[pid] if pid is not None else -1
    W = bind_world.get(bid)
    if W is None:
        W = np.eye(4, dtype=np.float32)
    if pidx >= 0:
        pW = bind_world.get(pid, np.eye(4, dtype=np.float32))
        local = np.linalg.inv(pW) @ W
    else:
        local = W.copy()
    bone_list.append({"name": b["name"], "parentIdx": pidx, "world": W.tolist(), "local": local.tolist()})

# ---- write outputs ----
# binary: nV,nT, pos, uv?, nrm?, idx, skinIdx, skinW
with open(OUTB, "wb") as f:
    f.write(struct.pack("<II", nV, len(tris)))
    f.write(verts.astype("<f4").tobytes())
    f.write(tris.astype("<u4").tobytes())
    if uv is not None and len(uv) == nV:
        f.write(struct.pack("<B", 1)); f.write(uv.astype("<f4").tobytes())
    else:
        f.write(struct.pack("<B", 0))
    if nrm is not None and len(nrm) == nV:
        f.write(struct.pack("<B", 1)); f.write(nrm.astype("<f4").tobytes())
    else:
        f.write(struct.pack("<B", 0))
    f.write(skinIdx.astype("<i4").tobytes())
    f.write(skinW.astype("<f4").tobytes())

# json: bones, clips, mesh bbox
mn = np.nanmin(verts, 0); mx = np.nanmax(verts, 0)
meta = {
    "fbx": os.path.basename(PATH),
    "bbox": {"min": mn.tolist(), "max": mx.tolist(), "size": (mx - mn).tolist()},
    "nverts": nV, "ntris": len(tris),
    "bones": bone_list,
    "clips": clips,
}
with open(OUTJ, "w") as f:
    json.dump(meta, f)
print(f"WROTE {OUTB} ({os.path.getsize(OUTB)} bytes) + {OUTJ} ({os.path.getsize(OUTJ)} bytes)")
print("bone names:", [b["name"] for b in bone_list[:8]], "...")
