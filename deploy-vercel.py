"""
청춘기획 — Vercel 배포 스크립트

  python deploy-vercel.py <토큰파일경로>
  python deploy-vercel.py            # 환경변수 VERCEL_TOKEN 사용

Vercel CLI 대신 REST API 로 직접 올립니다.
(이 PC는 컴퓨터 이름이 한글이라 CLI 가 HTTP 헤더를 만들다 오류를 냅니다.)

토큰 만들기: https://vercel.com/account/tokens -> Create Token

올리는 파일: index.html, styles.css, script.js, assets/img/*
Vercel 에 이미 있는 파일(같은 내용)은 다시 올리지 않고, 바뀐 파일만 올립니다.
"""

import hashlib
import json
import os
import sys
import time
import urllib.error
import urllib.request

API = "https://api.vercel.com"
HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT = "cheonggi"
INCLUDE_ROOT = ("index.html", "styles.css", "script.js")
INCLUDE_DIR = os.path.join("assets", "img")
IMG_EXT = (".jpg", ".jpeg", ".png", ".webp", ".svg")


def read_token():
    if len(sys.argv) > 1:
        path = sys.argv[1]
        if not os.path.exists(path):
            sys.exit("토큰 파일을 찾을 수 없습니다: " + path)
        with open(path, "r", encoding="utf-8-sig") as f:
            return f.read().strip()
    tok = os.environ.get("VERCEL_TOKEN", "").strip()
    if not tok:
        sys.exit("토큰이 없습니다. 토큰 파일 경로를 인자로 주거나 VERCEL_TOKEN 을 설정하세요.")
    return tok


class ApiError(Exception):
    def __init__(self, code, body):
        super().__init__(code)
        self.code, self.body = code, body


def request(method, url, token, data=None, headers=None, raw=False, soft=False):
    h = {"Authorization": "Bearer " + token}
    if headers:
        h.update(headers)
    body = data
    if data is not None and not raw:
        body = json.dumps(data).encode("utf-8")
        h["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=body, headers=h, method=method)
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return json.loads(r.read().decode("utf-8") or "{}")
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "ignore")
        if soft:
            raise ApiError(e.code, detail)
        raise SystemExit("%s %s -> %s\n%s" % (method, url, e.code, detail[:600]))


def collect():
    files = []
    for name in INCLUDE_ROOT:
        p = os.path.join(HERE, name)
        if os.path.exists(p):
            files.append((name.replace(os.sep, "/"), p))
    d = os.path.join(HERE, INCLUDE_DIR)
    if os.path.isdir(d):
        for name in sorted(os.listdir(d)):
            if name.lower().endswith(IMG_EXT):
                files.append(("assets/img/" + name, os.path.join(d, name)))
    return files


def team_query(token):
    """팀 전용 토큰이면 요청마다 teamId 가 필요합니다. 계정의 기본 팀을 씁니다."""
    team = os.environ.get("VERCEL_TEAM_ID", "").strip()
    if not team:
        team = (request("GET", API + "/v2/user", token).get("user") or {}).get("defaultTeamId") or ""
    return ("teamId=" + team) if team else ""


def main():
    token = read_token()
    tq = team_query(token)
    q = ("?" + tq) if tq else ""
    files = collect()
    if not files:
        sys.exit("올릴 파일이 없습니다.")
    total = sum(os.path.getsize(p) for _, p in files)
    print("파일 %d개 / %.1f MB" % (len(files), total / 1048576))

    manifest, by_sha = [], {}
    for rel, path in files:
        raw = open(path, "rb").read()
        sha = hashlib.sha1(raw).hexdigest()
        manifest.append({"file": rel, "sha": sha, "size": len(raw)})
        by_sha[sha] = (rel, raw)   # 읽은 내용을 그대로 기억 — 배포 중에 파일이 바뀌어도 어긋나지 않게

    def upload(shas):
        for i, sha in enumerate(shas, 1):
            rel, raw = by_sha[sha]
            request("POST", API + "/v2/files" + q, token, data=raw, raw=True, headers={
                "Content-Type": "application/octet-stream",
                "Content-Length": str(len(raw)),
                "x-vercel-digest": sha,
            })
            print("  [%2d/%d] %s" % (i, len(shas), rel))

    body = {
        "name": PROJECT,
        "files": manifest,
        "target": "production",
        "projectSettings": {
            "framework": None,
            "buildCommand": None,
            "installCommand": None,
            "outputDirectory": None,
        },
    }
    dep_url = API + "/v13/deployments?forceNew=1" + ("&" + tq if tq else "")
    # 먼저 파일 없이 배포를 만들어 보고, Vercel 이 없다고 알려 준 파일만 올린 뒤 다시 만듭니다
    for attempt in range(3):
        print("배포 생성 중 ...")
        try:
            res = request("POST", dep_url, token, data=body, soft=True)
            break
        except ApiError as e:
            try:
                err = json.loads(e.body).get("error") or {}
            except ValueError:
                err = {}
            missing = err.get("missing") or []
            if e.code != 400 or err.get("code") != "missing_files" or not missing:
                raise SystemExit("배포 실패 %s\n%s" % (e.code, e.body[:600]))
            print("바뀐 파일 %d개 업로드" % len(missing))
            upload([s for s in missing if s in by_sha])
    else:
        raise SystemExit("업로드 후에도 빠진 파일이 있다고 합니다.")

    dep_id = res.get("id")
    url = res.get("url")
    print("배포 ID:", dep_id)
    print("임시 주소: https://%s" % url)

    for _ in range(90):
        st = request("GET", API + "/v13/deployments/" + dep_id + q, token)
        state = st.get("readyState") or st.get("status")
        if state in ("READY", "ERROR", "CANCELED"):
            print("상태:", state)
            if state == "READY":
                alias = st.get("alias") or []
                print("\n완료")
                print("  https://%s" % url)
                for a in alias:
                    print("  https://%s" % a)
            return 0 if state == "READY" else 1
        time.sleep(2)
    print("시간 초과 — Vercel 대시보드에서 상태를 확인하세요.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
