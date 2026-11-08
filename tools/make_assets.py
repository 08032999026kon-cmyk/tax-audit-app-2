"""画像素材を作る：assets/src/ の元画像 → assets/ の背景・人物画像 と js/assets.js

使い方:  python3 tools/make_assets.py
  - bg_*.png/jpg      … 背景。最大1920px幅に整えて JPEG に
  - boss_*.png, mori.png … 人物。白い背景や「描かれた市松模様」を消して切り抜き、WebP に
  - 顔の位置を自動で探し、会話ウィンドウの顔アイコン用に js/assets.js へ書き出す
必要: pip install pillow numpy scipy
"""
import json, os, sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC, OUT = os.path.join(ROOT, "assets", "src"), os.path.join(ROOT, "assets")


def find(name):
    for ext in (".png", ".jpg", ".jpeg", ".webp"):
        p = os.path.join(SRC, name + ext)
        if os.path.exists(p):
            return p
    return None


def background(name):
    im = Image.open(find(name)).convert("RGB")
    w, h = im.size
    tw = min(1920, max(w, 1600))
    if tw != w:
        im = im.resize((tw, round(h * tw / w)), Image.LANCZOS)
        if tw > w * 1.4:
            im = im.filter(ImageFilter.UnsharpMask(radius=1.6, percent=70, threshold=2))
    if name == "bg_ext":
        im = repaint_signs(im)
    out = os.path.join(OUT, name + ".jpg")
    im.save(out, quality=84, optimize=True, progressive=True)
    return {"src": "assets/" + name + ".jpg", "w": im.size[0], "h": im.size[1]}


def cutout(im):
    a = np.asarray(im).astype(int)
    mx, mn = a.max(2), a.min(2)
    bgl = ((mx - mn) < 16) & (mn > 170)
    lab, n = ndimage.label(bgl)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(border))
    for i in range(1, n + 1):  # 腕と頭のすき間などに残った市松模様
        if i in border:
            continue
        m = lab == i
        if m.sum() < 60:
            continue
        v = mn[m]
        if (v < 215).mean() > 0.2 and (v > 240).mean() > 0.2:
            bg |= m
    bg = ndimage.binary_closing(bg, iterations=2) | bg
    fg = ~bg
    lab2, n2 = ndimage.label(fg)
    if n2 > 1:
        sizes = ndimage.sum(fg, lab2, range(1, n2 + 1))
        fg = lab2 == (1 + int(np.argmax(sizes)))
    fg = fg | (ndimage.binary_fill_holes(fg) & ~bg)
    fg = ndimage.binary_erosion(fg, iterations=1)
    return fg


def character(name):
    p = find(name)
    im = Image.open(p)
    if im.mode == "RGBA" and np.asarray(im)[..., 3].min() < 10:  # 本当に透明な画像はそのまま
        alpha = im.getchannel("A")
        rgb = im.convert("RGB")
    else:
        rgb = im.convert("RGB")
        alpha = Image.fromarray((cutout(rgb) * 255).astype("uint8")).filter(ImageFilter.GaussianBlur(0.8))
    out = rgb.copy()
    out.putalpha(alpha)
    out = out.crop(alpha.point(lambda v: 255 if v > 20 else 0).getbbox())
    w, h = out.size
    if h < 900:  # 小さい画像は2倍にして輪郭のガタつきを抑える
        k = 2
        out = out.resize((w * k, h * k), Image.LANCZOS).filter(ImageFilter.UnsharpMask(radius=1.2, percent=50, threshold=2))
    w, h = out.size
    # 顔の位置：上1/3の肌色の重心
    a = np.asarray(out).astype(int)
    r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    skin = (al > 200) & (r > 120) & (r > g + 15) & (g > b) & (r - b > 40)
    skin[int(h * 0.33):] = False
    ys, xs = np.nonzero(skin)
    if len(xs):
        cx, cy = float(np.median(xs)), float(np.median(ys))
        top = float(np.percentile(ys, 1))
        size = max(h * 0.30, (cy - top) * 2.6)
    else:
        cx, cy, size = w / 2, h * 0.17, w * 0.45
    fn = name + ".webp"
    out.save(os.path.join(OUT, fn), quality=88, method=6)
    return {"src": "assets/" + fn, "w": w, "h": h, "face": [round(cx / w, 4), round(cy / h, 4), round(size / w, 4)]}


