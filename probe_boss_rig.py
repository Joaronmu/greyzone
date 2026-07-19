import struct, zlib, sys
import numpy as np
PATH=sys.argv[1]
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
def pv(tc,off):
    if tc=="Y":return struct.unpack_from("<h",data,off)[0]
    if tc=="C":return data[off]!=0
    if tc=="I":return struct.unpack_from("<i",data,off)[0]
    if tc=="F":return struct.unpack_from("<f",data,off)[0]
    if tc=="D":return struct.unpack_from("<d",data,off)[0]
    if tc=="L":return struct.unpack_from("<q",data,off)[0]
    if tc in "RS": ln=u(off);return data[off+4:off+4+ln]
    if tc in "fidbl": a,e,c=struct.unpack_from("<III",data,off);return data[off+12:off+12+c]
    return None
def rn(off):
    if USE64: eo,np_,pl=struct.unpack_from("<QQQ",data,off);off+=24
    else: eo,np_,pl=struct.unpack_from("<III",data,off);off+=12
    nl=data[off];off+=1;nm=data[off:off+nl];off+=nl
    n=N();n.name=nm;n.end=eo
    for _ in range(np_):
        tc=chr(data[off]);off+=1;v=pv(tc,off);n.props.append((tc,v));off+=psz(tc,off)
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
def ps(p):
    if not p or p[0] not in("S",):return None
    s=p[1].decode("utf-8","replace")
    if "\x00" in s:s=s.split("\x00",1)[0]
    return s
order=[];nb_clusters=0
for c in objs.ch:
    if c.name==b"Model":
        nm=ps(c.props[1]);typ=ps(c.props[2])
        if typ=="LimbNode": order.append(nm)
    elif c.name==b"Deformer":
        typ=ps(c.props[2])
        if typ=="Cluster": nb_clusters+=1
mesh=None
for c in objs.ch:
    if c.name==b"Geometry":
        for cc in c.ch:
            if cc.name==b"Vertices" and cc.props:
                raw=cc.props[0][1]
                try:raw=zlib.decompress(raw)
                except:pass
                a=np.frombuffer(raw,dtype='<f8');a=a.reshape(-1,3)
                mesh=(a[:,0].min(),a[:,0].max(),a[:,1].min(),a[:,1].max(),a[:,2].min(),a[:,2].max())
        if mesh:break
print("file:",PATH.split('/')[-1])
print("bones:",len(order),"clusters:",nb_clusters)
print("mesh bbox x[%g,%g] y[%g,%g] z[%g,%g] height=%g"%(mesh[0],mesh[1],mesh[2],mesh[3],mesh[4],mesh[5],mesh[3]-mesh[2]))
for i,nm in enumerate(order): print("  ",i,nm)
