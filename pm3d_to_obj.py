import struct, sys, os, zlib
import numpy as np

# PM3D: magic(4) + nclu,ntri,texlen(u32) + pos(f32*3*nclu) + nrm(f32*3*nclu) + uv(f32*2*nclu) + idx(u32*3*ntri) + PNG
def load_pm3d(path):
    b = open(path, "rb").read()
    assert b[:4] == b"PM3D", "not PM3D"
    nclu, ntri, texlen = struct.unpack_from("<III", b, 4)
    o = 16
    pos = np.frombuffer(b, dtype="<f4", count=nclu*3, offset=o).reshape(nclu,3).copy(); o += nclu*12
    nrm = np.frombuffer(b, dtype="<f4", count=nclu*3, offset=o).reshape(nclu,3).copy(); o += nclu*12
    uv  = np.frombuffer(b, dtype="<f4", count=nclu*2, offset=o).reshape(nclu,2).copy(); o += nclu*8
    idx = np.frombuffer(b, dtype="<u4", count=ntri*3, offset=o).reshape(ntri,3).copy(); o += ntri*12
    return pos, nrm, uv, idx

def decimate(pos, uv, nrm, idx, target_tris):
    """Vertex clustering: merge verts whose quantized cell matches. Binary-search cell size to hit target."""
    # bbox on pos
    mn = pos.min(0); mx = pos.max(0); size = mx - mn
    H = size[1]
    def run(cell):
        keys = np.floor(pos / cell).astype(np.int64)
        # unique keys
        kk = keys[:,0]*73856093 ^ keys[:,1]*19349663 ^ keys[:,2]*83492791
        uniq, inv = np.unique(kk, return_inverse=True)
        nnew = len(uniq)
        # aggregate
        npos = np.zeros((nnew,3),dtype=np.float64); nuv=np.zeros((nnew,2),dtype=np.float64); nnrm=np.zeros((nnew,3),dtype=np.float64); cnt=np.zeros(nnew,dtype=np.int64)
        np.add.at(npos, inv, pos); np.add.at(nuv, inv, uv); np.add.at(nnrm, inv, nrm); np.add.at(cnt, inv, 1)
        npos/=cnt[:,None]; nuv/=cnt[:,None]; nnrm/=cnt[:,None]
        nidx = inv[idx]
        # drop degenerate
        good = ~((nidx[:,0]==nidx[:,1])|(nidx[:,1]==nidx[:,2])|(nidx[:,0]==nidx[:,2]))
        nidx2 = nidx[good]
        return npos,nuv,nnrm,nidx2,len(nidx2)
    # binary search cell in meters-ish (pos units). H is height in native units.
    lo, hi = H/4000.0, H/4.0
    best=None
    for _ in range(28):
        mid=(lo+hi)/2
        res=run(mid)
        nt=res[4]
        if abs(nt-target_tris) < target_tris*0.08:
            best=res; break
        if nt>target_tris: lo=mid  # too many -> bigger cell
        else: hi=mid
    if best is None: best=run((lo+hi)/2)
    return best

def main():
    inp = sys.argv[1]
    out = sys.argv[2]
    target = int(sys.argv[3]) if len(sys.argv)>3 else 60000
    pos,nrm,uv,idx = load_pm3d(inp)
    print(f"{os.path.basename(inp)}: {len(pos)} verts, {len(idx)} tris -> target {target}")
    npos,nuv,nnrm,nidx,nt = decimate(pos,uv,nrm,idx,target)
    print(f"  decimated: {len(npos)} verts, {nt} tris")
    # normalize: center xz, feet y=0, scale height to 1.8m
    mn=npos.min(0); mx=npos.max(0); H=mx[1]-mn[1]
    npos[:,0] -= (mn[0]+mx[0])/2
    npos[:,2] -= (mn[2]+mx[2])/2
    npos[:,1] -= mn[1]
    s = 1.8/H
    npos *= s
    # write OBJ
    with open(out,"w") as f:
        f.write(f"# {os.path.basename(inp)} decimated to {nt} tris, height 1.8m, centered\n")
        for p in npos:
            f.write(f"v {p[0]:.5f} {p[1]:.5f} {p[2]:.5f}\n")
        for t in nuv:
            f.write(f"vt {t[0]:.5f} {t[1]:.5f}\n")
        for n in nnrm:
            f.write(f"vn {n[0]:.4f} {n[1]:.4f} {n[2]:.4f}\n")
        for tri in nidx:
            a,b,c = tri[0]+1,tri[1]+1,tri[2]+1
            f.write(f"f {a}/{a}/{a} {b}/{b}/{b} {c}/{c}/{c}\n")
    print(f"  wrote {out}  ({os.path.getsize(out)} bytes)")

if __name__=="__main__":
    main()
