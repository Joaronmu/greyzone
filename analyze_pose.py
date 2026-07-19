import struct, zlib
import numpy as np
PATH="C:/Users/零零/Downloads/Firing Rifle.fbx"
data=open(PATH,"rb").read()
version=struct.unpack_from("<I",data,23)[0]; USE64=version>=7500; HDR=27
def u(off,n=4): return struct.unpack_from("<Q",data,off)[0] if n==8 else struct.unpack_from("<I",data,off)[0]
class N:
    __slots__=("ch","props","name","end")
    def __init__(s): s.ch=[];s.props=[];s.name=b"";s.end=0
def psz(tc,off):
    if tc=="Y":return 2
    if tc=="C":return 1
    if tc in "IF":return 4
    if tc in "DL":return 8
    if tc in "RS":return 4+u(off)
    if tc in "fidbl":return 12+struct.unpack_from("<III",data,off)[2]
    return 0
def propval(tc,off):
    if tc=="Y":return struct.unpack_from("<h",data,off)[0]
    if tc=="C":return data[off]!=0
    if tc=="I":return struct.unpack_from("<i",data,off)[0]
    if tc=="F":return struct.unpack_from("<f",data,off)[0]
    if tc=="D":return struct.unpack_from("<d",data,off)[0]
    if tc=="L":return struct.unpack_from("<q",data,off)[0]
    if tc in "RS":
        ln=u(off);return data[off+4:off+4+ln]
    if tc in "fidbl":
        a,e,c=struct.unpack_from("<III",data,off);return data[off+12:off+12+c]
    return None
def rn(off):
    if USE64: eo,np_,pl=struct.unpack_from("<QQQ",data,off);off+=24
    else: eo,np_,pl=struct.unpack_from("<III",data,off);off+=12
    nl=data[off];off+=1;nm=data[off:off+nl];off+=nl
    n=N();n.name=nm;n.end=eo
    for _ in range(np_):
        tc=chr(data[off]);off+=1;v=propval(tc,off);n.props.append((tc,v));off+=psz(tc,off)
    while off<eo:
        pe=u(off,8 if USE64 else 4)
        if pe==0:break
        c=rn(off);n.ch.append(c);off=c.end
    return n
top=[];off=HDR
while off<len(data):
    pe=u(off,8 if USE64 else 4)
    if pe==0:break
    n=rn(off);top.append(n);off=n.end
objs=next(t for t in top if t.name==b"Objects")
conns_node=next((t for t in top if t.name==b"Connections"),None)
def prop_str(p):
    if not p or p[0] not in ("S",):return None
    s=p[1].decode("utf-8","replace")
    if "\x00" in s:s=s.split("\x00",1)[0]
    return s
def prop_int(p):
    if not p:return None
    if p[0] in ("L","I"):return p[1]
    return None
obj_by_id={};models=[]
for c in objs.ch:
    if c.name==b"Model":
        oid=prop_int(c.props[0]);nm=prop_str(c.props[1]);typ=prop_str(c.props[2])
        obj_by_id[oid]=("Model",nm,typ,c);models.append((oid,nm,typ,c))
    elif c.name==b"Deformer":
        oid=prop_int(c.props[0]);typ=prop_str(c.props[2]) if len(c.props)>=3 else None
        obj_by_id[oid]=("Deformer",None,typ,c)
conns=[]
for c in conns_node.ch:
    if c.name!=b"C":continue
    conns.append((prop_str(c.props[0]),prop_int(c.props[1]),prop_int(c.props[2])))
bones={};bone_order=[]
for oid,nm,typ,node in models:
    if typ=="LimbNode":
        bones[oid]={"name":nm};bone_order.append(oid)
id2idx={b:i for i,b in enumerate(bone_order)}
cl_to_bone={}
for ct,src,dst in conns:
    if ct!="OO":continue
    if src in obj_by_id and obj_by_id[src][0]=="Deformer" and obj_by_id[src][2]=="Cluster" and dst in id2idx:
        cl_to_bone[src]=dst
    elif dst in obj_by_id and obj_by_id[dst][0]=="Deformer" and obj_by_id[dst][2]=="Cluster" and src in id2idx:
        cl_to_bone[dst]=src
def arr(node,key):
    for cc in node.ch:
        if cc.name==key and cc.props:
            raw=cc.props[0][1]
            try:raw=zlib.decompress(raw)
            except:pass
            return np.frombuffer(raw,dtype='<f8')
    return None
world={}
for clid,bid in cl_to_bone.items():
    tl=arr(obj_by_id[clid][3],b"TransformLink")
    if tl is not None:
        M=np.array(tl[:16]).reshape(4,4).T
        world[bid]=M[0:3,3]
print("name -> world(x,y,z)  [meters]")
for bid in bone_order:
    nm=bones[bid]["name"]
    if bid in world and any(k in nm for k in ("Hips","Shoulder","Arm","Hand","Spine2","Head")):
        w=world[bid]
        print(f"  {nm:28s} x={w[0]:+.3f} y={w[1]:+.3f} z={w[2]:+.3f}")
