import urllib.request, json, base64, os, time

BASE = "https://api.github.com/repos/wangjialiang678/3d-game-kit/git/blobs/"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"

# (sha, relative path)
FILES = [
    ("b9f3ee723ad6e517b3310d7296fe6736e7c65e18", "package.json"),
    ("24dc372bbe9e6ace24de2ee479d8e320e16ac86e", "src/Component.ts"),
    ("9dbd5ae0281df956f85c16925d4acbf3cb0c2c29", "src/Entity.ts"),
    ("0997483fd9575f8b8360047b354514726a5824f6", "src/EntityManager.ts"),
    ("a7c7acf3ed14637efc6799c4eebd0fa25ad42ecc", "src/EventBus.ts"),
    ("117242d1202f2c521f34ffeb11b053acdeb65462", "src/FiniteStateMachine.ts"),
    ("5bce3e87083cc56258798a8b9638d542926c604f", "src/Input.ts"),
    ("67746b36d8482918fa2e73722698320a9005abb2", "src/Physics.ts"),
    ("a16b0bca946690d5de26d3174a56c2c226f81e8e", "src/index.ts"),
]

OUT = r"C:/Users/零零/WorkBuddy/2026-07-06-17-11-58/engine-core"
os.makedirs(os.path.join(OUT, "src"), exist_ok=True)

for sha, rel in FILES:
    url = BASE + sha
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/vnd.github+json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            data = json.loads(r.read().decode("utf-8"))
        content = base64.b64decode(data["content"])
        dest = os.path.join(OUT, rel)
        with open(dest, "wb") as f:
            f.write(content)
        print(f"OK  {rel:30s} {len(content):6d} bytes")
    except Exception as e:
        print(f"ERR {rel:30s} {e}")
    time.sleep(0.4)
print("DONE")
