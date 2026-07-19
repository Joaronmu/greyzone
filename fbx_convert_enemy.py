import struct, zlib, array, io, sys, base64
import numpy as np
from PIL import Image

FBX = "model.fbx"
data = open(FBX, "rb").read()
version = struct.unpack_from("<I", data, 23)[0]
USE64 = version >= 7500; HDR = 27

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
geom=[c for c in objs.ch if c.name==b'Geometry'][0]
def find_arr(node, name):
    for cc in node.ch:
        if cc.name==name and cc.props:
            p=cc.props[0]
            if p[0] in "fidbl":
                raw=p[1]
                try: return zlib.decompress(raw)
                except Exception: return raw
    return None
v_bytes=find_arr(geom, b'Vertices'); p_bytes=find_arr(geom, b'PolygonVertexIndex')
uv_node=[cc for cc in geom.ch if cc.name==b'LayerElementUV'][0]
uv_bytes=find_arr(uv_node, b'UV'); uvi_bytes=find_arr(uv_node, b'UVIndex')

verts=np.frombuffer(v_bytes, dtype=np.float64).reshape(-1,3)
pvi=np.frombuffer(p_bytes, dtype=np.int32)
uv=np.frombuffer(uv_bytes, dtype=np.float64).reshape(-1,2)
uvindex=np.frombuffer(uvi_bytes, dtype=np.int32)
N=len(verts)
print("verts",N,"pvi",len(pvi),"uv",len(uv))

# triangulate: build tri_vi (M,3) and tri_pvipos (M,3)
poly_vi=[]; poly_pos=[]
tri_vi=[]; tri_pos=[]
for i,x in enumerate(pvi):
    if x<0:
        poly_vi.append(~x); poly_pos.append(i)
        k=len(poly_vi)
        if k>=3:
            for j in range(1,k-1):
                tri_vi.append((poly_vi[0],poly_vi[j],poly_vi[j+1]))
                tri_pos.append((poly_pos[0],poly_pos[j],poly_pos[j+1]))
        poly_vi=[]; poly_pos=[]
    else:
        poly_vi.append(x); poly_pos.append(i)
tri_vi=np.array(tri_vi, dtype=np.int64)
tri_pos=np.array(tri_pos, dtype=np.int64)
M=len(tri_vi)
print("triangles",M)

# per-vertex avg incident edge length
a=tri_vi[:,0]; b=tri_vi[:,1]; c=tri_vi[:,2]
def acc_edges(p,q):
    L=np.sqrt(((verts[p]-verts[q])**2).sum(axis=1))
    return L
e1=acc_edges(a,b); e2=acc_edges(b,c); e3=acc_edges(c,a)
sumL=np.zeros(N); cnt=np.zeros(N, np.int64)
for (p,q,L) in [(a,b,e1),(b,c,e2),(c,a,e3)]:
    np.add.at(sumL,p,L); np.add.at(cnt,p,1)
    np.add.at(sumL,q,L); np.add.at(cnt,q,1)
avgL=sumL/np.maximum(cnt,1)

minx,miny,minz=verts.min(axis=0)
maxx,maxy,maxz=verts.max(axis=0)
h=maxy-miny
TARGET_H=45.0; scale=TARGET_H/h
print("bbox h",h,"scale",scale,"avgL range",avgL.min(),avgL.max(),"median",np.median(avgL))

# adaptive params
R_FINE=float(sys.argv[1]) if len(sys.argv)>1 else 0.012
CELL_FINE=float(sys.argv[2]) if len(sys.argv)>2 else 0.004
CELL_COARSE=float(sys.argv[3]) if len(sys.argv)>3 else 0.012
# adaptive: upper body (arms/hands visible in FP viewmodel) -> fine; lower legs -> coarse
isFine = verts[:,1] > (miny + 0.30*h)
print("fine verts",isFine.sum(),"coarse verts",(~isFine).sum(),"(height-adaptive: upper %.0f%% fine)"%(100*0.70))

# cluster key: tag fine with big offset so they don't collide with coarse
OFF=1<<20  # offset to make coords positive
def keys_for(mask, cell):
    kx=np.floor((verts[mask,0]-minx)/cell).astype(np.int64)+OFF
    ky=np.floor((verts[mask,1]-miny)/cell).astype(np.int64)+OFF
    kz=np.floor((verts[mask,2]-minz)/cell).astype(np.int64)+OFF
    B=(1<<21)
    return ((kx*B+ky)*B+kz)
