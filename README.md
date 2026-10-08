# 청춘기획 / CHEONG-GI

detroit.paris 레퍼런스를 기반으로 만든 대학생 연합 밴드 동아리 소개 사이트.
공개 주소: https://cheonggi.vercel.app  (재배포: `python deploy-vercel.py <토큰파일>`)
**세로 스크롤 없음** — 화면 전환은 상단 네비게이션(로고 포함)으로만 합니다.

```
index.html              마크업 (화면 구조)
styles.css              스타일 (타이포/레이아웃/반응형)
script.js               히어로 스트립 + 콘텐츠 데이터 + 인터랙션
assets/img/             사진 폴더
update-thumbnails.py    유튜브 최신 썸네일 갱신
build-artifact.py       웹 배포용 단일 HTML 생성 -> dist/cheonggi.html
```

## 유튜브 썸네일 갱신

```
pip install pillow                # 최초 1회
python update-thumbnails.py       # 최근 30개
python update-thumbnails.py 12    # 최근 12개만
```

채널(@cheong-gi3039)에서 최신 영상 목록을 읽어 썸네일을 받고,
`assets/img/hero-01.jpg ...` 로 저장한 뒤 `script.js` 의 `HERO_IMAGES` 를 다시 씁니다.
영상 제목은 이미지 대체 텍스트(alt)로 들어갑니다.

매일 자동으로 돌리려면 (Windows 작업 스케줄러, 매일 오전 9시):

```
schtasks /create /tn "CheongGi thumbnails" /sc daily /st 09:00 /tr "python C:/Users/rlaal/Desktop/Cheong-gi/update-thumbnails.py"
```

단, 웹 주소(claude.ai Artifact)는 외부 이미지와 외부 요청이 차단되어 사진이 파일 안에
내장됩니다. 즉 **웹 버전은 자동으로 갱신되지 않습니다.** 갱신한 뒤
`python build-artifact.py` 로 다시 만들고 Claude Code 에 재배포를 요청하세요.

바로 보기: `index.html` 더블클릭 (별도 서버 필요 없음).

## 사진 넣기

`assets/img/` 안에 아래 이름으로 넣으면 즉시 반영됩니다.
파일이 없으면 임시 이미지(picsum.photos)가 대신 보입니다.

| 위치 | 파일명 | 권장 |
|---|---|---|
| 히어로 스트립 | `hero-01.jpg` ~ `hero-12.jpg` | 16:9 가로 (유튜브 썸네일 1120×630) |
| 팀 카드 | `member-01.jpg` ~ `member-04.jpg` | 3:4 세로 (보컬 / 기타·베이스 / 드럼·키보드 / 기획홍보) |
| 공연 카드 | `work-01.jpg` ~ `work-06.jpg` | 16:9 (공연 영상 썸네일) |
| 로고 | `logo.png` | 흰색 마크 + 투명 배경 (아래 설명 참고) |

`logo.png`는 흰색으로 칠해진 마크입니다. 네비게이션 바가 `mix-blend-mode: difference`로
동작하기 때문에, 흰 화면에서는 검정으로 어두운 화면에서는 흰색으로 자동 반전됩니다.
그냥 열어보면 보이지 않는 게 정상이며, 일반 용도의 검정 버전은 `logo-black.png`입니다.

현재 히어로 12장은 유튜브 채널 [@cheong-gi3039](https://www.youtube.com/@cheong-gi3039/videos)의
라이브 영상 썸네일을 받아 넣은 것입니다. 새 영상이 올라오면 같은 이름으로 덮어쓰면 됩니다
(`https://i.ytimg.com/vi/<영상ID>/maxresdefault.jpg`).

다른 비율의 사진을 쓸 때는 `script.js`의 `HERO_IMAGES`에서 각 항목의 `ar`(가로÷세로) 값을
같이 고쳐주세요. 지금은 유튜브 썸네일 비율인 `1.78`로 통일되어 있습니다.

## 텍스트 고치기

- 헤드라인 / 소개 문구 / 섹션 제목 → `index.html`
- 팀 카드, 공연 카드(유튜브 영상 ID `yt`), 활동 목록 → `script.js` 의 `MEMBERS`, `PROJECTS`, `NOTES` 배열
- 합주 일정·다음 공연·지원 링크·연락처 → `index.html` 의 JOIN US

학기마다 기수(26-2 등), 모집 조건, 다음 공연 일정을 갱신하세요.

## 히어로 스트립 애니메이션 조절

`script.js` 안의 값들:

| 값 | 뜻 | 기본 |
|---|---|---|
| `SPEED` | 휠 1px당 가로 이동량 | `1.15` |
| `EASE` | 감속 정도 (작을수록 더 미끄럽게) | `0.085` |
| `MIN_H` / `RANGE_H` | 왼쪽 최소 높이 / 오른쪽까지의 증가폭 | 스트립 높이의 `13%` / `79%` |
| `Math.pow(t, 0.8)` | 크기 증가 곡선 | `0.8` |

이미지는 끝에서 끝으로 순환(무한 루프)하므로 어느 방향으로 굴려도 끊기지 않습니다.

## 화면 구조

세로 스크롤이 없고, 각 화면이 한 장씩 전환됩니다.

| 화면 | 이동 방법 | 휠/터치 동작 |
|---|---|---|
| HOME | 로고 클릭 | 히어로 이미지가 좌우로 이동 |
| ABOUT / TEAMS / ACTIVITY / JOIN US | 상단 메뉴 | (화면보다 내용이 길 때만) 내부 이동 |
| SHOWS | 상단 메뉴 | 공연 카드가 좌우로 이동 (누르면 유튜브) |

주소창의 `#join` 같은 해시로 특정 화면을 바로 열 수 있습니다.
스크롤바는 전 화면에서 숨겨져 있습니다.
