import struct, zlib, sys, collections
path = sys.argv[1] if len(sys.argv)>1 else "C:/Users/零零/Downloads/y目标.fbx"
data = open(path,"rb").read()
version = struct.unpack_from("<I", data, 23)[0]
USE64 = version >= 7500; HDR = 27
print(f"=== {path.split('/')[-1]}  v{version}  {len(data)} bytes ===")

class N:
    __slots__=("ch","props","name","end")
    def __init__(s): s.ch=[]; s.props=[]; s.name=b""; s.end=0
def psz(tc, off):
    if tc in "YC": return 2 if tc=="Y" else 1
    if tc in "IF": return 4
    if tc in "DL": return 8
    if tc in "RS": return 4+struct.unpack_from("<I", data, off)[0]
    if tc in "fidbl": return 12+struct.unpack_from("<III", data, off)[2]
    return 0
def propval(tc, off):
    if tc=="Y": return struct.unpack_from("<h", data, off)[0]
    if tc=="C": return data[off]!=0
    if tc=="I": return struct.unpack_from("<i", data, off)[0]
    if tc=="F": return struct.unpack_from("<f", data, off)[0]
    if tc=="D": return struct.unpack_from("<d", data, off)[0]
    if tc=="L": return struct.unpack_from("<q", data, off)[0]
    if tc in "RS":
        ln=struct.unpack_from("<I", data, off)[0]; return data[off+4:off+4+ln]
    if tc in "fidbl":
        a,e,c=struct.unpack_from("<III", data, off); return data[off+12:off+12+c]
    return None
def rn(off):
    base=off
    if USE64:
        eo,np_,pl=struct.unpack_from("<QQQ", data, off); off+=24
    else:
        eo,np_,pl=struct.unpack_from("<III", data, off); off+=12
    nl=data[off]; off+=1; nm=data[off:off+nl]; off+=nl
    n=N(); n.name=nm; n.end=eo
    for _ in range(np_):
        tc=chr(data[off]); off+=1
        v=propval(tc, off); n.props.append((tc,v)); off+=psz(tc, off)
    while off<eo:
        if USE64:
            pe=struct.unpack_from("<Q", data, off)[0]
        else:
            pe=struct.unpack_from("<I", data, off)[0]
        if pe==0: break
        c=rn(off); n.ch.append(c); off=c.end
    return n
top=[]; off=HDR
while off<len(data):
    if USE64:
        pe=struct.unpack_from("<Q", data, off)[0]
    else:
        pe=struct.unpack_from("<I", data, off)[0]
    if pe==0: break
    n=rn(off); top.append(n); off=n.end

objs=[t for t in top if t.name==b'Objects']
objs=objs[0] if objs else None
counts=collections.Counter()
model_types=collections.Counter()
defmodel={}  # name->type
bones=[]
anim_nodes=collections.Counter()
def walk(n):
    counts[n.name]+=1
    if n.name==b'Model':
        # props: (uid, name, type)
        p=n.props
        typ=p[2][1] if len(p)>=3 and p[2][0]=="S" else b"?"
        model_types[typ]+=1
        nm=p[1][1] if len(p)>=2 and p[1][0]=="S" else b"?"
        defmodel[p[0][1]]= (nm, typ)
        if typ==b'LimbNode': bones.append(nm)
    if n.name.startswith(b'Animation'):
        anim_nodes[n.name]+=1
        if n.name==b'AnimationCurve':
            # count keys
            for cc in n.ch:
                if cc.name==b'KeyValueFloat' and cc.props:
                    raw=cc.props[0][1]
                    try: raw=zlib.decompress(raw)
                    except: pass
                    anim_nodes[b'__keys_total'] += len(raw)//4
    for c in n.ch: walk(c)
if objs: walk(objs)

print("Object node counts (top):")
for k,v in counts.most_common(30):
    if v>=1: print(f"  {k.decode():24s} {v}")
print("Model types:", {k.decode():v for k,v in model_types.items()})
print(f"Bones (LimbNode): {len(bones)}")
if bones: print("  sample:", [b.decode(errors='replace') for b in bones[:12]])
print("Animation nodes:", {k.decode(errors='replace'):v for k,v in anim_nodes.items()})

# Geometry -> has Skin/Cluster?
geoms=[c for c in (objs.ch if objs else []) if c.name==b'Geometry']
print(f"Geometries: {len(geoms)}")
for gi,g in enumerate(geoms):
    sub=[c.name for c in g.ch]
    has_skin = b'Skin' in sub
    clusters = sum(1 for c in g.ch if c.name==b'Deformer' and len(c.props)>=3 and c.props[2][1]==b'Cluster')
    # also Deformer Skin
    skins = sum(1 for c in g.ch if c.name==b'Deformer' and len(c.props)>=3 and c.props[2][1]==b'Skin')
    vn=0
    for cc in g.ch:
        if cc.name==b'Vertices' and cc.props:
            raw=cc.props[0][1]
            try: raw=zlib.decompress(raw)
            except: pass
            vn=len(raw)//8
    print(f"  geom[{gi}] verts={vn} Skin={skins} Cluster={clusters} sub={[s.decode() for s in sub[:8]]}")

# Connections: count OO/OP links
conns=[t for t in top if t.name==b'Connections']
if conns:
    cc=conns[0]
    oo=sum(1 for c in cc.ch if c.name==b'OO')
    op=sum(1 for c in cc.ch if c.name==b'OP')
    print(f"Connections: OO={oo} OP={op}")