allidx=np.arange(N)
cid=np.zeros(N, dtype=np.int64)
# coarse
mc=~isFine
if mc.any():
    kk=keys_for(mc, CELL_COARSE)
    uu,inv=np.unique(kk, return_inverse=True)
    cid[mc]=inv
base=len(uu) if mc.any() else 0
# fine
mf=isFine
if mf.any():
    kk=keys_for(mf, CELL_FINE)
    # tag to avoid collision with coarse: add (1<<62)
    kk=kk+(1<<62)
    uu,inv=np.unique(kk, return_inverse=True)
    cid[mf]=inv+base
C=int(cid.max()+1)
print("clusters",C)

# representative position = mean per cluster
sumpos=np.zeros((C,3)); ccount=np.zeros(C,np.int64)
np.add.at(sumpos,cid,verts); np.add.at(ccount,cid,1)
rep=sumpos/np.maximum(ccount,1)[:,None]
# normalize: feet at 0, height 45, center xz
rep[:,0]=(rep[:,0]-minx)*scale
rep[:,1]=(rep[:,1]-miny)*scale
rep[:,2]=(rep[:,2]-(minz+maxz)/2.0)*scale

# remap triangles, drop degenerate
ca=cid[a]; cb=cid[b]; cc=cid[c]
keep=(ca!=cb)&(cb!=cc)&(ca!=cc)
ntri=int(keep.sum())
print("kept triangles",ntri, "of",M)
TA=ca[keep]; TB=cb[keep]; TC=cc[keep]
# also need tri_pos for uv lookup, filtered
tpa=tri_pos[:,0][keep]; tpb=tri_pos[:,1][keep]; tpc=tri_pos[:,2][keep]

# uv per corner = uv[uvindex[pvipos]]
ua=uv[uvindex[tpa]]; ub=uv[uvindex[tpb]]; uc=uv[uvindex[tpc]]
# accumulate uv per cluster (by corner's vertex cluster id)
sumuv=np.zeros((C,2)); cuv=np.zeros(C,np.int64)
for (ids,uvals) in [(TA,ua),(TB,ub),(TC,uc)]:
    np.add.at(sumuv,ids,uvals); np.add.at(cuv,ids,1)
repuv=sumuv/np.maximum(cuv,1)[:,None]

# recompute normals
nrm=np.zeros((C,3))
def face_normals(P,A,B,CCc):
    u=P[B]-P[A]; v=P[CCc]-P[A]
    n=np.cross(u,v)
    l=np.linalg.norm(n,axis=1,keepdims=True); l[l==0]=1
    return n/l
fn=face_normals(rep,TA,TB,TC)
np.add.at(nrm,TA,fn); np.add.at(nrm,TB,fn); np.add.at(nrm,TC,fn)
l=np.linalg.norm(nrm,axis=1,keepdims=True); l[l==0]=1
nrm=nrm/l

# indices
idx=np.stack([TA,TB,TC],axis=1).astype(np.uint32)

# diffuse texture (largest PNG) -> 512
videos=[c for c in objs.ch if c.name==b'Video']
best=None
for v in videos:
    for cc in v.ch:
        if cc.name==b'Content' and cc.props and cc.props[0][0]=="R":
            raw=cc.props[0][1]
            if raw[:8]==b"\x89PNG\r\n\x1a\n" and (best is None or len(raw)>len(best)):
                best=raw
im=Image.open(io.BytesIO(best)).convert("RGBA").resize((512,512), Image.LANCZOS)
buf=io.BytesIO(); im.save(buf, format="PNG", optimize=True); tex_png=buf.getvalue()
print("tex png",len(tex_png))

# pack PM3D
posf=rep.astype(np.float32).tobytes()
nrmf=nrm.astype(np.float32).tobytes()
uvf=repuv.astype(np.float32).tobytes()
idf=idx.tobytes()
header=b'PM3D'+struct.pack('<III', C, ntri, len(tex_png))
blob=header+posf+nrmf+uvf+idf+tex_png
open("enemy_model.bin","wb").write(blob)
b64=base64.b64encode(blob).decode('ascii')
open("enemy_model.b64","w").write(b64)
print("blob %d (%.1f KB)  b64 %d (%.1f KB)"%(len(blob),len(blob)/1024,len(b64),len(b64)/1024))
print("DONE C=%d ntri=%d fine=%d"%(C,ntri,int(isFine.sum())))
