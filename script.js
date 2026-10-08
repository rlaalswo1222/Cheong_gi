/* =========================================================
   청춘기획 / CHEONG-GI — interactions
   세로 스크롤 없음. 화면 전환은 상단 네비게이션으로만.
   ========================================================= */
(() => {
  'use strict';

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------------
     이미지 소스
     assets/img/ 안에 같은 이름의 파일을 넣으면 그 사진이 쓰이고,
     파일이 없으면 자동으로 임시 이미지(picsum)로 대체됩니다.
     --------------------------------------------------------- */
  const ph = (seed, w, h) => `https://picsum.photos/seed/${seed}/${w}/${h}`;

  // 로딩 화면 — 사진을 다 받으면 걷히고, 다 걷힌 뒤에 등장 애니메이션 시작
  const loaderEl = document.getElementById('loader');
  const LOADER_OUT = reduced ? 0 : 1100;   // styles.css .loader 의 대기 0.5s + 페이드 0.6s
  const startedAt = Date.now();
  let imgTotal = 0, imgDone = 0, finished = false;
  let revealStrip = () => {};
  let replayStrip = () => {};   // 홈으로 돌아왔을 때 첫 등장 효과를 다시
  let onReady = () => {};

  function step() {
    imgDone++;
    if (imgDone >= imgTotal) setTimeout(finish, Math.max(0, 850 - (Date.now() - startedAt)));
  }

  function finish() {
    if (finished) return;
    finished = true;
    if (loaderEl) loaderEl.classList.add('is-done');
    setTimeout(() => {
      document.body.classList.add('is-ready');
      revealStrip();
      onReady();
    }, LOADER_OUT);
  }
  setTimeout(finish, 7000);   // 이미지가 오래 걸려도 7초 뒤에는 화면을 띄웁니다

  // 사이트 사진은 WebP 로 — 파일 이름(.jpg)은 그대로 적고, 불러올 때만 .webp 로 바꿉니다
  const webp = (p) => p.replace(/\.jpg$/i, '.webp');

  function makeImg(src, seed, w, h, alt) {
    const img = document.createElement('img');
    img.alt = alt || '';
    img.decoding = 'async';
    imgTotal++;
    img.addEventListener('error', () => {
      if (img.dataset.jpg === 'now') { img.dataset.jpg = 'done'; return; }   // WebP → JPG 로 다시 시도 중 (index.html)
      if (img.dataset.fallbackUsed) {
        step();
        return;
      }
      img.dataset.fallbackUsed = '1';
      img.src = ph(seed, w, h);
    });
    img.addEventListener('load', () => {
      img.classList.add('is-loaded');
      // 디코딩까지 끝난 뒤에 진행률을 올립니다. 로딩 화면이 걷힐 때 모든 사진이 즉시 그려집니다.
      if (img.decode) img.decode().then(step, step);
      else step();
    });
    img.src = webp(src);
    return img;
  }

  // 홈 제목을 한 글자씩 나눕니다. 줄마다 0번째 글자부터 --i 가 매겨져 두 줄이 동시에 올라옵니다.
  document.querySelectorAll('.hero__title .line > span').forEach((line) => {
    const chars = Array.from(line.textContent.trim());
    line.setAttribute('aria-hidden', 'true');
    line.textContent = '';
    chars.forEach((c, i) => {
      const s = document.createElement('span');
      s.className = 'char';
      s.style.setProperty('--i', i);
      s.textContent = c === ' ' ? ' ' : c;
      line.appendChild(s);
    });
  });

  // 섹션 제목(TEAMS, SHOWS …)도 같은 방식으로 나눕니다. <br> 은 줄 바꿈으로 유지하고,
  // 글자 번호는 줄이 바뀌어도 이어서 매겨 위에서 아래로 차례차례 올라오게 합니다.
  // JOIN US 의 큰 단어(JOIN / THE / CHEONG / GI)는 단어마다 따로 나눠, 모두 동시에 올라오게 합니다 (detroit 와 같음)
  document.querySelectorAll('.section__title, .join__word').forEach((title) => {
    const lines = [[]];
    title.childNodes.forEach((node) => {
      if (node.nodeName === 'BR') lines.push([]);
      else lines[lines.length - 1].push(...Array.from(node.textContent.trim()));
    });
    title.setAttribute('aria-label', lines.map((l) => l.join('')).join(' '));
    title.removeAttribute('data-reveal');
    title.classList.add('split');
    title.textContent = '';
    let i = 0;
    lines.forEach((chars) => {
      const line = document.createElement('span');
      line.className = 'line';
      line.setAttribute('aria-hidden', 'true');
      chars.forEach((c) => {
        const s = document.createElement('span');
        s.className = 'char';
        s.style.setProperty('--i', i++);
        s.textContent = c === ' ' ? ' ' : c;
        line.appendChild(s);
      });
      title.appendChild(line);
    });
  });

  /* =========================================================
     1. HOME — 휠에 반응하는 이미지 스트립
     왼쪽으로 갈수록 작게, 오른쪽으로 갈수록 크게.
     휠을 내리면 왼쪽으로, 올리면 오른쪽으로 부드럽게 이동.
     ========================================================= */
  // 유튜브 채널(@cheong-gi3039) 라이브 영상 썸네일 — 16:9
  // 유튜브 채널(@cheong-gi3039) 최신 영상 썸네일 — 16:9
  // update-thumbnails.py 가 이 목록을 자동으로 다시 씁니다.
  // 유튜브 채널(@cheong-gi3039) 최신 영상 썸네일 — 16:9
  // update-thumbnails.py 가 이 목록을 자동으로 다시 씁니다.
  const HERO_IMAGES = [
    { file: 'hero-01.jpg', seed: 'jXmWD7HqPn8', ar: 1.78, alt: '청춘기획 2026-1 Official Trailer | CHEONGGI 2026-1 Official Trailer' },
    { file: 'hero-02.jpg', seed: 'O7Hj0wWQZJg', ar: 1.78, alt: '해초 - 한로로 | 청춘기획 정기공연 PLAY HARD' },
    { file: 'hero-03.jpg', seed: 'RF6A7pFCGAY', ar: 1.78, alt: '비 오는 거리에서 춤을 추자 - 김뜻돌 | 청춘기획 정기공연 PLAY HARD' },
    { file: 'hero-04.jpg', seed: 'B9K90DQUt8U', ar: 1.78, alt: 'Answer me - 브로큰발렌타인 | 청춘기획 정기공연 PLAY HARD' },
    { file: 'hero-05.jpg', seed: 'cxEXWMISSd4', ar: 1.78, alt: 'Highlight - 터치드 | 청춘기획 정기공연 PLAY HARD' },
    { file: 'hero-06.jpg', seed: 'uq-1ag-J9ZI', ar: 1.78, alt: 'Dive - Olivia Dean  | 청춘기획 정기공연 PLAY HARD' },
    { file: 'hero-07.jpg', seed: 'jhYCYn72NGk', ar: 1.78, alt: '왔다갔는교 - 비비 | 청춘기획 정기공연 PLAY HARD' },
    { file: 'hero-08.jpg', seed: 'L2V7yZGqCaQ', ar: 1.78, alt: '욕망주사기 - 리도어 | 청춘기획 정기공연 PLAY HARD' },
    { file: 'hero-09.jpg', seed: 'KqhyMXRyrvA', ar: 1.78, alt: '그대에게 (To You) - 무한궤도 | 청춘기획 여름 정기공연 SUMMER PAGE' },
    { file: 'hero-10.jpg', seed: 'zhbEqB2FJ04', ar: 1.78, alt: 'YB(윤도현밴드) - 나는 나비 | 청춘기획 여름 정기공연 SUMMER PAGE' },
    { file: 'hero-11.jpg', seed: 'GbzTiO8__0s', ar: 1.78, alt: '싸이(PSY) - 연예인 | 청춘기획 여름 정기공연 SUMMER PAGE' },
    { file: 'hero-12.jpg', seed: '1vcDnnYRxFc', ar: 1.78, alt: 'Céline Dion - My Heart Will Go On | 청춘기획 여름 정기공연 SUMMER PAGE' },
    { file: 'hero-13.jpg', seed: 'hozcvHHrNrI', ar: 1.78, alt: 'IU(아이유) _ Hey(있잖아) | 청춘기획 여름 정기공연 SUMMER PAGE' },
    { file: 'hero-14.jpg', seed: 'mwZ2lUw279U', ar: 1.78, alt: '하현상 (Ha Hyunsang) - 불꽃놀이 (Burning Sunset) | 청춘기획 여름 정기공연 SUMMER PAGE' },
    { file: 'hero-15.jpg', seed: '0A-fHnJRVOw', ar: 1.78, alt: '한로로 (HANRORO) - 금붕어 (Goldfish) | 청춘기획 여름 정기공연 SUMMER PAGE' },
    { file: 'hero-16.jpg', seed: 'MMou0vVRDfg', ar: 1.78, alt: '실리카겔 (Silica Gel) - Tik Tak Tok | 청춘기획 여름 정기공연 SUMMER PAGE' },
    { file: 'hero-17.jpg', seed: '3YRopAvawDY', ar: 1.78, alt: 'LUCY - 못 죽는 기사와 비단 요람 | 청춘기획 여름 정기공연 SUMMER PAGE' },
    { file: 'hero-18.jpg', seed: '89pjAk0l4Dg', ar: 1.78, alt: '쏜애플(THORNAPPLE) - 살아있는 너의 밤 (Night of the Living You) | 청춘기획 여름 정기공연 SUMMER PAGE' },
    { file: 'hero-19.jpg', seed: 'qGo8OatjHns', ar: 1.78, alt: '유다빈밴드(YdBB) _ LETTER | 청춘기획 여름 정기공연 SUMMER PAGE' },
    { file: 'hero-20.jpg', seed: 'bm037NMhibg', ar: 1.78, alt: '청춘기획 정기공연 vlog  📂🌿ㅣ밴드정기공연, 대학생밴드연합동아리, 여름콘서트, 뒷풀이...' },
    { file: 'hero-21.jpg', seed: 'dpEVtT5vPk8', ar: 1.78, alt: '청춘기획 기획홍보팀의 정기공연 준비 vlog  📂🌿ㅣ동대문종합상가, 비즈책갈피 만들기, 정기공연 MD준비' },
    { file: 'hero-22.jpg', seed: 'E_qSHdu27cA', ar: 1.78, alt: '청춘기획 2025 Summer Concert | 𝐒𝐔𝐌𝐌𝐄𝐑 𝐏𝐀𝐆𝐄 | Highlight Medley' },
    { file: 'hero-23.jpg', seed: 'dj4LT2fhoe0', ar: 1.78, alt: '청춘기획 靑春企劃 \'SUMMER PAGE\' CONCEPT FILM - 2025 SUMMER CONCERT' },
    { file: 'hero-24.jpg', seed: '4Qm5gt7do1Q', ar: 1.78, alt: '정준일(JOONIL JUNG), 권진아(Kwon Jin Ah) _ 우리 시작해도 괜찮을까요(Should we start?) | 청춘기획 Band Cover' },
    { file: 'hero-25.jpg', seed: 'M0H0ypFmC2M', ar: 1.78, alt: '권진아 Kwon Jinah - Fly away | 청춘기획 Band Cover' },
    { file: 'hero-26.jpg', seed: '_D6n254SG-g', ar: 1.78, alt: '브로큰 발렌타인(Broken Valentine) - 알루미늄 | 청춘기획 Band Cover' },
    { file: 'hero-27.jpg', seed: 'r1JUXV-Sqn4', ar: 1.78, alt: '터치드(TOUCHED) - 야경 | 청춘기획 Band Cover' },
    { file: 'hero-28.jpg', seed: '2NTAv3rNbOU', ar: 1.78, alt: '하현상 (Ha Hyunsang) - 불꽃놀이 (Burning Sunset) | 청춘기획 Band Cover' },
    { file: 'hero-29.jpg', seed: '6U5J9wHkjSU', ar: 1.78, alt: '유라(YOURA) - 깜빡(Feat.카더가든) | 청춘기획 Band Cover' },
    { file: 'hero-30.jpg', seed: 'TFI72On7610', ar: 1.78, alt: 'Study with 청춘기획 🎵 청기가 선정한 공부할 때 듣기 좋은 노래 모음.zip_' }
  ];

  const strip = document.getElementById('strip');
  let pushStrip = () => {};
  let holdStrip = () => {};   // 손가락이 닿아 있는 동안 자동 흐름 멈춤

  if (strip) {
    const REPEAT = HERO_IMAGES.length >= 18 ? 2 : 3;   // 무한 루프용 복제
    const SPEED = 1.15;    // 휠 1px 당 가로 이동량
    const EASE = 0.085;    // 감속(부드러움) — 작을수록 더 미끄럽게

    const items = [];
    for (let r = 0; r < REPEAT; r++) {
      HERO_IMAGES.forEach((data) => {   // HERO_IMAGES 는 최신 영상부터 (update-thumbnails.py)
        const el = document.createElement('div');
        el.className = 'strip__item';
        // 라벨(폰에서만 보임): 영상 제목에서 '|' 앞부분 — 보통 '곡명 - 아티스트'
        const cap = document.createElement('p');
        cap.className = 'strip__cap';
        cap.setAttribute('aria-hidden', 'true');
        cap.innerHTML = '<span></span>';
        cap.firstChild.textContent = data.alt.split('|')[0].trim();
        const ph = document.createElement('div');
        ph.className = 'strip__ph';
        ph.appendChild(makeImg(`assets/img/${data.file}`, `${data.seed}-${r}`, 1120, 630,
          `청춘기획 라이브 — ${data.alt}`));
        el.appendChild(cap);
        el.appendChild(ph);
        strip.appendChild(el);
        items.push({ el, ar: data.ar, w: 0, h: 0, x: 0 });
      });
    }

    let vw = innerWidth, stripH = innerHeight * 0.84;
    let MIN_H = 0, RANGE_H = 0, mobile = false;

    /* ---- 폰: detroit.paris 모바일처럼 같은 크기 카드 한 줄 -----------------
       세로 화면에서는 크기 변화(왼쪽 작게 → 오른쪽 크게)가 큰 빈 공간을 만들기 때문에,
       detroit 도 모바일에서는 크기 변화를 끄고 큰 카드 한 줄로 보여줍니다.
       카드는 정사각형(키 큰 폰에서는 약 5:7 까지), 위에는 '● 곡명 - 아티스트' 라벨. */
    const GAP = 14;
    const CAP_H = 30;         // 카드 위 라벨 높이 (styles.css .strip__cap)
    const CARD_MAX_W = 0.78;  // 카드 폭은 화면 폭의 78% 까지 — 다음 카드가 옆에 살짝 보이도록
    let rows = [];            // { h, w, y, speed, base, step, list:[item] }

    function buildRows() {
      let h = stripH - CAP_H;
      let w = Math.min(h, vw * CARD_MAX_W);       // 기본은 정사각형
      if (w / h < 0.72) h = w / 0.72;             // 키 큰 폰: 약 5:7 보다 길어지지 않게
      // 처음 화면에서 왼쪽에 반쯤 걸친 카드 다음, 첫 번째로 온전히 보이는 카드가 가장 최신 영상이 되도록
      const list = items.slice(-2).concat(items.slice(0, -2));
      const row = { h, w, y: 0, speed: 1, step: w + GAP, list };
      // 처음 화면: 왼쪽 카드는 일부만, 다음 카드는 크게 — 양 끝이 자연스럽게 잘리도록
      let best = 0, bestScore = Infinity;
      for (let f = 0; f < 1; f += 0.01) {
        const left = (row.step * (1 - f) - GAP) / w;           // 왼쪽 끝 카드가 보이는 비율
        const k = Math.ceil((vw + f * row.step) / row.step - 1);
        const right = (vw - (-f * row.step + k * row.step)) / w; // 오른쪽 끝 카드가 보이는 비율
        const score = Math.abs(left - 0.32) + Math.abs(right - 0.72) * 0.5;
        if (score < bestScore) { bestScore = score; best = f; }
      }
      row.base = -best * row.step;
      rows = [row];
    }

    function readViewport() {
      vw = innerWidth;
      mobile = vw <= 760;
      stripH = strip.clientHeight || innerHeight * 0.84;
      MIN_H = stripH * 0.15;
      RANGE_H = stripH * 0.55;
      if (mobile) buildRows();
    }

    // 화면상의 x 위치(중심)에 따른 높이 — 왼쪽 작게 → 오른쪽 크게 (PC)
    const heightAt = (centerX) => {
      const t = clamp(centerX / vw, 0, 1);
      return MIN_H + RANGE_H * Math.pow(t, 0.72);
    };

    // 왼쪽 모서리가 x 인 아이템의 크기 (폭이 크기에 영향을 주므로 2회 수렴)
    function sizeFromLeft(item, x) {
      let h = heightAt(x), w = h * item.ar;
      h = heightAt(x + w / 2); w = h * item.ar;
      return { w, h };
    }
    // 오른쪽 모서리가 r 인 아이템의 크기
    function sizeFromRight(item, r) {
      let h = heightAt(r), w = h * item.ar;
      h = heightAt(r - w / 2); w = h * item.ar;
      return { w, h };
    }

    // 첫 등장: 1.5초 동안(ease-out-cubic) 전체가 오른쪽으로 미끄러지며,
    // 사진마다 왼쪽 아래 모서리를 기준으로 0 → 제 크기, 투명 → 선명.
    const INTRO_MS = 1500;
    const introShift = () => (reduced ? 0 : Math.min(600, vw * 0.42));
    let introStart = 0, introQ = 0, introOff = 0, introDone = false;

    // 처음 화면에서 사진 경계가 화면 양 끝에 딱 맞지 않고, 양쪽 끝 사진이 모두 절반쯤 잘려 보이는
    // 시작 위치를 찾습니다. (왼쪽·오른쪽 끝 사진이 보이는 비율이 각각 50% 에 가장 가까운 곳)
    // 시작 위치 s 와, 그때 '첫 번째로 온전히 보이는' 카드가 순서상 몇 번째인지(first)를 함께 구합니다.
    function naturalStart() {
      let best = -vw * 0.32, bestFirst = 1, bestScore = Infinity;
      for (let s = -vw * 0.15; s > -vw * 1.6; s -= 2) {
        let x = s, left = null, right = null, first = 0;
        for (let k = 0; k < items.length && x < vw; k++) {
          const { w } = sizeFromLeft(items[k], x);
          if (left === null && x + w > 0) { left = (x + w) / w; first = x < 0 ? k + 1 : k; }
          if (x + w >= vw) right = (vw - x) / w;
          x += w;
        }
        if (left === null || right === null) continue;
        const score = Math.abs(left - 0.5) + Math.abs(right - 0.5);
        if (score < bestScore) { bestScore = score; best = s; bestFirst = first; }
      }
      return { start: best, first: bestFirst };
    }

    readViewport();
    // 카드 크기는 위치로만 정해지므로, 순서를 돌려 '첫 번째로 온전히 보이는 카드'가 가장 최신 영상이 되게 합니다.
    // (그 왼쪽에 반쯤 걸친 카드는 목록의 마지막 = 가장 오래된 영상)
    const natural = naturalStart();
    const N = items.length;
    let order = items.map((_, j) => (((j - natural.first) % N) + N) % N);
    let startX = natural.start - introShift();   // 첫 아이템의 왼쪽 좌표 (등장 이동분만큼 왼쪽에서 출발)
    let target = 0, current = 0, prev = 0, acc = 0;

    function applyItem(it, x, y, w, h, scale, opacity) {
      it.el.style.transform = `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0)${scale}`;
      it.el.style.width = `${w.toFixed(2)}px`;
      it.el.style.height = `${h.toFixed(2)}px`;
      it.el.style.opacity = opacity;
    }

    function layoutRows(scale, opacity) {
      const intro = introShift() * (introQ - 1);   // 등장 중에는 왼쪽에서 출발해 제자리로
      rows.forEach((row) => {
        const period = row.list.length * row.step;
        const pos = row.base + (current + intro + autoX) * row.speed;
        row.list.forEach((it, k) => {
          let x = (k * row.step + pos) % period;
          if (x < 0) x += period;
          x -= row.step;
          applyItem(it, x, row.y, row.w, row.h, scale, opacity);
        });
      });
    }

    function layout() {
      // 폰 카드는 detroit 모바일처럼 크기 변화 없이 미끄러지며 나타나기만 합니다
      const scale = introDone || mobile ? '' : ` scale(${introQ.toFixed(4)})`;
      const opacity = introDone ? '1' : introQ.toFixed(4);
      if (mobile) { layoutRows(scale, opacity); return; }
      let x = startX;
      for (const i of order) {
        const it = items[i];
        const { w, h } = sizeFromLeft(it, x);
        it.x = x; it.w = w; it.h = h;
        applyItem(it, x, 0, w, h, scale, opacity);
        x += w;
      }
    }

    function recycle() {
      if (mobile) return;   // 폰 카드 줄은 나머지 연산으로 이미 순환합니다
      let guard = 0;
      while (guard++ < 60) {
        const first = items[order[0]];
        if (first.x + first.w >= -60) break;
        startX += first.w;
        order.push(order.shift());
        layout();
      }
      guard = 0;
      while (guard++ < 60 && startX > -60) {
        const lastIdx = order[order.length - 1];
        const { w } = sizeFromRight(items[lastIdx], startX);
        startX -= w;
        order.unshift(order.pop());
        layout();
      }
    }

    // 폰: 손대지 않으면 사진이 오른쪽 → 왼쪽으로 천천히 저절로 흐릅니다.
    // 손가락이 닿으면 서서히 멈추고, 손을 뗀 뒤 AUTO_RESUME_MS 가 지나면 다시 서서히 출발합니다.
    const AUTO_SPEED = -0.05;       // px/ms (초당 약 50px, 음수 = 왼쪽으로 흐름)
    const AUTO_RESUME_MS = 1500;
    let autoX = 0, autoVel = 0, holding = false, holdUntil = 0, lastT = performance.now();

    function frame() {
      let moved = false;
      const now = performance.now(), dt = Math.min(now - lastT, 50);
      lastT = now;
      if (mobile && introDone && !reduced) {
        const paused = holding || now < holdUntil || currentId !== 'home';
        autoVel += ((paused ? 0 : AUTO_SPEED) - autoVel) * 0.04;   // 속도를 서서히 바꿈
        if (Math.abs(autoVel) > 1e-4) { autoX += autoVel * dt; moved = true; }
      }
      if (introStart && !introDone) {
        const t = clamp((performance.now() - introStart) / INTRO_MS, 0, 1);
        introQ = 1 - Math.pow(1 - t, 3);
        const off = introShift() * introQ;
        startX += off - introOff;
        introOff = off;
        if (t >= 1) introDone = true;
        moved = true;
      }
      current = lerp(current, target, EASE);
      const delta = current - prev;
      if (Math.abs(delta) > 0.01) {
        prev = current;
        startX += delta;
        moved = true;
      }
      if (moved) {
        layout();
        recycle();
      }
      requestAnimationFrame(frame);
    }

    // 로딩 화면이 걷히면 등장 시작
    revealStrip = () => {
      if (reduced) { introQ = 1; introDone = true; layout(); return; }
      introStart = performance.now();
    };
    // 다른 화면에서 홈으로 돌아오면 — 처음처럼 왼쪽에서 미끄러지며 사진이 커지고 선명해짐
    replayStrip = () => {
      if (reduced || !introDone) return;
      startX -= introShift();
      introQ = 0; introOff = 0; introDone = false;
      layout();
      introStart = performance.now() + 380;   // 나가는 화면이 걷히기 시작할 즈음 출발
    };

    // 휠·터치 입력을 가로 이동으로 (gain 1 = 손가락을 1:1 로 따라감)
    holdStrip = (on) => {
      holding = on;
      if (!on) holdUntil = performance.now() + AUTO_RESUME_MS;
    };

    pushStrip = (delta, gain = SPEED) => {
      acc += delta * gain;
      target = -acc;
      if (reduced) { current = prev = target; layout(); recycle(); }
    };

    layout();
    recycle();
    addEventListener('resize', () => { readViewport(); layout(); recycle(); });
    requestAnimationFrame(frame);
  }

  /* =========================================================
     2. TEAMS (지금은 사이트에서 뺌 — #teams 가 없으면 아무것도 하지 않음, 되살리는 법: _archive/teams/README.md) — 이름 명단: 커서를 올리거나(데스크톱) 화면 가운데 온(스크롤) 이름만 진하게,
        오른쪽(폰은 위) 사진은 그 멤버 사진(data-member)으로, 없으면 파트 사진으로 바뀝니다. 명단은 index.html 에 있습니다.
     ========================================================= */
  const teamsPanel = document.getElementById('teams');
  if (teamsPanel) {
    const rows = Array.from(teamsPanel.querySelectorAll('.roster__row'));
    const imgs = Array.from(teamsPanel.querySelectorAll('.roster__img'));
    const capPart = teamsPanel.querySelector('.roster__cap-part');
    let activeRow = null, hovering = false;
    const setActive = (row) => {
      if (!row || row === activeRow) return;
      if (activeRow) activeRow.classList.remove('is-active');
      row.classList.add('is-active');
      activeRow = row;
      const name = row.querySelector('.roster__name').textContent;
      const show = imgs.find((im) => im.dataset.member === name) || imgs.find((im) => im.dataset.part === row.dataset.part);
      imgs.forEach((im) => im.classList.toggle('is-active', im === show));
      if (capPart) capPart.textContent = row.querySelector('.roster__part').textContent;
    };
    // 스크롤: 화면 가운데(폰은 사진 아래 영역의 가운데)에 가장 가까운 이름
    const pickByScroll = () => {
      if (hovering) return;
      const media = teamsPanel.querySelector('.roster__media').getBoundingClientRect();
      const stacked = innerWidth <= 760;
      const y = stacked ? (media.bottom + innerHeight) / 2 : innerHeight * 0.5;
      let best = null, bestD = Infinity;
      rows.forEach((r) => {
        const b = r.getBoundingClientRect();
        const d = Math.abs((b.top + b.bottom) / 2 - y);
        if (d < bestD) { bestD = d; best = r; }
      });
      setActive(best);
    };
    rows.forEach((r) => {
      r.addEventListener('mouseenter', () => { hovering = true; setActive(r); });
      r.addEventListener('mouseleave', () => { hovering = false; });
    });
    teamsPanel.addEventListener('scroll', pickByScroll, { passive: true });
    setActive(rows[0]);
  }

  /* =========================================================
     3. SHOWS — 가로 레일
     ========================================================= */
  // SHOWS — 정기공연 포스터를 최신 공연부터 늘어놓고, 누르면 상세 창(셋리스트 이미지 · 공연 정보 · 영상)이 열립니다.
  // 제목 앞 기수: 여름 공연 = 그해 1학기(26-1), 겨울 공연(12~2월) = 앞 해 2학기(예: 2027년 2월 → 26-2).
  // setlist: 상세 창에서 포스터 다음에 넘겨 볼 셋리스트 이미지
  // videos : 홈 썸네일 목록(HERO_IMAGES)의 영상 제목에서 찾을 말 — 그 공연의 영상 목록을 만듭니다
  // 이미지는 동아리 디자인 원본(청기 사이트 폴더)을 웹용으로 줄인 것이고, 포스터는 모두 4:5 입니다.
  const PROJECTS = [
    { term: '26-1', title: '立夏大吉 입하대길', file: 'work-01.jpg', date: '2026.07.19 SUN', time: '입장 17:30 · 시작 18:00',
      venue: '합정 라디오가가', songs: '21곡', setlist: ['sl-01.jpg', 'work-02.jpg'], videos: ['2026-1'] },
    { term: '25-2', title: 'PLAY HARD', file: 'work-03.jpg', date: '2026.02.01 SUN', time: '입장 17:30 · 시작 18:00',
      venue: '홍대 스윙홀', songs: '2 SETS · 18곡', setlist: ['sl-02.jpg', 'work-04.jpg', 'sl-03.jpg'], videos: ['PLAY HARD'] },
    { term: '25-1', title: 'SUMMER PAGE', file: 'work-05.jpg', date: '2025.07.27 SUN', time: '18:00',
      venue: '라디오가가', songs: '21곡', setlist: ['work-06.jpg', 'sl-04.jpg', 'sl-05.jpg'], videos: ['SUMMER PAGE'] },
    { term: '24-2', title: 'COME BACK HOME', file: 'work-07.jpg', date: '2024.12.06 FRI', time: '19:00',
      venue: '신촌 몽향라이브홀', songs: '16곡', setlist: ['sl-06.jpg', 'work-08.jpg', 'sl-07.jpg'],
      with: 'Jade(제이드밴드) · 설레임 · 꽃같아(Re:W) · More to Less · 피난처 · Encore' },
    { term: '24-1', title: 'Blue print', file: 'work-12.jpg', date: '2024.08.25 SUN', time: '18:00', venue: '홍대 스윙홀',
      songs: '좋지 아니한가 · 빨간피터 · 선물 · 날씨의 요정 · Cruel Summer · To Hell with the Devil · 자처 · 입춘 · Hi Bully 외',
      sub: 'SUMMER LIVE CONCERT' },
    { term: '23-2', title: '비행', file: 'work-09.jpg', date: '2024.02.22 THU', time: '19:00', venue: '라디오가가',
      sub: 'Flight Misdeed' },
    { term: '23-1', title: 'The Album FLORENS', file: 'work-16.jpg', date: '2023.08.17 THU', time: '19:00', venue: '라디오가가' },
    { term: '22-2', title: '도온', file: 'work-10.jpg', date: '2023.02.24 FRI', time: '19:00', venue: '몽향라이브홀',
      sub: 'a winter performance' },
    { term: '22-1', title: '항해', file: 'work-11.jpg', date: '2022.08.07 SUN', venue: '신촌 몽향라이브홀',
      sub: 'Blue Lyrics of Ur Ego' },
    { term: '21-2', title: 'NOSTALGIA : 향수', file: 'work-13.jpg', date: '2022.02.27 SUN', time: '19:00', venue: '신촌 몽향라이브홀' },
    { term: '20-1', title: '永花 영화', file: 'work-14.jpg', date: '2020.08.09 SUN', time: '19:00', venue: '몽향라이브홀' },
    { term: '19-1', title: 'OUR Playlist', file: 'work-15.jpg', date: '2019.08.04 SUN', time: '19:00', venue: 'CLUB FF',
      sub: 'LIVE STAGE' }
  ];
  const imgSrc = (f) => webp(`assets/img/${f}`);
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---- 공연 상세 창 ----
  const showEl = document.getElementById('show');
  let showOpen = false, lastFocus = null;
  const isShowOpen = () => showOpen;

  function openShow(p) {
    if (!showEl) return;
    const pages = [p.file].concat(p.setlist || []);
    const view = showEl.querySelector('.show__view img');
    const thumbs = showEl.querySelector('.show__thumbs');
    const setPage = (i) => {
      view.classList.remove('is-in');
      view.onload = () => view.classList.add('is-in');
      view.src = imgSrc(pages[i]);
      view.alt = i === 0 ? `${p.title} 포스터` : `${p.title} 셋리스트 ${i}`;
      thumbs.querySelectorAll('.show__thumb').forEach((t, k) => t.classList.toggle('is-active', k === i));
    };

    showEl.querySelector('.show__term').textContent = `${p.term} 정기공연`;
    showEl.querySelector('.show__title').textContent = p.title;
    showEl.querySelector('.show__sub').textContent = p.sub || '';
    const rows = [['DATE', p.date], ['TIME', p.time], ['VENUE', p.venue], ['SET-LIST', p.songs], ['WITH', p.with]]
      .filter(([, v]) => v);
    showEl.querySelector('.show__meta').innerHTML =
      rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('');

    thumbs.innerHTML = '';
    thumbs.hidden = pages.length < 2;
    pages.forEach((f, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'show__thumb';
      b.setAttribute('aria-label', i === 0 ? '포스터 보기' : `셋리스트 ${i} 보기`);
      b.innerHTML = `<img src="${imgSrc(f)}" alt=""><span>${i === 0 ? 'POSTER' : 'SET-LIST ' + i}</span>`;
      b.addEventListener('click', () => setPage(i));
      thumbs.appendChild(b);
    });

    const vids = (p.videos || []).length
      ? HERO_IMAGES.filter((v) => p.videos.some((k) => v.alt.includes(k))) : [];
    const vbox = showEl.querySelector('.show__videos');
    vbox.hidden = !vids.length;
    vbox.querySelector('ul').innerHTML = vids.map((v) =>
      `<li><a class="dotlink" href="https://www.youtube.com/watch?v=${v.seed}" target="_blank" rel="noopener">` +
      `<span class="dotlink__dot"></span>${esc(v.alt.split('|')[0].trim())}</a></li>`).join('');

    setPage(0);
    lastFocus = document.activeElement;
    showEl.hidden = false;
    showEl.scrollTop = 0;
    showOpen = true;
    requestAnimationFrame(() => requestAnimationFrame(() => showEl.classList.add('is-open')));
    showEl.querySelector('.show__close').focus({ preventScroll: true });
  }

  function closeShow() {
    if (!showOpen) return;
    showOpen = false;
    showEl.classList.remove('is-open');
    setTimeout(() => { if (!showOpen) showEl.hidden = true; }, 450);
    if (lastFocus) lastFocus.focus({ preventScroll: true });
  }

  if (showEl) {
    showEl.querySelector('.show__close').addEventListener('click', closeShow);
    showEl.addEventListener('click', (e) => { if (e.target === showEl) closeShow(); });
    addEventListener('keydown', (e) => { if (e.key === 'Escape') closeShow(); });
  }

  // ABOUT 연대표의 포스터를 누르면 같은 공연 상세 창
  document.querySelectorAll('[data-show]').forEach((btn) => {
    const p = PROJECTS.find((q) => q.file === btn.dataset.show);
    if (p) btn.addEventListener('click', () => openShow(p));
  });

  const rail = document.getElementById('projects-rail');
  if (rail) {
    PROJECTS.forEach((p) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'project';
      card.setAttribute('data-reveal', '');
      card.setAttribute('aria-label', `${p.term} ${p.title} 공연 정보 보기`);
      card.style.setProperty('--ar', 0.8);   // 폭 = 카드 높이(--card-h) × 비율 (styles.css) — 포스터는 모두 4:5
      const box = document.createElement('div');
      box.className = 'project__ph';
      box.appendChild(makeImg(imgSrc(p.file), p.file, 1080, 1350, `${p.term} ${p.title} 포스터`));
      card.appendChild(box);
      const meta = document.createElement('div');
      meta.className = 'project__meta';
      meta.innerHTML = `<h3 class="project__title">${esc(p.term + ' ' + p.title)}</h3>` +
        `<span class="project__cap">${p.date.slice(0, 10)} · ${esc(p.venue)}</span>`;
      card.appendChild(meta);
      card.addEventListener('click', () => openShow(p));
      rail.appendChild(card);
    });
  }

  /* =========================================================
     4. ACTIVITY
     ========================================================= */
  // 청기의 활동 카테고리 — 카드(표지·제목·PHOTOS)를 누르면 사진 창이 열리고 사진이 차례로 펼쳐집니다.
  // GAL: 카테고리별 [파일, 폭, 높이] — 원본(청기 사이트 폴더)을 웹용으로 줄인 것. 목록 칸에는 같은 이름의 -t(작은 사진)를 씁니다.
  const GAL = {
    jam: [
      ['gal-jam-01.jpg', 1400, 1050],
      ['gal-jam-02.jpg', 430, 574],
      ['gal-jam-03.jpg', 788, 1400],
      ['gal-jam-04.jpg', 788, 1400],
      ['gal-jam-05.jpg', 1400, 1050],
      ['gal-jam-06.jpg', 1400, 1050],
      ['gal-jam-07.jpg', 624, 468],
      ['gal-jam-08.jpg', 1050, 1400],
      ['gal-jam-09.jpg', 1400, 1050],
      ['gal-jam-10.jpg', 1400, 787],
      ['gal-jam-11.jpg', 1400, 787],
      ['gal-jam-12.jpg', 1400, 787],
      ['gal-jam-13.jpg', 1400, 787],
      ['gal-jam-14.jpg', 1400, 787],
      ['gal-jam-15.jpg', 1400, 787],
      ['gal-jam-16.jpg', 1400, 787],
      ['gal-jam-17.jpg', 1400, 787],
      ['gal-jam-18.jpg', 1400, 787],
      ['gal-jam-19.jpg', 1400, 787],
      ['gal-jam-20.jpg', 1120, 1400],
      ['gal-jam-21.jpg', 1121, 1400],
      ['gal-jam-22.jpg', 1121, 1400],
      ['gal-jam-23.jpg', 1121, 1400],
      ['gal-jam-24.jpg', 1121, 1400],
      ['gal-jam-25.jpg', 1120, 1400],
      ['gal-jam-26.jpg', 1119, 1400],
      ['gal-jam-27.jpg', 1120, 1400],
      ['gal-jam-28.jpg', 1120, 1400],
      ['gal-jam-29.jpg', 1400, 788],
      ['gal-jam-30.jpg', 788, 1400],
      ['gal-jam-31.jpg', 1050, 1400],
      ['gal-jam-32.jpg', 1400, 997],
      ['gal-jam-33.jpg', 1400, 788],
      ['gal-jam-34.jpg', 1077, 1400],
      ['gal-jam-35.jpg', 1400, 788],
      ['gal-jam-36.jpg', 1400, 788],
      ['gal-jam-37.jpg', 1057, 1400],
      ['gal-jam-38.jpg', 1061, 1400],
      ['gal-jam-39.jpg', 1061, 1400],
      ['gal-jam-40.jpg', 1057, 1400],
      ['gal-jam-41.jpg', 736, 974],
      ['gal-jam-42.jpg', 1057, 1400],
      ['gal-jam-43.jpg', 1057, 1400],
      ['gal-jam-44.jpg', 1057, 1400],
      ['gal-jam-45.jpg', 1057, 1400],
      ['gal-jam-46.jpg', 1057, 1400],
      ['gal-jam-47.jpg', 1057, 1400],
      ['gal-jam-48.jpg', 1057, 1400],
      ['gal-jam-49.jpg', 1057, 1400],
      ['gal-jam-50.jpg', 1057, 1400],
      ['gal-jam-51.jpg', 1057, 1400],
      ['gal-jam-52.jpg', 1057, 1400],
      ['gal-jam-53.jpg', 1057, 1400],
      ['gal-jam-54.jpg', 1057, 1400],
      ['gal-jam-55.jpg', 1057, 1400],
      ['gal-jam-56.jpg', 597, 597],
      ['gal-jam-57.jpg', 596, 596],
      ['gal-jam-58.jpg', 597, 597],
      ['gal-jam-59.jpg', 596, 596],
      ['gal-jam-60.jpg', 597, 597],
      ['gal-jam-61.jpg', 596, 596],
      ['gal-jam-62.jpg', 596, 596],
      ['gal-jam-63.jpg', 597, 597],
      ['gal-jam-64.jpg', 1400, 1400],
      ['gal-jam-65.jpg', 1400, 1400],
      ['gal-jam-66.jpg', 1400, 1400],
      ['gal-jam-67.jpg', 1400, 1399],
      ['gal-jam-68.jpg', 1200, 1200],
      ['gal-jam-69.jpg', 1200, 1200],
      ['gal-jam-70.jpg', 1200, 1200],
      ['gal-jam-71.jpg', 1200, 1200],
      ['gal-jam-72.jpg', 1200, 1200],
      ['gal-jam-73.jpg', 1200, 1200],
      ['gal-jam-74.jpg', 1200, 1200],
      ['gal-jam-75.jpg', 1200, 1200],
      ['gal-jam-76.jpg', 1200, 1200],
      ['gal-jam-77.jpg', 1200, 1200],
      ['gal-jam-78.jpg', 1200, 1200],
      ['gal-jam-79.jpg', 1200, 1200],
      ['gal-jam-80.jpg', 1200, 1200],
      ['gal-jam-81.jpg', 1200, 1200],
      ['gal-jam-82.jpg', 1200, 1200],
      ['gal-jam-83.jpg', 1200, 1200],
      ['gal-jam-84.jpg', 1200, 1200],
      ['gal-jam-85.jpg', 1200, 1200],
      ['gal-jam-86.jpg', 1200, 1200],
      ['gal-jam-87.jpg', 1200, 1200],
      ['gal-jam-88.jpg', 1200, 1200],
      ['gal-jam-89.jpg', 1200, 1200],
      ['gal-jam-90.jpg', 1200, 1200],
      ['gal-jam-91.jpg', 1200, 1200],
      ['gal-jam-92.jpg', 1200, 1200],
      ['gal-jam-93.jpg', 1200, 1200],
      ['gal-jam-94.jpg', 1080, 1080],
      ['gal-jam-95.jpg', 1076, 1076],
      ['gal-jam-96.jpg', 1080, 1080],
      ['gal-jam-97.jpg', 1000, 1000],
      ['gal-jam-98.jpg', 1080, 1080],
      ['gal-jam-99.jpg', 1080, 1080],
      ['gal-jam-100.jpg', 1080, 1080],
      ['gal-jam-101.jpg', 1400, 1400],
      ['gal-jam-102.jpg', 1400, 1400],
      ['gal-jam-103.jpg', 1200, 1200],
      ['gal-jam-104.jpg', 1200, 1200],
      ['gal-jam-105.jpg', 1200, 1200],
      ['gal-jam-106.jpg', 1200, 1200],
      ['gal-jam-107.jpg', 1120, 1400],
      ['gal-jam-108.jpg', 1120, 1400],
      ['gal-jam-109.jpg', 1120, 1400],
      ['gal-jam-110.jpg', 1118, 1400],
      ['gal-jam-111.jpg', 1118, 1400],
      ['gal-jam-112.jpg', 1120, 1400],
      ['gal-jam-113.jpg', 1120, 1400],
      ['gal-jam-114.jpg', 1120, 1400],
      ['gal-jam-115.jpg', 1121, 1400],
      ['gal-jam-116.jpg', 1121, 1400],
      ['gal-jam-117.jpg', 1121, 1400],
      ['gal-jam-118.jpg', 1121, 1400],
      ['gal-jam-119.jpg', 1120, 1400],
      ['gal-jam-120.jpg', 1120, 1400],
      ['gal-jam-121.jpg', 1120, 1400],
      ['gal-jam-122.jpg', 1400, 1400],
      ['gal-jam-123.jpg', 1400, 1400],
      ['gal-jam-124.jpg', 1400, 1400],
      ['gal-jam-125.jpg', 1400, 1400],
      ['gal-jam-126.jpg', 1400, 1050],
      ['gal-jam-127.jpg', 1400, 1050],
      ['gal-jam-128.jpg', 1400, 1050],
      ['gal-jam-129.jpg', 1400, 1050],
      ['gal-jam-130.jpg', 1400, 1400],
      ['gal-jam-131.jpg', 1400, 1400],
      ['gal-jam-132.jpg', 1400, 1400],
      ['gal-jam-133.jpg', 1120, 1400],
      ['gal-jam-134.jpg', 1120, 1400],
      ['gal-jam-135.jpg', 1120, 1400],
      ['gal-jam-136.jpg', 1342, 1343],
      ['gal-jam-137.jpg', 1400, 1400],
      ['gal-jam-138.jpg', 1372, 1372],
      ['gal-jam-139.jpg', 1165, 1165],
      ['gal-jam-140.jpg', 1400, 1400],
      ['gal-jam-141.jpg', 1120, 1400],
      ['gal-jam-142.jpg', 1120, 1400],
      ['gal-jam-143.jpg', 1120, 1400],
      ['gal-jam-144.jpg', 1120, 1400],
      ['gal-jam-145.jpg', 1120, 1400],
      ['gal-jam-146.jpg', 1120, 1400],
      ['gal-jam-147.jpg', 1400, 1400],
      ['gal-jam-148.jpg', 1400, 1400],
      ['gal-jam-149.jpg', 1400, 1400],
      ['gal-jam-150.jpg', 1120, 1400],
      ['gal-jam-151.jpg', 1120, 1400],
      ['gal-jam-152.jpg', 1400, 1400],
      ['gal-jam-153.jpg', 1400, 1400],
      ['gal-jam-154.jpg', 1400, 1400],
      ['gal-jam-155.jpg', 1120, 1400],
      ['gal-jam-156.jpg', 1120, 1400],
      ['gal-jam-157.jpg', 1120, 1400],
      ['gal-jam-158.jpg', 1400, 1400],
      ['gal-jam-159.jpg', 1400, 1400],
      ['gal-jam-160.jpg', 1400, 1400],
      ['gal-jam-161.jpg', 1400, 1400],
      ['gal-jam-162.jpg', 1400, 1399],
      ['gal-jam-163.jpg', 1400, 1051],
      ['gal-jam-164.jpg', 1400, 1055],
      ['gal-jam-165.jpg', 1081, 812],
      ['gal-jam-166.jpg', 1057, 792],
      ['gal-jam-167.jpg', 1120, 1400],
      ['gal-jam-168.jpg', 1120, 1400],
      ['gal-jam-169.jpg', 1120, 1400]
    ],
    recruit: [
      ['gal-recruit-01.jpg', 1120, 1400],
      ['gal-recruit-02.jpg', 1400, 622],
      ['gal-recruit-03.jpg', 926, 963],
      ['gal-recruit-04.jpg', 1400, 1400],
      ['gal-recruit-05.jpg', 1400, 1400],
      ['gal-recruit-06.jpg', 1400, 1400],
      ['gal-recruit-07.jpg', 1400, 1400],
      ['gal-recruit-08.jpg', 1400, 1400],
      ['gal-recruit-09.jpg', 1400, 1400],
      ['gal-recruit-10.jpg', 1400, 1400],
      ['gal-recruit-11.jpg', 1400, 1400],
      ['gal-recruit-12.jpg', 1400, 1400],
      ['gal-recruit-13.jpg', 1260, 1260],
      ['gal-recruit-14.jpg', 1400, 1400],
      ['gal-recruit-15.jpg', 1080, 1080],
      ['gal-recruit-16.jpg', 1120, 1400],
      ['gal-recruit-17.jpg', 1400, 1400],
      ['gal-recruit-18.jpg', 1400, 1400],
      ['gal-recruit-19.jpg', 1400, 1400],
      ['gal-recruit-20.jpg', 1171, 1400]
    ],
    stage: [
      ['gal-stage-01.jpg', 1400, 788],
      ['gal-stage-02.jpg', 788, 1400],
      ['gal-stage-03.jpg', 1400, 787],
      ['gal-stage-04.jpg', 1400, 787],
      ['gal-stage-05.jpg', 1400, 1050],
      ['gal-stage-06.jpg', 1400, 1050],
      ['gal-stage-07.jpg', 1400, 788],
      ['gal-stage-08.jpg', 1400, 788],
      ['gal-stage-09.jpg', 1400, 788],
      ['gal-stage-10.jpg', 1400, 788],
      ['gal-stage-11.jpg', 788, 1400],
      ['gal-stage-12.jpg', 1400, 788],
      ['gal-stage-13.jpg', 1400, 788],
      ['gal-stage-14.jpg', 1400, 788],
      ['gal-stage-15.jpg', 1400, 788],
      ['gal-stage-16.jpg', 788, 1400],
      ['gal-stage-17.jpg', 788, 1400],
      ['gal-stage-18.jpg', 1400, 787],
      ['gal-stage-19.jpg', 1400, 786],
      ['gal-stage-20.jpg', 1400, 1050],
      ['gal-stage-21.jpg', 1400, 788],
      ['gal-stage-22.jpg', 1400, 788],
      ['gal-stage-23.jpg', 1400, 1050],
      ['gal-stage-24.jpg', 1400, 1050],
      ['gal-stage-25.jpg', 1400, 1050],
      ['gal-stage-26.jpg', 1400, 788],
      ['gal-stage-27.jpg', 1400, 1050],
      ['gal-stage-28.jpg', 1050, 1400],
      ['gal-stage-29.jpg', 1050, 1400],
      ['gal-stage-30.jpg', 596, 595],
      ['gal-stage-31.jpg', 1400, 1400],
      ['gal-stage-32.jpg', 596, 596],
      ['gal-stage-33.jpg', 597, 597],
      ['gal-stage-34.jpg', 597, 597],
      ['gal-stage-35.jpg', 597, 597],
      ['gal-stage-36.jpg', 597, 597],
      ['gal-stage-37.jpg', 597, 597],
      ['gal-stage-38.jpg', 596, 596],
      ['gal-stage-39.jpg', 597, 597],
      ['gal-stage-40.jpg', 596, 596],
      ['gal-stage-41.jpg', 1400, 1400],
      ['gal-stage-42.jpg', 1400, 1400],
      ['gal-stage-43.jpg', 1400, 1400],
      ['gal-stage-44.jpg', 1400, 1400],
      ['gal-stage-45.jpg', 1400, 1400],
      ['gal-stage-46.jpg', 1400, 1400],
      ['gal-stage-47.jpg', 1400, 1400],
      ['gal-stage-48.jpg', 1400, 1400],
      ['gal-stage-49.jpg', 1400, 1400],
      ['gal-stage-50.jpg', 1400, 1400],
      ['gal-stage-51.jpg', 1400, 1400],
      ['gal-stage-52.jpg', 1400, 1400],
      ['gal-stage-53.jpg', 1400, 1400],
      ['gal-stage-54.jpg', 1400, 1400],
      ['gal-stage-55.jpg', 1400, 1400],
      ['gal-stage-56.jpg', 1400, 1400],
      ['gal-stage-57.jpg', 1400, 1400],
      ['gal-stage-58.jpg', 1400, 1400],
      ['gal-stage-59.jpg', 1400, 1400],
      ['gal-stage-60.jpg', 1400, 1399],
      ['gal-stage-61.jpg', 1400, 1399],
      ['gal-stage-62.jpg', 1400, 1400],
      ['gal-stage-63.jpg', 1400, 1400],
      ['gal-stage-64.jpg', 1400, 1400],
      ['gal-stage-65.jpg', 1400, 1400],
      ['gal-stage-66.jpg', 1400, 1400],
      ['gal-stage-67.jpg', 1400, 1400],
      ['gal-stage-68.jpg', 1400, 1400],
      ['gal-stage-69.jpg', 1400, 1400],
      ['gal-stage-70.jpg', 1400, 1400],
      ['gal-stage-71.jpg', 1400, 1400],
      ['gal-stage-72.jpg', 1400, 1400],
      ['gal-stage-73.jpg', 1400, 1400],
      ['gal-stage-74.jpg', 1133, 1400],
      ['gal-stage-75.jpg', 1133, 1400],
      ['gal-stage-76.jpg', 1400, 1400],
      ['gal-stage-77.jpg', 1400, 1400],
      ['gal-stage-78.jpg', 1400, 1400],
      ['gal-stage-79.jpg', 1400, 1400],
      ['gal-stage-80.jpg', 1400, 1400],
      ['gal-stage-81.jpg', 1400, 1400],
      ['gal-stage-82.jpg', 1400, 1400],
      ['gal-stage-83.jpg', 1400, 1400],
      ['gal-stage-84.jpg', 1400, 1400],
      ['gal-stage-85.jpg', 1400, 1400],
      ['gal-stage-86.jpg', 1400, 1400],
      ['gal-stage-87.jpg', 1400, 1400],
      ['gal-stage-88.jpg', 1400, 1400],
      ['gal-stage-89.jpg', 1400, 1400],
      ['gal-stage-90.jpg', 1400, 1400],
      ['gal-stage-91.jpg', 1400, 1400],
      ['gal-stage-92.jpg', 1400, 1400],
      ['gal-stage-93.jpg', 1400, 1400],
      ['gal-stage-94.jpg', 1400, 1400],
      ['gal-stage-95.jpg', 1400, 1400],
      ['gal-stage-96.jpg', 1400, 1400],
      ['gal-stage-97.jpg', 1400, 1400],
      ['gal-stage-98.jpg', 1400, 1400],
      ['gal-stage-99.jpg', 1400, 1400],
      ['gal-stage-100.jpg', 1400, 1400],
      ['gal-stage-101.jpg', 1400, 1400],
      ['gal-stage-102.jpg', 1400, 1400],
      ['gal-stage-103.jpg', 1120, 1400],
      ['gal-stage-104.jpg', 1080, 1350],
      ['gal-stage-105.jpg', 1080, 1350],
      ['gal-stage-106.jpg', 1080, 1350],
      ['gal-stage-107.jpg', 1080, 1350],
      ['gal-stage-108.jpg', 1080, 1350],
      ['gal-stage-109.jpg', 1080, 1350],
      ['gal-stage-110.jpg', 1080, 1350],
      ['gal-stage-111.jpg', 1080, 1350],
      ['gal-stage-112.jpg', 1080, 1350],
      ['gal-stage-113.jpg', 1080, 1350],
      ['gal-stage-114.jpg', 1080, 1350],
      ['gal-stage-115.jpg', 1080, 1350],
      ['gal-stage-116.jpg', 1080, 1350],
      ['gal-stage-117.jpg', 1120, 1400],
      ['gal-stage-118.jpg', 1400, 1400],
      ['gal-stage-119.jpg', 1400, 1400],
      ['gal-stage-120.jpg', 1400, 1400],
      ['gal-stage-121.jpg', 1400, 1400],
      ['gal-stage-122.jpg', 1400, 1400],
      ['gal-stage-123.jpg', 1400, 1400],
      ['gal-stage-124.jpg', 1400, 1050],
      ['gal-stage-125.jpg', 1400, 1050],
      ['gal-stage-126.jpg', 1400, 1050],
      ['gal-stage-127.jpg', 1400, 1051],
      ['gal-stage-128.jpg', 1400, 1050],
      ['gal-stage-129.jpg', 1400, 1400],
      ['gal-stage-130.jpg', 1400, 1400],
      ['gal-stage-131.jpg', 930, 930],
      ['gal-stage-132.jpg', 1080, 1080],
      ['gal-stage-133.jpg', 1201, 901],
      ['gal-stage-134.jpg', 1400, 1049],
      ['gal-stage-135.jpg', 1400, 1050],
      ['gal-stage-136.jpg', 1201, 901],
      ['gal-stage-137.jpg', 1120, 1400],
      ['gal-stage-138.jpg', 1120, 1400],
      ['gal-stage-139.jpg', 1120, 1400],
      ['gal-stage-140.jpg', 1120, 1400],
      ['gal-stage-141.jpg', 1120, 1400],
      ['gal-stage-142.jpg', 1400, 732],
      ['gal-stage-143.jpg', 1400, 786],
      ['gal-stage-144.jpg', 1400, 1050],
      ['gal-stage-145.jpg', 1120, 1400],
      ['gal-stage-146.jpg', 1120, 1400],
      ['gal-stage-147.jpg', 1120, 1400],
      ['gal-stage-148.jpg', 1120, 1400],
      ['gal-stage-149.jpg', 1120, 1400],
      ['gal-stage-150.jpg', 1400, 1050],
      ['gal-stage-151.jpg', 1400, 1050],
      ['gal-stage-152.jpg', 1400, 1050],
      ['gal-stage-153.jpg', 1400, 1050],
      ['gal-stage-154.jpg', 1400, 1055],
      ['gal-stage-155.jpg', 1400, 1050],
      ['gal-stage-156.jpg', 1400, 1050],
      ['gal-stage-157.jpg', 1400, 1050],
      ['gal-stage-158.jpg', 1400, 1050],
      ['gal-stage-159.jpg', 1400, 1050],
      ['gal-stage-160.jpg', 1400, 1055],
      ['gal-stage-161.jpg', 1120, 1400],
      ['gal-stage-162.jpg', 1120, 1400],
      ['gal-stage-163.jpg', 1120, 1400],
      ['gal-stage-164.jpg', 1080, 811],
      ['gal-stage-165.jpg', 1400, 1050],
      ['gal-stage-166.jpg', 1400, 1050]
    ],
    making: [
      ['gal-making-01.jpg', 1400, 583],
      ['gal-making-02.jpg', 1400, 622],
      ['gal-making-03.jpg', 1050, 1400],
      ['gal-making-04.jpg', 1050, 1400],
      ['gal-making-05.jpg', 1080, 1350],
      ['gal-making-07.jpg', 1080, 1350],
      ['gal-making-08.jpg', 1080, 1350],
      ['gal-making-09.jpg', 1080, 1350],
      ['gal-making-10.jpg', 1080, 1350],
      ['gal-making-11.jpg', 1080, 1350],
      ['gal-making-12.jpg', 1050, 1400],
      ['gal-making-13.jpg', 1050, 1400],
      ['gal-making-14.jpg', 1050, 1400],
      ['gal-making-15.jpg', 1120, 1400],
      ['gal-making-16.jpg', 1080, 1350],
      ['gal-making-17.jpg', 1080, 1350],
      ['gal-making-18.jpg', 1080, 1350],
      ['gal-making-19.jpg', 1080, 1350],
      ['gal-making-20.jpg', 1050, 1400],
      ['gal-making-21.jpg', 851, 1134],
      ['gal-making-22.jpg', 851, 1134],
      ['gal-making-24.jpg', 851, 1134],
      ['gal-making-25.jpg', 1050, 1400],
      ['gal-making-26.jpg', 1052, 1400],
      ['gal-making-27.jpg', 1050, 1400],
      ['gal-making-26.jpg', 1400, 1400],
      ['gal-making-27.jpg', 842, 842],
      ['gal-making-28.jpg', 843, 843],
      ['gal-making-29.jpg', 1153, 1153],
      ['gal-making-30.jpg', 1080, 1080],
      ['gal-making-31.jpg', 1080, 1080],
      ['gal-making-32.jpg', 1080, 1080],
      ['gal-making-33.jpg', 1080, 1080],
      ['gal-making-34.jpg', 1080, 1080],
      ['gal-making-35.jpg', 1400, 1400],
      ['gal-making-36.jpg', 1200, 1200],
      ['gal-making-37.jpg', 1200, 1200],
      ['gal-making-38.jpg', 1200, 1200],
      ['gal-making-39.jpg', 1200, 1200],
      ['gal-making-40.jpg', 1200, 1200],
      ['gal-making-41.jpg', 1200, 1200],
      ['gal-making-42.jpg', 1200, 1200],
      ['gal-making-43.jpg', 1200, 1200],
      ['gal-making-44.jpg', 1200, 1200],
      ['gal-making-45.jpg', 1200, 1200],
      ['gal-making-46.jpg', 1120, 1400],
      ['gal-making-47.jpg', 1400, 622],
      ['gal-making-48.jpg', 1050, 1400],
      ['gal-making-49.jpg', 1050, 1400],
      ['gal-making-50.jpg', 1121, 1400],
      ['gal-making-51.jpg', 1121, 1400],
      ['gal-making-52.jpg', 1120, 1400],
      ['gal-making-53.jpg', 1120, 1400],
      ['gal-making-54.jpg', 1120, 1400],
      ['gal-making-55.jpg', 1120, 1400],
      ['gal-making-56.jpg', 1400, 1400],
      ['gal-making-57.jpg', 1120, 1400],
      ['gal-making-58.jpg', 1120, 1400],
      ['gal-making-59.jpg', 1120, 1400],
      ['gal-making-60.jpg', 1400, 1400],
      ['gal-making-61.jpg', 1121, 1400],
      ['gal-making-62.jpg', 1400, 1400],
      ['gal-making-63.jpg', 1120, 1400],
      ['gal-making-64.jpg', 1120, 1400],
      ['gal-making-65.jpg', 1120, 1400],
      ['gal-making-66.jpg', 1080, 1080],
      ['gal-making-67.jpg', 1400, 1050],
      ['gal-making-68.jpg', 1400, 1050],
      ['gal-making-69.jpg', 1400, 1050],
      ['gal-making-70.jpg', 1400, 1050],
      ['gal-making-71.jpg', 1119, 1400],
      ['gal-making-72.jpg', 1400, 1050],
      ['gal-making-73.jpg', 1280, 720]
    ],
    playlist: [
      ['gal-playlist-01.jpg', 1080, 1350],
      ['gal-playlist-02.jpg', 1080, 1350],
      ['gal-playlist-03.jpg', 1080, 1350],
      ['gal-playlist-04.jpg', 1080, 1350],
      ['gal-playlist-05.jpg', 1080, 1350],
      ['gal-playlist-06.jpg', 1120, 1400],
      ['gal-playlist-07.jpg', 1080, 1350],
      ['gal-playlist-08.jpg', 1080, 1350],
      ['gal-playlist-09.jpg', 1080, 1350],
      ['gal-playlist-10.jpg', 1080, 1350],
      ['gal-playlist-11.jpg', 1080, 1350],
      ['gal-playlist-12.jpg', 1400, 618],
      ['gal-playlist-13.jpg', 1400, 467],
      ['gal-playlist-14.jpg', 1400, 467],
      ['gal-playlist-15.jpg', 1400, 622],
      ['gal-playlist-16.jpg', 1400, 1400],
      ['gal-playlist-17.jpg', 1400, 1400],
      ['gal-playlist-18.jpg', 1400, 1400],
      ['gal-playlist-19.jpg', 1400, 1400]
    ],
    play: [
      ['gal-play-01.jpg', 1120, 1400],
      ['gal-play-02.jpg', 1120, 1400],
      ['gal-play-03.jpg', 1120, 1400],
      ['gal-play-04.jpg', 1120, 1400],
      ['gal-play-05.jpg', 1120, 1400],
      ['gal-play-06.jpg', 1120, 1400],
      ['gal-play-07.jpg', 1120, 1400],
      ['gal-play-08.jpg', 1120, 1400],
      ['gal-play-09.jpg', 1120, 1400],
      ['gal-play-10.jpg', 1120, 1400],
      ['gal-play-11.jpg', 1120, 1400],
      ['gal-play-12.jpg', 1120, 1400],
      ['gal-play-13.jpg', 1120, 1400],
      ['gal-play-14.jpg', 1119, 1400],
      ['gal-play-15.jpg', 1119, 1400],
      ['gal-play-16.jpg', 1120, 1400],
      ['gal-play-17.jpg', 1400, 1050],
      ['gal-play-18.jpg', 1400, 1050],
      ['gal-play-19.jpg', 1400, 1050]
    ],
    friends: [
      ['gal-friends-01.jpg', 1400, 788],
      ['gal-friends-02.jpg', 788, 1400],
      ['gal-friends-03.jpg', 1400, 788],
      ['gal-friends-04.jpg', 788, 1400],
      ['gal-friends-05.jpg', 1400, 788],
      ['gal-friends-06.jpg', 1400, 788],
      ['gal-friends-07.jpg', 1400, 788],
      ['gal-friends-08.jpg', 1400, 788],
      ['gal-friends-09.jpg', 788, 1400],
      ['gal-friends-10.jpg', 1400, 788],
      ['gal-friends-11.jpg', 788, 1400],
      ['gal-friends-12.jpg', 788, 1400],
      ['gal-friends-13.jpg', 1050, 1400],
      ['gal-friends-14.jpg', 1050, 1400],
      ['gal-friends-15.jpg', 1050, 1400],
      ['gal-friends-16.jpg', 1050, 1400],
      ['gal-friends-17.jpg', 1050, 1400],
      ['gal-friends-18.jpg', 1050, 1400],
      ['gal-friends-19.jpg', 1050, 1400],
      ['gal-friends-20.jpg', 1050, 1400],
      ['gal-friends-21.jpg', 1050, 1400],
      ['gal-friends-22.jpg', 1050, 1400],
      ['gal-friends-23.jpg', 1050, 1400],
      ['gal-friends-24.jpg', 1050, 1400],
      ['gal-friends-25.jpg', 1050, 1400],
      ['gal-friends-26.jpg', 1400, 1050],
      ['gal-friends-27.jpg', 1400, 1050],
      ['gal-friends-28.jpg', 663, 375],
      ['gal-friends-29.jpg', 1400, 1400],
      ['gal-friends-30.jpg', 846, 635],
      ['gal-friends-31.jpg', 1400, 1050],
      ['gal-friends-32.jpg', 1400, 1050],
      ['gal-friends-33.jpg', 1400, 1400],
      ['gal-friends-34.jpg', 1400, 1050],
      ['gal-friends-35.jpg', 1400, 1050]
    ],
    yearend: [
      ['gal-yearend-01.jpg', 1120, 1400],
      ['gal-yearend-02.jpg', 1120, 1400],
      ['gal-yearend-03.jpg', 1120, 1400],
      ['gal-yearend-04.jpg', 1120, 1400],
      ['gal-yearend-05.jpg', 1120, 1400],
      ['gal-yearend-06.jpg', 1120, 1400],
      ['gal-yearend-07.jpg', 1120, 1400],
      ['gal-yearend-08.jpg', 1120, 1400],
      ['gal-yearend-09.jpg', 1120, 1400],
      ['gal-yearend-10.jpg', 1120, 1400],
      ['gal-yearend-11.jpg', 1120, 1400],
      ['gal-yearend-12.jpg', 1120, 1400],
      ['gal-yearend-13.jpg', 1120, 1400],
      ['gal-yearend-14.jpg', 1120, 1400],
      ['gal-yearend-15.jpg', 1120, 1400],
      ['gal-yearend-16.jpg', 1120, 1400],
      ['gal-yearend-17.jpg', 1120, 1400]
    ],
    story: [
      ['gal-story-01.jpg', 1120, 1400],
      ['gal-story-02.jpg', 1120, 1400],
      ['gal-story-03.jpg', 1120, 1400],
      ['gal-story-04.jpg', 1120, 1400],
      ['gal-story-05.jpg', 1120, 1400],
      ['gal-story-06.jpg', 1120, 1400],
      ['gal-story-07.jpg', 1120, 1400],
      ['gal-story-08.jpg', 1120, 1400],
      ['gal-story-09.jpg', 1120, 1400],
      ['gal-story-10.jpg', 1120, 1400],
      ['gal-story-11.jpg', 1120, 1400],
      ['gal-story-12.jpg', 1120, 1400],
      ['gal-story-13.jpg', 1120, 1400],
      ['gal-story-14.jpg', 1120, 1400],
      ['gal-story-15.jpg', 1120, 1400],
      ['gal-story-16.jpg', 1120, 1400],
      ['gal-story-17.jpg', 1120, 1400],
      ['gal-story-18.jpg', 1120, 1400]
    ],
    bag: [
      ['gal-bag-01.jpg', 1120, 1400],
      ['gal-bag-02.jpg', 1120, 1400],
      ['gal-bag-03.jpg', 1120, 1400]
    ],
    offbeat: [
      ['gal-offbeat-01.jpg', 1080, 1350],
      ['gal-offbeat-02.jpg', 1120, 1400],
      ['gal-offbeat-03.jpg', 1080, 1350],
      ['gal-offbeat-04.jpg', 1080, 1350],
      ['gal-offbeat-05.jpg', 1080, 1350],
      ['gal-offbeat-06.jpg', 1080, 1350],
      ['gal-offbeat-07.jpg', 1080, 1350],
      ['gal-offbeat-08.jpg', 1120, 1400],
      ['gal-offbeat-09.jpg', 1120, 1400],
      ['gal-offbeat-10.jpg', 1120, 1400],
      ['gal-offbeat-11.jpg', 1120, 1400],
      ['gal-offbeat-12.jpg', 1120, 1400],
      ['gal-offbeat-13.jpg', 1120, 1400],
      ['gal-offbeat-14.jpg', 1080, 1350],
      ['gal-offbeat-15.jpg', 1080, 1350],
      ['gal-offbeat-16.jpg', 1120, 1400],
      ['gal-offbeat-17.jpg', 1120, 1400],
      ['gal-offbeat-18.jpg', 1120, 1400],
      ['gal-offbeat-19.jpg', 1120, 1400],
      ['gal-offbeat-20.jpg', 1120, 1400],
      ['gal-offbeat-21.jpg', 1120, 1400],
      ['gal-offbeat-22.jpg', 1120, 1400],
      ['gal-offbeat-23.jpg', 1120, 1400],
      ['gal-offbeat-24.jpg', 1120, 1400],
      ['gal-offbeat-25.jpg', 1120, 1400],
      ['gal-offbeat-26.jpg', 1120, 1400],
      ['gal-offbeat-27.jpg', 1120, 1400],
      ['gal-offbeat-28.jpg', 1120, 1400],
      ['gal-offbeat-29.jpg', 1120, 1400],
      ['gal-offbeat-30.jpg', 1080, 1350],
      ['gal-offbeat-31.jpg', 1080, 1350],
      ['gal-offbeat-32.jpg', 1080, 1350],
      ['gal-offbeat-33.jpg', 1080, 1350],
      ['gal-offbeat-34.jpg', 1080, 1350],
      ['gal-offbeat-35.jpg', 1120, 1400],
      ['gal-offbeat-36.jpg', 1120, 1400],
      ['gal-offbeat-37.jpg', 1120, 1400],
      ['gal-offbeat-38.jpg', 1120, 1400],
      ['gal-offbeat-39.jpg', 1120, 1400],
      ['gal-offbeat-40.jpg', 1120, 1400],
      ['gal-offbeat-41.jpg', 1120, 1400]
    ],
    firstday: [
      ['gal-firstday-01.jpg', 1400, 1400],
      ['gal-firstday-02.jpg', 1400, 1400],
      ['gal-firstday-03.jpg', 1400, 1400],
      ['gal-firstday-04.jpg', 1400, 1400],
      ['gal-firstday-05.jpg', 1400, 1400],
      ['gal-firstday-06.jpg', 1400, 1400],
      ['gal-firstday-07.jpg', 1400, 1400],
      ['gal-firstday-08.jpg', 1400, 1400],
      ['gal-firstday-09.jpg', 1400, 1400],
      ['gal-firstday-10.jpg', 1080, 1080],
      ['gal-firstday-11.jpg', 1080, 1080],
      ['gal-firstday-12.jpg', 1080, 1080],
      ['gal-firstday-13.jpg', 1080, 1080],
      ['gal-firstday-14.jpg', 1080, 1080],
      ['gal-firstday-15.jpg', 1080, 1080],
      ['gal-firstday-16.jpg', 1080, 1080],
      ['gal-firstday-17.jpg', 1080, 1080],
      ['gal-firstday-18.jpg', 1120, 1400],
      ['gal-firstday-19.jpg', 1120, 1400],
      ['gal-firstday-20.jpg', 1120, 1400],
      ['gal-firstday-21.jpg', 1120, 1400],
      ['gal-firstday-22.jpg', 1120, 1400],
      ['gal-firstday-23.jpg', 1120, 1400],
      ['gal-firstday-24.jpg', 1120, 1400],
      ['gal-firstday-25.jpg', 1400, 1050],
      ['gal-firstday-26.jpg', 1400, 1050],
      ['gal-firstday-27.jpg', 1080, 1350],
      ['gal-firstday-28.jpg', 1080, 1350],
      ['gal-firstday-29.jpg', 1400, 1050],
      ['gal-firstday-30.jpg', 1400, 1050]
    ],
    jamlog: [
      ['gal-jamlog-01.jpg', 596, 595],
      ['gal-jamlog-02.jpg', 842, 842],
      ['gal-jamlog-03.jpg', 596, 596],
      ['gal-jamlog-04.jpg', 596, 596],
      ['gal-jamlog-05.jpg', 596, 596],
      ['gal-jamlog-06.jpg', 596, 596],
      ['gal-jamlog-07.jpg', 596, 596],
      ['gal-jamlog-08.jpg', 596, 596],
      ['gal-jamlog-09.jpg', 597, 596],
      ['gal-jamlog-10.jpg', 842, 842],
      ['gal-jamlog-11.jpg', 1400, 1400],
      ['gal-jamlog-12.jpg', 1400, 1400],
      ['gal-jamlog-13.jpg', 1400, 1400],
      ['gal-jamlog-14.jpg', 1400, 1400],
      ['gal-jamlog-15.jpg', 1399, 1400],
      ['gal-jamlog-16.jpg', 1400, 1400],
      ['gal-jamlog-17.jpg', 1400, 1400],
      ['gal-jamlog-18.jpg', 1400, 1400],
      ['gal-jamlog-19.jpg', 1400, 1400],
      ['gal-jamlog-20.jpg', 1400, 1400],
      ['gal-jamlog-21.jpg', 1400, 1400],
      ['gal-jamlog-22.jpg', 1400, 1400],
      ['gal-jamlog-23.jpg', 1400, 1400],
      ['gal-jamlog-24.jpg', 1400, 1400],
      ['gal-jamlog-25.jpg', 1400, 1400],
      ['gal-jamlog-26.jpg', 1400, 1400],
      ['gal-jamlog-27.jpg', 1400, 1400],
      ['gal-jamlog-28.jpg', 1400, 1400],
      ['gal-jamlog-29.jpg', 1400, 1400],
      ['gal-jamlog-30.jpg', 1400, 1400],
      ['gal-jamlog-31.jpg', 1400, 1400],
      ['gal-jamlog-32.jpg', 1400, 1400],
      ['gal-jamlog-33.jpg', 1400, 1400],
      ['gal-jamlog-34.jpg', 1000, 1000],
      ['gal-jamlog-35.jpg', 1080, 1080],
      ['gal-jamlog-36.jpg', 1000, 1000],
      ['gal-jamlog-37.jpg', 1080, 1080],
      ['gal-jamlog-38.jpg', 1000, 1000],
      ['gal-jamlog-39.jpg', 1000, 1000],
      ['gal-jamlog-40.jpg', 1000, 1000],
      ['gal-jamlog-41.jpg', 1080, 1080],
      ['gal-jamlog-42.jpg', 1000, 1000],
      ['gal-jamlog-43.jpg', 1000, 1000],
      ['gal-jamlog-44.jpg', 1000, 1000],
      ['gal-jamlog-45.jpg', 1000, 1000],
      ['gal-jamlog-46.jpg', 1200, 1200],
      ['gal-jamlog-47.jpg', 1400, 1400],
      ['gal-jamlog-48.jpg', 1000, 1000],
      ['gal-jamlog-49.jpg', 1000, 1000],
      ['gal-jamlog-50.jpg', 1000, 1000],
      ['gal-jamlog-51.jpg', 1400, 1400],
      ['gal-jamlog-52.jpg', 1000, 1000]
    ],
    otherprofile: [
      ['gal-otherprofile-01.jpg', 1400, 1399],
      ['gal-otherprofile-02.jpg', 1400, 1399],
      ['gal-otherprofile-03.jpg', 1400, 1399],
      ['gal-otherprofile-04.jpg', 1400, 1399],
      ['gal-otherprofile-05.jpg', 1400, 1399],
      ['gal-otherprofile-06.jpg', 1400, 1399],
      ['gal-otherprofile-07.jpg', 1400, 1399],
      ['gal-otherprofile-08.jpg', 1400, 1399],
      ['gal-otherprofile-09.jpg', 1400, 1400],
      ['gal-otherprofile-10.jpg', 1400, 1399],
      ['gal-otherprofile-11.jpg', 1400, 1399],
      ['gal-otherprofile-12.jpg', 1400, 1399],
      ['gal-otherprofile-13.jpg', 1400, 1399],
      ['gal-otherprofile-14.jpg', 1400, 1399],
      ['gal-otherprofile-15.jpg', 1400, 1399],
      ['gal-otherprofile-16.jpg', 1400, 1399],
      ['gal-otherprofile-17.jpg', 1400, 1399],
      ['gal-otherprofile-18.jpg', 1400, 1399],
      ['gal-otherprofile-19.jpg', 1400, 1399],
      ['gal-otherprofile-20.jpg', 1400, 1399],
      ['gal-otherprofile-21.jpg', 1400, 1399],
      ['gal-otherprofile-22.jpg', 1400, 1399],
      ['gal-otherprofile-23.jpg', 1400, 1399],
      ['gal-otherprofile-24.jpg', 1400, 1399],
      ['gal-otherprofile-25.jpg', 1400, 1399],
      ['gal-otherprofile-26.jpg', 1400, 1399],
      ['gal-otherprofile-27.jpg', 1400, 1399],
      ['gal-otherprofile-28.jpg', 1400, 1399]
    ],
    film: [
      ['gal-film-03.jpg', 1400, 1400],
      ['gal-film-04.jpg', 1400, 1400],
      ['gal-film-05.jpg', 1400, 1400],
      ['gal-film-06.jpg', 1400, 1400],
      ['gal-film-07.jpg', 1400, 1400],
      ['gal-film-08.jpg', 1400, 1400],
      ['gal-film-09.jpg', 1400, 1400],
      ['gal-film-10.jpg', 1400, 1400],
      ['gal-film-11.jpg', 1400, 467],
      ['gal-film-12.jpg', 1400, 467],
      ['gal-film-13.jpg', 1170, 390],
      ['gal-film-14.jpg', 1400, 467],
      ['gal-film-15.jpg', 1400, 467]
    ],
    busking: [
      ['gal-busking-01.jpg', 1280, 960],
      ['gal-busking-02.jpg', 1400, 1050],
      ['gal-busking-03.jpg', 1400, 1050],
      ['gal-busking-04.jpg', 1400, 1050],
      ['gal-busking-05.jpg', 1400, 1050],
      ['gal-busking-06.jpg', 984, 737],
      ['gal-busking-07.jpg', 1156, 867],
      ['gal-busking-08.jpg', 1280, 960],
      ['gal-busking-09.jpg', 1163, 872],
      ['gal-busking-10.jpg', 1013, 760],
      ['gal-busking-11.jpg', 782, 587],
      ['gal-busking-12.jpg', 1400, 1050],
      ['gal-busking-13.jpg', 1080, 1080]
    ],
    livepub: [
      ['gal-livepub-01.jpg', 1400, 933]
    ],
    interview: [
      ['gal-interview-01.jpg', 1400, 1400],
      ['gal-interview-02.jpg', 1400, 1400],
      ['gal-interview-03.jpg', 1400, 1400],
      ['gal-interview-04.jpg', 1400, 1400],
      ['gal-interview-05.jpg', 1400, 1400],
      ['gal-interview-06.jpg', 1400, 1400],
      ['gal-interview-07.jpg', 1400, 1400],
      ['gal-interview-08.jpg', 1400, 1400],
      ['gal-interview-09.jpg', 1400, 1400],
      ['gal-interview-10.jpg', 1400, 1400],
      ['gal-interview-11.jpg', 1400, 1400],
      ['gal-interview-12.jpg', 1400, 1400],
      ['gal-interview-13.jpg', 1400, 1400],
      ['gal-interview-14.jpg', 1400, 1400],
      ['gal-interview-15.jpg', 1400, 1400],
      ['gal-interview-16.jpg', 1400, 1400],
      ['gal-interview-17.jpg', 1400, 1400],
      ['gal-interview-18.jpg', 1400, 1400],
      ['gal-interview-19.jpg', 1400, 1400],
      ['gal-interview-20.jpg', 1400, 1400],
      ['gal-interview-21.jpg', 1400, 1400]
    ]
  };
  const IG = 'https://www.instagram.com/play_cheonggi/';
  const YT = 'https://www.youtube.com/@cheong-gi3039';
  // date: 그 활동의 가장 최근 날짜 — 카드는 이 날짜 기준 최신순으로 놓입니다
  const NOTES = [
    {
      key: 'jam', label: 'JAM', date: '2026.09.27', file: 'act-04.jpg',
      title: '매주 일요일, 합주실',
      body: '홍대·합정·신촌 인근 합주실에서 매주 일요일. 하고 싶은 곡을 함께 고르고 합을 맞추며, 그 현장을 세션별 사진으로 기록합니다.',
      more: 'YOUTUBE', href: YT
    },
    {
      key: 'recruit', label: 'RECRUIT', date: '2026.08.15', file: 'act-06.jpg',
      title: '새 멤버를 기다리며',
      body: '학기마다 음악팀과 기획홍보팀 신입 부원을 모집합니다. 모집 포스터도 매번 기획홍보팀이 새로 만들어요.',
      more: 'APPLY', href: 'https://linktr.ee/Chunggi'
    },
    {
      key: 'stage', label: 'ON STAGE', date: '2026.08.09', file: 'act-05.jpg',
      title: '무대 위의 청기',
      body: '한 학기의 끝은 정기공연. 매주 맞춰 온 합을 조명 아래에서 보여 주고, 마지막 곡이 끝나면 다 같이 무대 위로.',
      more: 'YOUTUBE', href: YT
    },
    {
      key: 'making', label: 'MAKING', date: '2026.07.14', file: 'act-08.jpg',
      title: '공연을 만드는 사람들',
      body: '프로모션 캘린더와 티켓, 이벤트, MD, 거리에 붙인 포스터까지. 정기공연을 알리는 모든 디자인은 기획홍보팀이 직접 만듭니다.',
      more: 'INSTAGRAM', href: IG
    },
    {
      key: 'playlist', label: 'PLAYLIST', date: '2026.06.24', file: 'act-11.jpg',
      title: '청기의 플레이리스트',
      body: '매달, 계절마다 부원들이 고른 노래를 모아 플레이리스트를 만듭니다. 공부할 때, 여름을 시작할 때, 할로윈에도.',
      more: 'YOUTUBE', href: YT
    },
    {
      key: 'play', label: 'PLAYGROUND', date: '2026.06.03', file: 'act-09.jpg',
      title: '밸런스 게임 & 마니또',
      body: '파트별로 서로의 선택을 맞혀 보는 밸런스 게임, 몰래 챙겨 주는 마니또. 합주 밖에서도 서로를 알아 갑니다.',
      more: 'INSTAGRAM', href: IG
    },
    {
      key: 'friends', label: 'FRIENDS', date: '2026.04.21', file: 'act-03.jpg',
      title: '한강 나들이',
      body: '음악만큼 사람이 좋아서 모였습니다. 봄에는 한강에서 기타를 치고, 합주가 끝나면 뒤풀이로 이어집니다.',
      more: 'INSTAGRAM', href: IG
    },
    {
      key: 'yearend', label: 'YEAR-END', date: '2026.01.03', file: 'act-07.jpg',
      title: '2025 연말 결산',
      body: '가장 사랑받은 노래와 가장 어려웠던 노래, 최다 합주곡부터 최고의 분위기메이커상까지. 부원들이 직접 뽑았습니다.',
      more: 'INSTAGRAM', href: IG
    },
    {
      key: 'story', label: 'STORY', date: '2025.11.14', file: 'act-10.jpg',
      title: '청기가 말아주는 수능썰',
      body: '수능을 졸업한 청기 멤버들이 꺼내 놓은 그날의 이야기. 수험생들에게 보내는 작은 응원입니다.',
      more: 'INSTAGRAM', href: IG
    },
    {
      key: 'bag', label: 'GEAR & GROOVES', date: '2025.07.01', file: 'act-13.jpg',
      title: '청기의 가방 속',
      body: '합주 가방에 늘 들어 있는 것, 없으면 합주가 안 되는 것. 부원들의 가방을 열어 봤습니다.',
      more: 'INSTAGRAM', href: IG
    },
    {
      key: 'offbeat', label: 'OFF BEAT', date: '2025.06.20', file: 'act-02.jpg',
      title: '청기는 요즘 뭐 듣는데?',
      body: '일반적인 흐름을 벗어난, 개성 있는 음악 이야기. 페스티벌과 리스닝 팝업, 앨범 커버, 밴드 MD, 악기 추천까지.',
      more: 'INSTAGRAM', href: IG
    },
    {
      key: 'firstday', label: 'FIRST DAY', date: '2025.04.02', file: 'act-12.jpg',
      title: '첫 만남',
      body: '학기의 시작은 OT와 첫 합주. 설렘 반 어색함 반으로 악기를 꺼내면, 수줍음은 금방 사라집니다.',
      more: 'INSTAGRAM', href: IG
    },
    {
      key: 'jamlog', label: 'JAM LOG', date: '2025.02.13', file: 'act-15.jpg',
      title: '합주 일기와 방명록',
      body: '합주가 끝나면 그날의 셋리스트와 방명록, 한 사람의 합주 일기를 남겼습니다. 한 주 한 주가 쌓여 한 학기가 됩니다.',
      more: 'INSTAGRAM', href: IG
    },
    {
      key: 'otherprofile', label: 'PROFILE', date: '2025.02.11', file: 'act-14.jpg',
      title: '남이 쓰는 프로필',
      body: '내가 쓰는 소개 대신, 함께 합주한 친구가 써 주는 나. 취향을 모은 한 장과 한 줄 매력 포인트, 첫인상까지.',
      more: 'INSTAGRAM', href: IG
    },
    {
      key: 'film', label: 'FILM', date: '2024.12.09', file: 'act-16.jpg',
      title: '청기가 만든 영상',
      body: '기수 소개 영상과 공연 현장 영상, 트레일러, 아트필름, 브이로그까지. 기획홍보팀이 직접 찍고 편집합니다.',
      more: 'YOUTUBE', href: YT
    },
    {
      key: 'busking', label: 'BUSKING', date: '2022.11.20', file: 'act-19.jpg',
      title: '한강 버스킹',
      body: '2022년 11월, 여의도 한강공원 다리 밑. 11월인데도 춥지 않았던 저녁, 해가 질 때까지 연주했습니다.',
      more: 'INSTAGRAM', href: IG
    },
    {
      key: 'livepub', label: 'LIVE PUB', date: '2024.07.13', file: 'act-17.jpg',
      title: '라이브펍 공연',
      body: '2024년 7월 13일, 안암 대디제이. 정기공연보다 가까운 거리의 무대에서, 관객에게도 50분 동안 무대를 열었습니다.',
      more: 'INSTAGRAM', href: IG
    },
    {
      key: 'interview', label: 'INTERVIEW', date: '2024.05.22', file: 'act-18.jpg',
      title: '부원 인터뷰',
      body: '부원이 부원을 인터뷰합니다. 〈그는 기타와 14년을 보냈다〉, 〈3대 470이 치는 건반의 무게는〉 같은 이야기들.',
      more: 'INSTAGRAM', href: IG
    }
  ].sort((x, y) => y.date.localeCompare(x.date));

  // ---- 사진 창 ----
  const galEl = document.getElementById('gal');
  const zoomEl = galEl && galEl.querySelector('.gal__zoom');
  let galOpen = false, galList = [], galZoomAt = -1, galTimer = 0, galFocus = null;
  const isGalOpen = () => galOpen;
  const thumbOf = (f) => f.replace(/\.jpg$/, '-t.jpg');
  // 줄 수: 폰 2 · 태블릿 3 · PC 4 — 사진이 그보다 적으면 사진 수만큼(빈 줄 없이)
  const galCols = () => Math.min(innerWidth <= 560 ? 2 : innerWidth <= 1024 ? 3 : 4, Math.max(2, galList.length));

  // 가장 짧은 줄에 다음 사진을 놓는 벽돌 배치 — 순서가 왼쪽→오른쪽으로 이어져 펼쳐짐이 물결처럼 보입니다
  function layoutGal(items) {
    const grid = galEl.querySelector('.gal__grid');
    const n = galCols();
    grid.innerHTML = '';
    const cols = [], hs = [];
    for (let i = 0; i < n; i++) {
      const col = document.createElement('div');
      col.className = 'gal__col';
      grid.appendChild(col);
      cols.push(col);
      hs.push(0);
    }
    items.forEach((it) => {
      const k = hs.indexOf(Math.min(...hs));
      cols[k].appendChild(it.el);
      hs[k] += it.h / it.w + 0.03;
    });
    grid.dataset.cols = n;
  }

  function openGal(n) {
    if (!galEl) return;
    const photos = GAL[n.key] || [];
    galEl.querySelector('.gal__label').textContent = `ACTIVITY · ${n.label}`;
    galEl.querySelector('.gal__title').textContent = n.title;
    galEl.querySelector('.gal__count').textContent = `${photos.length} PHOTOS`;
    galList = photos.map(([f, w, h], i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'gal__item';
      b.setAttribute('aria-label', `${n.title} 사진 ${i + 1} 크게 보기`);
      const img = document.createElement('img');
      img.src = imgSrc(thumbOf(f));
      img.width = w;
      img.height = h;
      img.alt = `${n.label} ${i + 1}`;
      img.decoding = 'async';
      b.appendChild(img);
      b.addEventListener('click', () => zoomGal(i));
      return { el: b, f, w, h };
    });
    layoutGal(galList);
    galFocus = document.activeElement;
    galEl.hidden = false;
    galEl.scrollTop = 0;
    galOpen = true;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      galEl.classList.add('is-open');
      // 좌르륵 — 한 장씩 시간차로 아래에서 올라오며 펼쳐집니다
      galList.forEach((it, i) => {
        it.el.style.transitionDelay = `${200 + Math.min(i, 24) * 70}ms`;
        it.el.classList.add('is-in');
      });
    }));
    clearTimeout(galTimer);
    galTimer = setTimeout(() => galList.forEach((it) => { it.el.style.transitionDelay = ''; }),
      200 + Math.min(galList.length, 24) * 70 + 1200);
    galEl.querySelector('.gal__close').focus({ preventScroll: true });
  }

  function closeGal() {
    if (!galOpen) return;
    if (galZoomAt >= 0) { unzoomGal(); return; }   // 크게 보기 중이면 그것만 닫음
    galOpen = false;
    galEl.classList.remove('is-open');
    setTimeout(() => {
      if (galOpen) return;
      galEl.hidden = true;
      galEl.querySelector('.gal__grid').innerHTML = '';
    }, 450);
    if (galFocus) galFocus.focus({ preventScroll: true });
  }

  function zoomGal(i) {
    galZoomAt = (i + galList.length) % galList.length;
    const it = galList[galZoomAt];
    const img = zoomEl.querySelector('img');
    img.src = imgSrc(it.f);
    img.alt = it.el.querySelector('img').alt;
    zoomEl.querySelector('.gal__pos').textContent = `${galZoomAt + 1} / ${galList.length}`;
    if (zoomEl.hidden) {
      zoomEl.hidden = false;
      requestAnimationFrame(() => requestAnimationFrame(() => zoomEl.classList.add('is-open')));
    }
  }

  function unzoomGal() {
    const at = galZoomAt;
    galZoomAt = -1;
    zoomEl.classList.remove('is-open');
    setTimeout(() => { if (galZoomAt < 0) zoomEl.hidden = true; }, 350);
    if (galList[at]) galList[at].el.focus({ preventScroll: true });
  }

  if (galEl) {
    galEl.querySelector('.gal__close').addEventListener('click', closeGal);
    zoomEl.querySelector('img').addEventListener('click', unzoomGal);
    zoomEl.addEventListener('click', (e) => { if (e.target === zoomEl) unzoomGal(); });
    zoomEl.querySelector('.gal__nav--prev').addEventListener('click', () => zoomGal(galZoomAt - 1));
    zoomEl.querySelector('.gal__nav--next').addEventListener('click', () => zoomGal(galZoomAt + 1));
    addEventListener('keydown', (e) => {
      if (!galOpen) return;
      if (e.key === 'Escape') closeGal();
      else if (galZoomAt >= 0 && e.key === 'ArrowLeft') zoomGal(galZoomAt - 1);
      else if (galZoomAt >= 0 && e.key === 'ArrowRight') zoomGal(galZoomAt + 1);
    });
    // 크게 보기에서 옆으로 밀어 넘기기
    let zx = 0, zy = 0;
    zoomEl.addEventListener('touchstart', (e) => { zx = e.touches[0].clientX; zy = e.touches[0].clientY; }, { passive: true });
    zoomEl.addEventListener('touchend', (e) => {
      const dx = e.changedTouches[0].clientX - zx, dy = e.changedTouches[0].clientY - zy;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) zoomGal(galZoomAt + (dx < 0 ? 1 : -1));
    }, { passive: true });
    // 화면 폭이 바뀌어 줄 수가 달라지면 다시 배치
    addEventListener('resize', () => {
      if (galOpen && String(galCols()) !== galEl.querySelector('.gal__grid').dataset.cols) layoutGal(galList);
    });
  }

  const notesGrid = document.getElementById('notes-grid');
  if (notesGrid) {
    NOTES.forEach((n) => {
      const count = (GAL[n.key] || []).length;
      const el = document.createElement('article');
      el.className = 'note';
      el.setAttribute('data-reveal', '');
      const ph = document.createElement('button');
      ph.type = 'button';
      ph.className = 'note__ph';
      ph.dataset.count = `${count} PHOTOS`;
      ph.setAttribute('aria-label', `${n.label} ${n.title} 사진 ${count}장 보기`);
      ph.appendChild(makeImg(`assets/img/${n.file}`, n.label, 800, 1000, `${n.label} — ${n.title}`));
      ph.addEventListener('click', () => openGal(n));
      const text = document.createElement('div');
      text.className = 'note__text';
      text.innerHTML =
        `<p class="note__date">${n.label}<span class="note__when">${n.date.slice(0, 7)}</span></p>` +
        `<h3><button type="button">${n.title}</button></h3>` +
        `<p>${n.body}</p>` +
        `<div class="note__links"><button type="button" class="note__more">PHOTOS ${count} +</button>` +
        `<a class="note__more note__more--dim" href="${n.href}" target="_blank" rel="noopener">${n.more} &#8599;</a></div>`;
      text.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => openGal(n)));
      el.appendChild(ph);
      el.appendChild(text);
      notesGrid.appendChild(el);
    });
  }

  /* =========================================================
     4-1. FAQ — 질문을 누르면 답이 펼쳐지고, 다른 질문은 접힘 · 왼쪽 분류는 스크롤 위치를 따라감
     ========================================================= */
  document.querySelectorAll('.faq__q').forEach((btn) => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.faq__item');
      const open = !item.classList.contains('is-open');
      document.querySelectorAll('.faq__item.is-open').forEach((it) => {
        it.classList.remove('is-open');
        it.querySelector('.faq__q').setAttribute('aria-expanded', 'false');
      });
      item.classList.toggle('is-open', open);
      btn.setAttribute('aria-expanded', String(open));
    });
  });
  const faqPanel = document.getElementById('faq');
  if (faqPanel) {
    const navLinks = Array.from(faqPanel.querySelectorAll('.faq__nav-link'));
    const setFaqNav = (id) => navLinks.forEach((l) => l.classList.toggle('is-active', l.dataset.faq === id));
    navLinks.forEach((l) => l.addEventListener('click', (e) => {
      e.preventDefault();
      const g = document.getElementById('faq-' + l.dataset.faq);
      faqPanel.scrollTo({ top: faqPanel.scrollTop + g.getBoundingClientRect().top - (innerWidth <= 760 ? 80 : 120), behavior: 'smooth' });
      setFaqNav(l.dataset.faq);
    }));
    faqPanel.addEventListener('scroll', () => {
      let cur = navLinks[0].dataset.faq;
      faqPanel.querySelectorAll('.faq__group').forEach((g) => { if (g.getBoundingClientRect().top < innerHeight * 0.45) cur = g.id.slice(4); });
      setFaqNav(cur);
    }, { passive: true });
  }

  /* =========================================================
     4-2. ABOUT — WHAT WE DO(마우스를 올리거나 스크롤로 가운데 온 단어 → 사진 교체) · 숫자 카운트업
     ========================================================= */
  const aboutPanel = document.getElementById('about');
  if (aboutPanel) {
    const items = Array.from(aboutPanel.querySelectorAll('.what__item'));
    const imgs = Array.from(aboutPanel.querySelectorAll('.what__img'));
    let hoverWhat = false;
    const setWhat = (it) => {
      if (!it || it.classList.contains('is-active')) return;
      items.forEach((x) => x.classList.toggle('is-active', x === it));
      imgs.forEach((im) => im.classList.toggle('is-active', im.dataset.what === it.dataset.what));
    };
    items.forEach((it) => {
      it.addEventListener('mouseenter', () => { hoverWhat = true; setWhat(it); });
      it.addEventListener('mouseleave', () => { hoverWhat = false; });
    });
    aboutPanel.addEventListener('scroll', () => {
      if (hoverWhat || innerWidth <= 760) return;
      let best = null, bestD = Infinity;
      items.forEach((it) => {
        const b = it.getBoundingClientRect();
        if (b.bottom < 0 || b.top > innerHeight) return;
        const d = Math.abs((b.top + b.bottom) / 2 - innerHeight * 0.5);
        if (d < bestD) { bestD = d; best = it; }
      });
      setWhat(best);
    }, { passive: true });
  }
  // 숫자 — 화면에 등장할 때 data-from(없으면 0)부터 data-countup 까지 1.6초 동안 올라감 (ACTIVITY 카드의 data-count 와 겹치지 않게 다른 이름)
  function countUp(root) {
    root.querySelectorAll('[data-countup]').forEach((el) => {
      const to = +el.dataset.countup, from = +(el.dataset.from || 0), t0 = performance.now(), dur = 1600;
      const tick = (now) => {
        const p = Math.min((now - t0) / dur, 1), e = 1 - Math.pow(1 - p, 4);
        el.textContent = Math.round(from + (to - from) * e) + (el.dataset.suffix || '');
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }

  /* =========================================================
     5. 패널 전환 — 상단 네비게이션 전용
     ========================================================= */
  const panels = Array.from(document.querySelectorAll('.panel'));
  const links = Array.from(document.querySelectorAll('[data-panel]'));
  const ids = panels.map((p) => p.id);
  let currentId = 'home';

  // 등장 효과 — 화면에 보이는 것은 차례로, 아래(또는 옆)에 가려진 것은 스크롤해서 보일 때 등장합니다
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let revealTimer = 0, revealIO = null, firstReveal = true;
  function reveal(panel, wait) {
    clearTimeout(revealTimer);
    if (revealIO) revealIO.disconnect();
    // 1) 먼저 모두 숨긴 상태로 되돌림 (나가는 화면에 가려 있는 동안)
    panel.classList.remove('is-shown', 'is-replay');
    panel.querySelectorAll('.split').forEach((t) => t.classList.remove('is-rise'));
    const els = Array.from(panel.querySelectorAll('[data-reveal]'));
    els.forEach((el) => { el.classList.remove('is-in'); el.style.transitionDelay = ''; el.style.removeProperty('--d'); });
    // 2) 걷히기 시작할 즈음 등장
    const go = () => {
      void panel.offsetWidth;
      panel.classList.add('is-shown');
      panel.querySelectorAll('.split').forEach((t) => t.classList.add('is-rise'));
      if (panel.id === 'home' && !firstReveal) {
        // 홈 제목 글자를 다시 솟아오르게 + 사진 줄 열기
        const chars = panel.querySelectorAll('.hero__title .char');
        chars.forEach((ch) => { ch.style.animation = 'none'; });
        void panel.offsetWidth;
        chars.forEach((ch) => { ch.style.animation = ''; });
        panel.classList.add('is-replay');
      }
      firstReveal = false;
      const show1 = (el, ms) => {
        el.style.transitionDelay = ms + 'ms';
        el.style.setProperty('--d', ms + 'ms');
        el.classList.add('is-in');
        countUp(el);
      };
      // 아직 안 보인 요소 — 스크롤(패널 · 가로 레일)할 때 화면에 들어왔거나 이미 지나친 것을 등장시킴
      let pending = [];
      const check = () => {
        pending = pending.filter((el) => {
          const r = el.getBoundingClientRect();
          if (r.top < innerHeight * 0.94 && r.left < innerWidth * 0.98) { show1(el, 0); return false; }
          return true;
        });
        if (!pending.length) stopWatch();
      };
      let ticking = false;
      const onScroll = () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => { ticking = false; check(); });
      };
      const stopWatch = () => panel.removeEventListener('scroll', onScroll, true);
      revealIO = { disconnect: stopWatch };
      requestAnimationFrame(() => {
        let k = 0;
        els.forEach((el) => {
          const r = el.getBoundingClientRect();
          const inView = r.bottom > 0 && r.top < innerHeight * 0.96 && r.left < innerWidth && r.right > 0;
          if (inView) show1(el, 120 + Math.min(k++, 10) * 90);
          else pending.push(el);
        });
        if (pending.length) panel.addEventListener('scroll', onScroll, { capture: true, passive: true });
      });
    };
    if (wait) revealTimer = setTimeout(go, wait);
    else go();
  }

  function show(id, updateHash) {
    if (!ids.includes(id) || id === currentId) return;
    const prev = document.getElementById(currentId);
    currentId = id;
    document.body.dataset.panel = id;
    document.body.classList.remove('is-scrolled');
    // 나가는 화면: 어두워진 뒤 위로 걷힘 (styles.css .is-leaving)
    panels.forEach((p) => { if (p !== prev) p.classList.remove('is-leaving'); });
    if (prev && !reduceMotion) {
      prev.classList.remove('is-leaving');
      void prev.offsetWidth;
      prev.classList.add('is-leaving');
      clearTimeout(prev._leaveT);
      prev._leaveT = setTimeout(() => prev.classList.remove('is-leaving'), 1050);
    }
    panels.forEach((p) => p.classList.toggle('is-active', p.id === id));
    links.forEach((a) => {
      if (a.dataset.panel === id) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    const panel = document.getElementById(id);
    if (id === 'home' && prev) replayStrip();   // 나가는 화면에 가려 있는 동안 출발 위치로
    panel.scrollTop = 0;
    const r = panel.querySelector('.rail');
    if (r) r.scrollLeft = 0;
    reveal(panel, prev && !reduceMotion ? 420 : 0);
    if (updateHash !== false) history.replaceState(null, '', '#' + id);
  }

  links.forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      show(a.dataset.panel);
    });
  });
  addEventListener('hashchange', () => show(location.hash.slice(1), false));

  document.body.dataset.panel = 'home';
  // 메뉴 아래 흐림 띠 — 지금 화면을 아래로 내렸을 때만 보임
  panels.forEach((p) => p.addEventListener('scroll', () => {
    if (p.id === currentId) document.body.classList.toggle('is-scrolled', p.scrollTop > 8);
  }, { passive: true }));
  const initial = location.hash.slice(1);
  if (ids.includes(initial) && initial !== 'home') show(initial, false);
  else document.querySelector('[data-panel="home"]').setAttribute('aria-current', 'page');
  // 첫 화면의 등장 효과는 로딩 화면이 다 걷힌 뒤에
  onReady = () => reveal(document.getElementById(currentId));

  /* =========================================================
     6. 휠 / 터치 — 세로 스크롤 대신 가로 이동
     ========================================================= */
  addEventListener('wheel', (e) => {
    if (isShowOpen() || isGalOpen()) return;   // 공연 상세 창 · 사진 창은 창 안에서 기본 스크롤
    const panel = document.getElementById(currentId);
    if (!panel) return;
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;

    if (currentId === 'home') {            // 히어로 이미지 스트립
      e.preventDefault();
      pushStrip(delta);
      return;
    }
    const r = panel.querySelector('.rail');
    if (r) {                                // 프로젝트 가로 레일
      e.preventDefault();
      r.scrollLeft += delta;
      return;
    }
    // 화면보다 내용이 긴 경우에만 패널 안에서 이동 (스크롤바는 숨김)
    if (panel.scrollHeight <= panel.clientHeight) e.preventDefault();
  }, { passive: false });

  // 홈 사진 터치 감도 — 옆으로 밀면 손가락 방향 그대로, 위아래로 밀면 휠과 같은 방향으로 움직입니다.
  // 손을 떼면 마지막 속도만큼 더 미끄러집니다(관성).
  const TOUCH_GAIN_X = 1.8;    // 옆으로 밀 때: 손가락 1px 당 이동량
  const TOUCH_GAIN_Y = 2.6;    // 위아래로 밀 때
  const FLING_MS = 280;        // 관성: 손을 뗀 순간 속도로 몇 ms 만큼 더 갈지
  let touchX = 0, touchY = 0, touchT = 0, flingV = 0;
  let touchOnHome = false;   // 홈 화면(사진·제목) 위에서 시작한 터치만 사진을 움직이고 자동 흐름을 멈춥니다 — 메뉴 버튼·메뉴는 제외
  addEventListener('touchstart', (e) => {
    touchOnHome = currentId === 'home' && !!e.target.closest('#home');
    touchX = e.touches[0].clientX;
    touchY = e.touches[0].clientY;
    touchT = performance.now();
    flingV = 0;
    if (touchOnHome) holdStrip(true);
  }, { passive: true });
  addEventListener('touchmove', (e) => {
    const { clientX: x, clientY: y } = e.touches[0];
    const dx = touchX - x, dy = touchY - y;
    const now = performance.now(), dt = Math.max(now - touchT, 1);
    touchX = x; touchY = y; touchT = now;
    const sideways = Math.abs(dx) > Math.abs(dy);
    const panel = document.getElementById(currentId);
    if (currentId === 'home') {
      if (!touchOnHome) return;
      const move = sideways ? dx * TOUCH_GAIN_X : dy * TOUCH_GAIN_Y;
      pushStrip(move, 1);
      flingV = flingV * 0.6 + (move / dt) * 0.4;   // 최근 속도(px/ms)를 부드럽게 추적
      return;
    }
    // 프로젝트 레일은 옆으로 밀 때 브라우저 기본 스크롤에 맡기고, 위아래만 가로로 바꿔 줍니다
    const r = panel && panel.querySelector('.rail');
    if (r && !sideways && !isShowOpen() && !isGalOpen()) r.scrollLeft += dy * 1.6;
  }, { passive: true });
  addEventListener('touchend', () => {
    // 손가락이 멈춘 뒤 떼었으면(100ms 이상 정지) 관성 없음
    if (!touchOnHome) return;
    if (performance.now() - touchT < 100) pushStrip(flingV * FLING_MS, 1);
    flingV = 0;
    holdStrip(false);
  }, { passive: true });

  if (imgTotal === 0) finish();

  /* =========================================================
     7. 모바일 메뉴
     ========================================================= */
  const burger = document.getElementById('burger');
  const menu = document.getElementById('menu');
  const setMenu = (open) => {
    menu.hidden = !open;
    burger.setAttribute('aria-expanded', String(open));
  };
  menu.querySelectorAll('a').forEach((a, k) => a.style.setProperty('--k', k));
  burger.addEventListener('click', () => setMenu(menu.hidden));
  menu.addEventListener('click', (e) => {
    if (e.target.tagName === 'A') setMenu(false);
  });
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !menu.hidden) setMenu(false);
  });
})();
