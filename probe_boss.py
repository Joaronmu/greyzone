import struct, zlib
data = open("C:/Users/零零/Downloads/小boss.fbx","rb").read()
version = struct.unpack_from("<I", data, 23)[0]
USE64 = version >= 7500; HDR = 27
print("version",version,"USE64",USE64,"size",len(data))

class N:
    __slots__=("ch","props","name","end","start")
    def __init__(s): s.ch=[]; s.props=[]; s.name=b""; s.end=0; s.start=0
def psz(tc, off):
    if tc in "Y": return 2
    if tc=="C": return 1
    if tc in "IF": return 4
    if tc=="D": return 8
    if tc=="L": return 8
    if tc in "RS": return 4+struct.unpack_from("<I", data, off)[0]
    if tc in "fidbl": return 12+struct.unpack_from("<III", data, off)[2]
    return 0
def propval(tc, off):
    if tc in "Y": return struct.unpack_from("<h", data, off)[0]
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
    eo,np_,pl=struct.unpack_from("<III", data, off); off+=12
    nl=data[off]; off+=1; nm=data[off:off+nl]; off+=nl
    n=N(); n.name=nm; n.end=eo; n.start=base
    for _ in range(np_):
        tc=chr(data[off]); off+=1
        v=propval(tc, off); n.props.append((tc,v)); off+=psz(tc, off)
    while off<eo:
        pe=struct.unpack_from("<I", data, off)[0]
        if pe==0: break
        c=rn(off); n.ch.append(c); off=c.end
    return n
top=[]; off=HDR
while off<len(data):
    pe=struct.unpack_from("<I", data, off)[0]
    if pe==0: break
    n=rn(off); top.append(n); off=n.end

objs=[t for t in top if t.name==b'Objects'][0]
geoms=[c for c in objs.ch if c.name==b'Geometry']
print("GEOMETRIES:",len(geoms))
for gi,g in enumerate(geoms):
    # find Vertices array length
    vn=uvn=0
    for cc in g.ch:
        if cc.name==b'Vertices' and cc.props:
            raw=cc.props[0][1]
            try: raw=zlib.decompress(raw)
            except: pass
            vn=len(raw)//8
        if cc.name==b'PolygonVertexIndex' and cc.props:
            raw=cc.props[0][1]
            try: raw=zlib.decompress(raw)
            except: pass
            pn=len(raw)//4
        if cc.name==b'LayerElementUV':
            for cc2 in cc.ch:
                if cc2.name==b'UV' and cc2.props:
                    raw=cc2.props[0][1]
                    try: raw=zlib.decompress(raw)
                    except: pass
                    uvn=len(raw)//8
    print(f"  geom[{gi}] xyname={g.props} verts={vn} pvi~={pn if 'pn' in dir() else '?'} uv={uvn}")

videos=[c for c in objs.ch if c.name==b'Video']
print("VIDEOS:",len(videos))
for vi,v in enumerate(videos):
    sz=0
    for cc in v.ch:
        if cc.name==b'Content' and cc.props and cc.props[0][0]=="R":
            raw=cc.props[0][1]
            if raw[:8]==b"\x89PNG\r\n\x1a\n":
                sz=len(raw)
    print(f"  video[{vi}] name={v.props} png={sz}")