FONT = "/usr/share/fonts/truetype/fonts-japanese-gothic.ttf"


def _font(size):
    from PIL import ImageFont
    for f in (FONT, "/usr/share/fonts/opentype/ipafont-gothic/ipag.ttf", "/usr/share/fonts/truetype/ipafont-gothic/ipag.ttf"):
        if os.path.exists(f):
            return ImageFont.truetype(f, size)
    raise SystemExit("日本語フォントが見つかりません（IPAゴシックを入れてください）")


def repaint_signs(im):
    """外観の絵の看板「カフェ臨場」「臨場 COFFEE」を「浜風珈琲」に描き直す。
    位置は今の bg_ext（Gemini 版）に合わせた割合。外観の絵を替えたら調整すること。"""
    from PIL import ImageDraw
    W, H = im.size
    rng = np.random.default_rng(3)

    def board(box, fill, edge, text, color, size, sub=None):
        x0, y0, x1, y1 = [round(v * (W if i % 2 == 0 else H)) for i, v in enumerate(box)]
        bw, bh = x1 - x0, y1 - y0
        tile = Image.new("RGB", (bw, bh), fill)
        a = np.asarray(tile).astype(float)
        a += rng.normal(0, 5, (bh, 1, 1)) + rng.normal(0, 3, (bh, bw, 1))  # 木目っぽいむら
        yy = np.linspace(-1, 1, bh)[:, None, None]
        a *= 1 - 0.18 * yy ** 2  # 上下を少し暗く
        tile = Image.fromarray(np.clip(a, 0, 255).astype("uint8"))
        d = ImageDraw.Draw(tile)
        d.rectangle([0, 0, bw - 1, bh - 1], outline=edge, width=max(2, bw // 90))
        f = _font(size)
        tw = d.textlength(text, font=f)
        ty = (bh - size) / 2 - (size * 0.18 if sub else 0) - size * 0.08
        d.text(((bw - tw) / 2 + 1, ty + 2), text, font=f, fill=tuple(max(0, c - 120) for c in fill))
        d.text(((bw - tw) / 2, ty), text, font=f, fill=color)
        if sub:
            fs = _font(max(8, size // 3))
            sw = d.textlength(sub, font=fs)
            d.text(((bw - sw) / 2, ty + size * 1.12), sub, font=fs, fill=color)
        mask = Image.new("L", (bw, bh), 0)
        ImageDraw.Draw(mask).rectangle([2, 2, bw - 3, bh - 3], fill=255)
        mask = mask.filter(ImageFilter.GaussianBlur(1.2))
        im.paste(tile, (x0, y0), mask)

    # 正面の木の看板
    board((0.512, 0.112, 0.690, 0.252), (104, 64, 30), (52, 30, 12), "浜風珈琲", (236, 214, 170), round(W * 0.034))
    # 左の袖看板（白い箱）
    board((0.373, 0.142, 0.430, 0.257), (226, 218, 196), (120, 110, 90), "浜風", (52, 36, 22), round(W * 0.019), "COFFEE")
    return im


def main():
    data = {"bg": {}, "ch": {}}
    for n in ("bg_ext", "bg_shop", "bg_office"):
        if find(n):
            data["bg"][n[3:]] = background(n)
    for n in ("boss_grin", "boss_smug", "boss_shock", "boss_panic", "boss_sad", "mori"):
        if find(n):
            data["ch"][n] = character(n)
    js = "/* tools/make_assets.py が自動で作るファイル。手で書き換えない */\nwindow.ASSETS = " + json.dumps(data, ensure_ascii=False, indent=1) + ";\n"
    open(os.path.join(ROOT, "js", "assets.js"), "w", encoding="utf-8").write(js)
    for k, v in {**data["bg"], **data["ch"]}.items():
        print(k, v["w"], "x", v["h"], os.path.getsize(os.path.join(ROOT, v["src"])) // 1024, "KB")


if __name__ == "__main__":
    main()
