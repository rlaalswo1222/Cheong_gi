"""
청춘기획 — 웹 배포용 단일 HTML 만들기

  python build-artifact.py        ->  dist/cheonggi.html

index.html + styles.css + script.js 를 한 파일로 합치고,
assets/img 의 사진을 전부 파일 안에 base64 로 넣습니다.
claude.ai Artifact 는 외부 이미지 로딩이 막혀 있어서 이 과정이 필요합니다.
(구글 폰트만 예외적으로 허용되므로 링크 그대로 둡니다.)

필요 패키지: pillow  (pip install pillow)
"""

import base64
import io
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
IMG_DIR = os.path.join(HERE, "assets", "img")
OUT_DIR = os.path.join(HERE, "dist")
OUT = os.path.join(OUT_DIR, "cheonggi.html")
TITLE = "청춘기획 CHEONG-GI"
HERO_WIDTH = 900          # 내장 시 히어로 썸네일을 이 폭으로 줄여 용량을 아낍니다
JPEG_QUALITY = 78


def data_uri(path):
    """히어로 사진은 줄여서, 나머지는 원본 그대로 data URI 로."""
    name = os.path.basename(path)
    ext = os.path.splitext(name)[1].lower()
    if ext == ".png":
        return "data:image/png;base64," + base64.b64encode(open(path, "rb").read()).decode()
    raw = open(path, "rb").read()
    if name.startswith("hero-"):
        from PIL import Image
        im = Image.open(io.BytesIO(raw)).convert("RGB")
        if im.width > HERO_WIDTH:
            im = im.resize((HERO_WIDTH, round(im.height * HERO_WIDTH / im.width)), Image.LANCZOS)
        buf = io.BytesIO()
        im.save(buf, "JPEG", quality=JPEG_QUALITY, optimize=True)
        raw = buf.getvalue()
    return "data:image/jpeg;base64," + base64.b64encode(raw).decode()


def main():
    html = io.open(os.path.join(HERE, "index.html"), encoding="utf-8").read()
    css = io.open(os.path.join(HERE, "styles.css"), encoding="utf-8").read()
    js = io.open(os.path.join(HERE, "script.js"), encoding="utf-8").read()

    head = html.split("<head>", 1)[1].split("</head>", 1)[0]
    font_links = [l.strip() for l in head.splitlines() if "fonts.g" in l]

    body = html.split("<body>", 1)[1].split("</body>", 1)[0]
    body = body.replace('<script src="script.js"></script>', "").strip()

    # 마크업 안에 직접 들어 있는 사진(로고, ABOUT 사진 등)을 먼저 치환
    for name in sorted(set(re.findall(r'src="assets/img/([^"]+)"', body))):
        path = os.path.join(IMG_DIR, name)
        if os.path.exists(path):
            body = body.replace('src="assets/img/%s"' % name, 'src="%s"' % data_uri(path))

    # 나머지 사진은 파일명 -> data URI 표로 만들어 스크립트에 주입
    names = sorted(f for f in os.listdir(IMG_DIR)
                   if re.fullmatch(r"(hero|member|work|act|sl)-\d+\.jpg|(team|life)-\w+\.jpg", f))
    rows = ",\n    ".join("'%s':'%s'" % (n, data_uri(os.path.join(IMG_DIR, n))) for n in names)
    img_map = "  const IMG = {\n    " + rows + "\n  };\n"

    js = js.replace("""     이미지 소스
     assets/img/ 안에 같은 이름의 파일을 넣으면 그 사진이 쓰이고,
     파일이 없으면 자동으로 임시 이미지(picsum)로 대체됩니다.""",
                    "     이미지 소스 (파일에 직접 내장)")
    js = js.replace("  const ph = (seed, w, h) => `https://picsum.photos/seed/${seed}/${w}/${h}`;\n",
                    img_map)
    js = js.replace("""    img.addEventListener('error', () => {
      if (img.dataset.fallbackUsed) {
        step();
        return;
      }
      img.dataset.fallbackUsed = '1';
      img.src = ph(seed, w, h);
    });
""", "    img.addEventListener('error', step);" + chr(10))
    for a, b in [("`assets/img/${data.file}`", "IMG[data.file]"),
                 ("`assets/img/${m.file}`", "IMG[m.file]"),
                 ("`assets/img/${p.file}`", "IMG[p.file]"),
                 ("`assets/img/${n.file}`", "IMG[n.file]"),
                 ("`assets/img/${f}`", "IMG[f]"),
                 ("`${data.seed}-${r}`", "data.seed")]:
        js = js.replace(a, b)

    if "picsum" in js or "ph(seed" in js or "assets/img" in js or "assets/img" in body:
        print("경고: 외부 경로가 남아 있습니다. script.js 구조가 바뀌었는지 확인하세요.")
        return 1

    doc = "\n".join(["<title>%s</title>" % TITLE] + font_links +
                    ["<style>\n" + css + "\n</style>", body, "<script>\n" + js + "\n</script>"])
    os.makedirs(OUT_DIR, exist_ok=True)
    io.open(OUT, "w", encoding="utf-8").write(doc)
    print("완료: %s  (%.2f MB, 사진 %d장)" % (OUT, len(doc.encode()) / 1048576, len(names)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
