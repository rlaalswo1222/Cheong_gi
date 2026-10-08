"""
청춘기획 — 유튜브 최신 영상 썸네일 갱신 스크립트

  python update-thumbnails.py            # 최근 30개
  python update-thumbnails.py 12         # 최근 12개만

하는 일
  1. 채널의 영상 목록 페이지에서 최근 영상 ID와 제목을 읽어옵니다.
  2. 썸네일(maxresdefault, 없으면 hqdefault)을 받아 1120x630으로 저장합니다.
     -> assets/img/hero-01.jpg ... hero-NN.jpg  (이전 hero-*.jpg 는 정리)
  3. script.js 의 HERO_IMAGES 목록을 새 파일/제목으로 다시 씁니다.

필요 패키지: pillow  (pip install pillow)
"""

import io
import json
import os
import re
import sys
import urllib.request

CHANNEL = "https://www.youtube.com/@cheong-gi3039/videos"
HERE = os.path.dirname(os.path.abspath(__file__))
IMG_DIR = os.path.join(HERE, "assets", "img")
SCRIPT = os.path.join(HERE, "script.js")
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36"
SIZE = (1120, 630)          # 16:9
LIMIT = int(sys.argv[1]) if len(sys.argv) > 1 else 30


def get(url, timeout=30):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "ko,en"})
    return urllib.request.urlopen(req, timeout=timeout).read()


def json_after(text, marker):
    """marker 뒤에 오는 첫 JSON 객체를 중괄호 짝을 세어 잘라낸다."""
    i = text.find(marker)
    if i < 0:
        return None
    i = text.find("{", i)
    depth, in_str, esc = 0, False, False
    for j in range(i, len(text)):
        ch = text[j]
        if in_str:
            if esc:
                esc = False
            elif ch == chr(92):      # backslash
                esc = True
            elif ch == '"':
                in_str = False
        else:
            if ch == '"':
                in_str = True
            elif ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    try:
                        return json.loads(text[i:j + 1])
                    except Exception:
                        return None
    return None


def collect_videos(html):
    """(videoId, title) 목록을 페이지 등장 순서(= 최신순)로 반환."""
    found, seen = [], set()
    data = json_after(html, "ytInitialData")

    def title_of(t):
        """유튜브가 쓰는 제목 표현 세 가지를 모두 처리."""
        if isinstance(t, str):
            return t
        if isinstance(t, dict):
            if "content" in t and isinstance(t["content"], str):
                return t["content"]                      # lockupViewModel (현재 구조)
            if "runs" in t:
                return "".join(r.get("text", "") for r in t["runs"])
            if "simpleText" in t:
                return t["simpleText"]
        return None

    def add(vid, title):
        if isinstance(vid, str) and len(vid) == 11 and vid not in seen and title:
            seen.add(vid)
            found.append((vid, title.strip()))

    def walk(node):
        if isinstance(node, dict):
            # 새 구조: lockupViewModel { contentId, metadata.lockupMetadataViewModel.title.content }
            lv = node.get("lockupViewModel")
            if isinstance(lv, dict):
                mv = (lv.get("metadata") or {}).get("lockupMetadataViewModel") or {}
                add(lv.get("contentId"), title_of(mv.get("title")))
            # 예전 구조: videoRenderer { videoId, title }
            add(node.get("videoId"), title_of(node.get("title")))
            for v in node.values():
                walk(v)
        elif isinstance(node, list):
            for v in node:
                walk(v)

    if data:
        walk(data)

    # ytInitialData 구조가 바뀐 경우: ID만이라도 순서대로 확보
    if not found:
        for m in re.finditer(r'"videoId":"([A-Za-z0-9_-]{11})"', html):
            vid = m.group(1)
            if vid not in seen:
                seen.add(vid)
                found.append((vid, ""))
    return found


def download_thumb(vid):
    for quality in ("maxresdefault", "hqdefault", "mqdefault"):
        try:
            data = get("https://i.ytimg.com/vi/%s/%s.jpg" % (vid, quality))
            if len(data) > 8000:
                return data
        except Exception:
            pass
    return None


def js_escape(s):
    return s.replace(chr(92), chr(92) * 2).replace("'", chr(92) + "'")


def main():
    from PIL import Image

    print("채널 읽는 중 ...", CHANNEL)
    html = get(CHANNEL).decode("utf-8", "ignore")
    videos = collect_videos(html)[:LIMIT]
    if not videos:
        print("영상을 찾지 못했습니다. 채널 주소를 확인해 주세요.")
        return 1
    print("영상 %d개 확인" % len(videos))

    os.makedirs(IMG_DIR, exist_ok=True)
    for f in os.listdir(IMG_DIR):
        if re.fullmatch(r"hero-\d+\.jpg", f):
            os.remove(os.path.join(IMG_DIR, f))

    entries = []
    for i, (vid, title) in enumerate(videos, 1):
        raw = download_thumb(vid)
        if not raw:
            print("  건너뜀 (썸네일 없음):", vid)
            continue
        name = "hero-%02d.jpg" % (len(entries) + 1)
        im = Image.open(io.BytesIO(raw)).convert("RGB").resize(SIZE, Image.LANCZOS)
        im.save(os.path.join(IMG_DIR, name), quality=84, optimize=True)
        entries.append((name, vid, title or ("라이브 %02d" % i)))
        print("  %s  %s" % (name, title[:40]))

    if not entries:
        print("받은 썸네일이 없습니다.")
        return 1

    # script.js 의 HERO_IMAGES 다시 쓰기
    src = io.open(SCRIPT, encoding="utf-8").read()
    start = src.index("  const HERO_IMAGES = [")
    end = src.index("];", start) + 3
    lines = [
        "    { file: '%s', seed: '%s', ar: 1.78, alt: '%s' }" % (name, vid, js_escape(title))
        for name, vid, title in entries
    ]
    block = ("  // 유튜브 채널(@cheong-gi3039) 최신 영상 썸네일 — 16:9\n"
             "  // update-thumbnails.py 가 이 목록을 자동으로 다시 씁니다.\n"
             "  const HERO_IMAGES = [\n" + ",\n".join(lines) + "\n  ];\n")
    io.open(SCRIPT, "w", encoding="utf-8").write(src[:start] + block + src[end:])

    print("\n완료: 썸네일 %d장, script.js 갱신" % len(entries))
    print("웹 주소(Artifact)에도 반영하려면 Claude Code 에서 다시 배포해 달라고 하세요.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
