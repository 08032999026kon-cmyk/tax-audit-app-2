"""オフライン版（ファイル1つで動くHTML）を作る。
使い方: python3 tools/build_offline.py
できるもの: offline/臨場_ゲーム_オフライン版.html, offline/臨場_進行画面_オフライン版.html
"""
import base64, json, pathlib, re

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "offline"
OUT.mkdir(exist_ok=True)

def inline(html: str) -> str:
    def css(m):
        return "<style>\n" + (ROOT / m.group(1)).read_text(encoding="utf-8") + "\n</style>"
    def js(m):
        src = (ROOT / m.group(1)).read_text(encoding="utf-8").replace("</script", "<\\/script")
        if m.group(1) == "js/assets.js":  # 画像を data URI にして埋め込む
            def uri(mm):
                f = ROOT / mm.group(1)
                mime = {".jpg": "image/jpeg", ".webp": "image/webp", ".png": "image/png"}[f.suffix]
                return '"src": "data:%s;base64,%s"' % (mime, base64.b64encode(f.read_bytes()).decode())
            src = re.sub(r'"src": "(assets/[^"]+)"', uri, src)
        return "<script>\n" + src + "\n</script>"
    html = re.sub(r'<link rel="stylesheet" href="(css/[^"]+)">', css, html)
    html = re.sub(r'<script src="(js/[^"]+)"></script>', js, html)
    return html

for src, dst in [("index.html", "臨場_ゲーム_オフライン版.html"), ("host.html", "臨場_進行画面_オフライン版.html")]:
    html = inline((ROOT / src).read_text(encoding="utf-8"))
    (OUT / dst).write_text(html, encoding="utf-8")
    print(dst, len(html.encode("utf-8")) // 1024, "KB")
