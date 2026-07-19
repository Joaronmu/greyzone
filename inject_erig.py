import re
HTML = "C:/Users/零零/WorkBuddy/2026-07-06-17-11-58/stealth-game-3d.html"
B64 = "C:/Users/零零/WorkBuddy/2026-07-06-17-11-58/enemy_rig.b64"

b64 = open(B64, "r").read().strip()
html = open(HTML, "r", encoding="utf-8").read()

if 'id="erig"' in html:
    print("erig already present, replacing")
    html = re.sub(r'<script type="text/plain" id="erig">.*?</script>', '<script type="text/plain" id="erig">' + b64 + '</script>', html, count=1, flags=re.DOTALL)
else:
    # insert after the cmodel script block's closing </script>
    m = re.search(r'(<script type="text/plain" id="cmodel">.*?</script>)', html, flags=re.DOTALL)
    if not m:
        raise SystemExit("cmodel block not found")
    ins = m.group(1) + '\n<script type="text/plain" id="erig">' + b64 + '</script>'
    html = html[:m.start()] + ins + html[m.end():]

open(HTML, "w", encoding="utf-8").write(html)
print("injected erig, new size:", len(html))
