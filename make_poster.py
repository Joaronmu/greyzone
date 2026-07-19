# -*- coding: utf-8 -*-
"""合成《潜行 3D》游戏海报：背景插画 + 中文标题 + 类型元素（自适应尺寸）"""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os

SRC = r"C:\Users\零零\WorkBuddy\2026-07-06-17-11-58\Cinematic_first_person_stealth_2026-07-10T10-20-28.png"
OUT = r"C:\Users\零零\WorkBuddy\2026-07-06-17-11-58\灰域_海报.png"

F_BOLD = r"C:\Windows\Fonts\msyhbd.ttc"
F_HEI  = r"C:\Windows\Fonts\simhei.ttf"
F_DENGB= r"C:\Windows\Fonts\Dengb.ttf"

im = Image.open(SRC).convert("RGBA")
# 放大到 2x 提升海报清晰度（背景图偏小）
im = im.resize((im.width * 2, im.height * 2), Image.LANCZOS)
# 轻微锐化补偿放大带来的柔化
im = im.filter(ImageFilter.UnsharpMask(radius=2, percent=80, threshold=3))
W, H = im.size
S = W / 1024.0   # 缩放因子（设计基于 1024 宽）
print("bg", W, H, "scale", round(S, 3))

def F(path, sz):
    return ImageFont.truetype(path, max(8, int(sz * S)))

red   = (255, 56, 56)
amber = (255, 210, 63)
white = (244, 247, 252)
grey  = (150, 160, 172)

# 1) 顶/底渐变压暗
dark = Image.new("RGBA", (W, H), (0, 0, 0, 0))
dd = ImageDraw.Draw(dark)
top_h = H * 0.42
for y in range(0, int(top_h)):
    a = int(205 * (1 - y / top_h) ** 1.6)
    dd.rectangle([0, y, W, y + 1], fill=(6, 9, 13, a))
bot_y0 = H * 0.66
for y in range(int(bot_y0), H):
    t = max(0.0, (y - bot_y0) / (H - bot_y0))
    a = int(220 * t ** 1.5)
    dd.rectangle([0, y, W, y + 1], fill=(6, 9, 13, a))
im = Image.alpha_composite(im, dark)
draw = ImageDraw.Draw(im)

# 2) 顶部红竖条 + STEALTH 3D
f_tag = ImageFont.truetype(F_DENGB, max(8, int(30 * S)))
tag_y = int(70 * S)
draw.rectangle([int(90 * S), tag_y - 2, int(110 * S), tag_y + int(30 * S)], fill=red)
draw.text((int(128 * S), tag_y - int(4 * S)), "G R E Y   Z O N E", font=f_tag, fill=grey)

# 3) 主标题：灰域
f_title = F(F_BOLD, 300)
title_text = "灰域"
tb = draw.textbbox((0, 0), title_text, font=f_title)
tw, th = tb[2] - tb[0], tb[3] - tb[1]
tx = (W - tw) // 2 - tb[0]
ty = int(H * 0.12)

# 红色外发光
glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
gd = ImageDraw.Draw(glow)
gd.text((tx, ty), title_text, font=f_title, fill=(255, 40, 40, 95))
glow = glow.filter(ImageFilter.GaussianBlur(int(22 * S)))
im = Image.alpha_composite(im, glow)
draw = ImageDraw.Draw(im)
# 投影
draw.text((tx + int(6 * S), ty + int(8 * S)), title_text, font=f_title, fill=(0, 0, 0, 215))
# 主体
draw.text((tx, ty), title_text, font=f_title, fill=white)
# 标题下短红线
draw.rectangle([tx + int(8 * S), ty + th + int(26 * S),
                tx + int(8 * S) + int(170 * S), ty + th + int(32 * S)], fill=red)

# 4) 副文案
f_sub = F(F_BOLD, 50)
sub = "在被发现之前，越过那片灰域"
sb = draw.textbbox((0, 0), sub, font=f_sub)
sw = sb[2] - sb[0]
sx = (W - sw) // 2 - sb[0]
sy = ty + th + int(66 * S)
draw.text((sx, sy), sub, font=f_sub, fill=amber)

# 5) 底部信息
f_sm = F(F_BOLD, 34)
f_xs = F(F_DENGB, 27)
base_y = int(H * 0.805)

lab = " 第一人称潜行行动 "
lb = draw.textbbox((0, 0), lab, font=f_sm)
lw = lb[2] - lb[0]
lx, ly = int(90 * S), base_y
draw.rounded_rectangle([lx, ly, lx + lw + int(24 * S), ly + int(52 * S)],
                       radius=max(4, int(8 * S)), fill=(214, 38, 38, 255))
draw.text((lx + int(12 * S), ly + int(6 * S)), lab, font=f_sm, fill=white)

ver = "v4.0"
vb = draw.textbbox((0, 0), ver, font=f_sm)
draw.text((W - int(90 * S) - (vb[2] - vb[0]), ly + int(4 * S)), ver, font=f_sm, fill=grey)

# 关卡行
lvls = "外围渗透  ·  办公楼潜入  ·  仓库行动  ·  实验室突破  ·  要塞终极"
lvb = draw.textbbox((0, 0), lvls, font=f_xs)
lvx = (W - (lvb[2] - lvb[0])) // 2 - lvb[0]
draw.text((lvx, ly + int(70 * S)), lvls, font=f_xs, fill=(200, 210, 222, 235))

# 玩法关键词
fkw = F(F_DENGB, 25)
kw = "蹲伏隐蔽   视野躲避   破解密码   突破密室   BOSS 战"
kb = draw.textbbox((0, 0), kw, font=fkw)
kx = (W - (kb[2] - kb[0])) // 2 - kb[0]
draw.text((kx, H - int(56 * S)), kw, font=fkw, fill=(140, 152, 168, 220))

# 6) 暗角
vig = Image.new("RGBA", (W, H), (0, 0, 0, 0))
vd = ImageDraw.Draw(vig)
cx, cy = W / 2, H / 2
maxr = (cx ** 2 + cy ** 2) ** 0.5
step = max(14, int(26 * S))
for i in range(0, int(maxr), step):
    r = i + step
    t = i / maxr
    a = int(175 * max(0, (t - 0.55)) ** 1.8)
    vd.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(0, 0, 0, a))
im = Image.alpha_composite(im, vig)

im.convert("RGB").save(OUT, "PNG", optimize=True)
print("saved:", OUT, os.path.getsize(OUT) // 1024, "KB")
