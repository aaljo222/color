/* Deterministic, area-preserving jogakbo composition and textile rendering. */
(function (root) {
  'use strict';

  const ELEMENTS = ['목', '화', '토', '금', '수'];
  const STEM_ELEMENTS = { 갑: '목', 을: '목', 병: '화', 정: '화', 무: '토', 기: '토', 경: '금', 신: '금', 임: '수', 계: '수' };
  const FALLBACK_COLORS = { 목: '#A7BDA4', 화: '#DBA09A', 토: '#D3BF96', 금: '#E7E2D8', 수: '#A4B8C5' };
  const TOPIC_OFFSETS = { 비견: 0, 겁재: 0, 식신: 1, 상관: 1, 편재: 2, 정재: 2, 편관: 3, 정관: 3, 편인: 4, 정인: 4 };

  function seededRandom(seed) {
    let value = parseInt(seed.slice(0, 8), 16) || 1;
    return () => {
      value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
      return value / 4294967296;
    };
  }

  function mix(source, target, amount) {
    const parts = [1, 3, 5].map((offset) => {
      const from = parseInt(source.slice(offset, offset + 2), 16);
      const to = parseInt(target.slice(offset, offset + 2), 16);
      return Math.round(from + (to - from) * amount).toString(16).padStart(2, '0');
    });
    return `#${parts.join('')}`;
  }

  function paletteForReport(report) {
    const palette = { ...FALLBACK_COLORS };
    const day = report.colors.find((color) => color.role === '고유색');
    const dayElement = STEM_ELEMENTS[day.basis];
    const dayIndex = ELEMENTS.indexOf(dayElement);
    // Priority: unique color, talent, relationship, then the balance color.
    // Several roles can refer to one element; keep one hue per element.
    const assigned = new Set();
    report.colors.forEach((color) => {
      const element = color.role === '고유색' ? dayElement
        : color.role === '균형색' ? color.basis
          : ELEMENTS[(dayIndex + TOPIC_OFFSETS[color.basis]) % 5];
      if (!assigned.has(element)) {
        palette[element] = color.hex;
        assigned.add(element);
      }
    });
    return palette;
  }

  function buildLayout(report) {
    const random = seededRandom(report.pattern_seed);
    const family = report.pattern_family?.key || 'weave';
    const pieces = [];
    const total = ELEMENTS.reduce((sum, element) => sum + report.visual_composition[element], 0);
    if (total !== 6 && total !== 8) throw new Error('조각보는 6칸 또는 8칸 구성이 필요합니다.');
    ELEMENTS.forEach((element) => {
      const count = report.visual_composition[element];
      if (!count) return;
      const partCount = Math.max(2, count * (family === 'quiet' ? 2 : 3));
      const weights = Array.from({ length: partCount }, () => .28 + random() * 1.35);
      const sum = weights.reduce((value, weight) => value + weight, 0);
      weights.forEach((weight) => pieces.push({ element, weight: (count / total) * (weight / sum) }));
    });
    for (let index = pieces.length - 1; index > 0; index -= 1) {
      const other = Math.floor(random() * (index + 1));
      [pieces[index], pieces[other]] = [pieces[other], pieces[index]];
    }
    const layout = [];
    function split(items, x, y, width, height, depth) {
      if (items.length === 1) {
        layout.push({ ...items[0], x, y, width, height, grain: random(), shade: random() });
        return;
      }
      const cut = Math.max(1, Math.min(items.length - 1, Math.round(items.length * (.32 + random() * .36))));
      const left = items.slice(0, cut);
      const right = items.slice(cut);
      const leftWeight = left.reduce((sum, item) => sum + item.weight, 0);
      const fullWeight = items.reduce((sum, item) => sum + item.weight, 0);
      const ratio = leftWeight / fullWeight;
      const aspect = family === 'ribbon' ? .8 : family === 'window' ? 1.3 : 1;
      let vertical = width / height > aspect;
      if (width / height > .7 && width / height < 1.5 && random() > .57) vertical = !vertical;
      if (depth === 0 && family === 'courtyard') vertical = false;
      if (vertical) {
        split(left, x, y, width * ratio, height, depth + 1);
        split(right, x + width * ratio, y, width * (1 - ratio), height, depth + 1);
      } else {
        split(left, x, y, width, height * ratio, depth + 1);
        split(right, x, y + height * ratio, width, height * (1 - ratio), depth + 1);
      }
    }
    split(pieces, 0, 0, 1, 1, 0);
    return layout;
  }

  function drawFabric(context, rectangle, color, random) {
    const { x, y, width, height, grain, shade } = rectangle;
    context.save();
    context.beginPath();
    context.rect(x, y, width, height);
    context.clip();
    const base = mix(color, '#fff8e9', .06 + shade * .12);
    const silk = context.createLinearGradient(x, y, x + width, y + height);
    silk.addColorStop(0, mix(base, '#fffdf5', .08));
    silk.addColorStop(.4, base);
    silk.addColorStop(1, mix(base, '#403128', .055));
    context.fillStyle = silk;
    context.fillRect(x, y, width, height);

    // Fine warp and weft evoke mo시 without changing the element areas.
    for (let offset = 1; offset < width; offset += 3.6) {
      context.beginPath();
      context.moveTo(x + offset, y);
      context.lineTo(x + offset, y + height);
      context.strokeStyle = offset % 9 < 4 ? 'rgba(255,252,238,.13)' : 'rgba(57,39,29,.045)';
      context.lineWidth = .7;
      context.stroke();
    }
    for (let offset = 2; offset < height; offset += 4.7) {
      context.beginPath();
      context.moveTo(x, y + offset);
      context.lineTo(x + width, y + offset);
      context.strokeStyle = 'rgba(255,252,238,.11)';
      context.lineWidth = .9;
      context.stroke();
    }
    for (let index = 0; index < 16; index += 1) {
      const fiberX = x + random() * width;
      const fiberY = y + random() * height;
      context.beginPath();
      context.moveTo(fiberX, fiberY);
      context.lineTo(fiberX + (grain > .5 ? 30 : 1), fiberY + (grain > .5 ? 1 : 30));
      context.strokeStyle = 'rgba(255,255,255,.16)';
      context.lineWidth = 1;
      context.stroke();
    }

    // Folded seam: a translucent overlap, a shadow, and two fine stitch rows.
    context.fillStyle = 'rgba(47,32,23,.08)';
    context.fillRect(x, y, 7, height);
    context.fillRect(x, y, width, 6);
    context.strokeStyle = 'rgba(255,250,233,.64)';
    context.lineWidth = 1.2;
    context.strokeRect(x + 4, y + 4, Math.max(0, width - 8), Math.max(0, height - 8));
    context.setLineDash([3.2, 4.2]);
    context.strokeStyle = 'rgba(255,251,235,.76)';
    context.lineWidth = .9;
    context.strokeRect(x + 8, y + 8, Math.max(0, width - 16), Math.max(0, height - 16));
    context.restore();
  }

  function draw(canvas, report) {
    const context = canvas.getContext('2d');
    const palette = paletteForReport(report);
    const layout = buildLayout(report);
    const random = seededRandom(report.pattern_seed.slice(8) + report.pattern_seed.slice(0, 8));
    const byRole = Object.fromEntries(report.colors.map((color) => [color.role, color]));
    const { width, height } = canvas;
    const unit = width / 1600;
    context.clearRect(0, 0, width, height);
    context.save();
    context.scale(unit, unit);
    const paper = context.createLinearGradient(0, 0, 1600, 2000);
    paper.addColorStop(0, '#fffcf6');
    paper.addColorStop(1, mix(byRole['균형색'].hex, '#fffaf1', .9));
    context.fillStyle = paper;
    context.fillRect(0, 0, 1600, height / unit);

    context.fillStyle = '#91734f';
    context.font = '500 26px Arial, sans-serif';
    context.fillText('MaC   /   CHROMATIC ATELIER', 120, 104);
    context.textAlign = 'right';
    context.fillStyle = '#8c8071';
    context.font = '24px Georgia, serif';
    context.fillText('Astral Color', 1480, 104);
    context.textAlign = 'left';
    context.fillStyle = '#37342e';
    context.font = '500 62px Pretendard, Arial, sans-serif';
    context.fillText('나의 색을 잇다', 120, 205);
    context.fillStyle = '#857a6d';
    context.font = '26px Pretendard, Arial, sans-serif';
    context.fillText('조각마다 담긴 나의 흐름, 한 장의 보자기로', 122, 255);

    const artX = 120;
    const artY = 326;
    const artSize = 1360;
    const binding = 22;
    const innerSize = artSize - binding * 2;
    context.save();
    context.shadowColor = 'rgba(79,58,39,.19)';
    context.shadowBlur = 32;
    context.shadowOffsetY = 14;
    context.fillStyle = byRole['관계색'].hex;
    context.fillRect(artX, artY, artSize, artSize);
    context.restore();
    // The binding and surrounding paper are outside the proportional patch area.
    const borderLight = context.createLinearGradient(artX, artY, artX + artSize, artY + artSize);
    borderLight.addColorStop(0, mix(byRole['관계색'].hex, '#fffaf0', .27));
    borderLight.addColorStop(.6, byRole['관계색'].hex);
    borderLight.addColorStop(1, mix(byRole['관계색'].hex, '#3c3025', .08));
    context.fillStyle = borderLight;
    context.fillRect(artX, artY, artSize, artSize);
    layout.forEach((piece) => drawFabric(context, {
      ...piece,
      x: artX + binding + piece.x * innerSize,
      y: artY + binding + piece.y * innerSize,
      width: piece.width * innerSize,
      height: piece.height * innerSize,
    }, palette[piece.element], random));

    context.save();
    context.beginPath();
    context.rect(artX, artY, artSize, artSize);
    context.clip();
    const daylight = context.createRadialGradient(artX + 230, artY + 110, 20, artX + 400, artY + 330, artSize);
    daylight.addColorStop(0, 'rgba(255,250,230,.18)');
    daylight.addColorStop(.5, 'rgba(255,250,230,.035)');
    daylight.addColorStop(1, 'rgba(255,250,230,0)');
    context.fillStyle = daylight;
    context.fillRect(artX, artY, artSize, artSize);
    // Soft diagonal fabric creases, kept subtle so the color stays legible.
    for (let index = 0; index < 3; index += 1) {
      const start = artY + 230 + index * 360 + random() * 100;
      context.beginPath();
      context.moveTo(artX, start);
      context.bezierCurveTo(artX + 360, start - 50, artX + 1000, start + 60, artX + artSize, start + 20);
      context.strokeStyle = 'rgba(255,252,236,.09)';
      context.lineWidth = 18;
      context.stroke();
      context.strokeStyle = 'rgba(58,39,24,.025)';
      context.lineWidth = 3;
      context.stroke();
    }
    context.restore();
    context.save();
    context.setLineDash([4, 5]);
    context.strokeStyle = 'rgba(255,247,221,.64)';
    context.lineWidth = 1.5;
    context.strokeRect(artX + 9, artY + 9, artSize - 18, artSize - 18);
    context.restore();

    context.fillStyle = '#6f6354';
    context.font = '27px Pretendard, Arial, sans-serif';
    context.fillText(report.pattern_family?.name || '나만의 조각보', 120, 1752);
    context.textAlign = 'right';
    context.fillStyle = '#9a8a75';
    context.font = '23px Georgia, serif';
    context.fillText(`No. ${report.pattern_seed.slice(0, 8).toUpperCase()}`, 1480, 1752);
    context.textAlign = 'left';
    report.colors.forEach((color, index) => {
      const x = 120 + index * 342;
      context.fillStyle = color.hex;
      context.fillRect(x, 1810, 42, 42);
      context.strokeStyle = 'rgba(61,46,30,.12)';
      context.lineWidth = 1;
      context.strokeRect(x, 1810, 42, 42);
      context.fillStyle = '#7e7161';
      context.font = '21px Pretendard, Arial, sans-serif';
      context.fillText(color.role, x + 56, 1828);
      context.fillStyle = '#3d3933';
      context.font = '23px Pretendard, Arial, sans-serif';
      context.fillText(color.name, x + 56, 1859);
    });
    context.fillStyle = '#897a68';
    context.font = '22px Pretendard, Arial, sans-serif';
    const ratios = ELEMENTS.map((element) => `${element} ${Math.round(report.visual_composition[element] / report.visual_slot_count * 1000) / 10}%`).join('   ·   ');
    context.fillText(`패치 면적  /  ${ratios}`, 120, 1940);
    context.restore();
    return { layout, palette };
  }

  /* ── 8색 조각보 (2026-10-10 팀 피드백, 김외진) ─────────────────────────────
   * · 면적 나눔을 먼저 고정한다 (몬드리안식 12×12 격자 1장, seed 로 좌우·상하 반전만 고른다)
   * · 고유색 4 + 보완색 4 = 8색, 사이사이 무채색(흰·회) 조각으로 명도를 바꿔 섞는다
   * · 조각 사이 선은 무채색(먹색)으로 감싸 색 차이가 작은 것을 상쇄한다
   * 색 HEX 는 서버(palette8)가 정한 값을 그대로 쓴다. 여기서는 배치·그리기만 한다. */
  // [x, y, w, h, slot]  slot: b0~b3 = 고유색(고유·재능·관계·균형), c0~c3 = 보완색, n1~n2 = 무채색
  const GRID8 = [
    [0, 0, 6, 5, 'b0'], [6, 0, 2, 5, 'n0'], [8, 0, 4, 5, 'c1'],
    [0, 5, 3, 4, 'c0'], [3, 5, 6, 4, 'b1'], [9, 5, 3, 2, 'n1'], [9, 7, 3, 2, 'c3'],
    [0, 9, 5, 3, 'b2'], [5, 9, 1, 3, 'n2'], [6, 9, 3, 3, 'c2'], [9, 9, 3, 3, 'b3'],
  ];
  const LINE_INK = '#3F3C39';

  function buildLayout8(report) {
    const seed = parseInt(report.pattern_seed.slice(0, 8), 16) || 0;
    const flipX = seed & 1;
    const flipY = (seed >> 1) & 1;
    return GRID8.map(([x, y, w, h, slot]) => ({
      slot,
      x: (flipX ? 12 - x - w : x) / 12,
      y: (flipY ? 12 - y - h : y) / 12,
      width: w / 12,
      height: h / 12,
    }));
  }

  function slotColor(slot, p8) {
    const index = Number(slot[1]);
    if (slot[0] === 'b') return p8.base[index].hex;
    if (slot[0] === 'c') return p8.complement[index].hex;
    // 서버가 8색과 겹치지 않게 고른 조각용 무채색 (없으면 지백·연회색·먹회색)
    const patch = p8.patch_neutrals || p8.neutrals.slice(0, 3);
    return patch[index].hex;
  }

  function drawPatch(context, rectangle, color) {
    const { x, y, width, height } = rectangle;
    context.save();
    context.beginPath();
    context.rect(x, y, width, height);
    context.clip();
    const silk = context.createLinearGradient(x, y, x + width, y + height);
    silk.addColorStop(0, mix(color, '#ffffff', .07));
    silk.addColorStop(.55, color);
    silk.addColorStop(1, mix(color, '#2a2420', .06));
    context.fillStyle = silk;
    context.fillRect(x, y, width, height);
    // 모시 결: 아주 옅게 (색이 먼저 보이게)
    for (let offset = 2; offset < width; offset += 4) {
      context.fillStyle = offset % 12 < 4 ? 'rgba(255,255,255,.05)' : 'rgba(30,20,10,.025)';
      context.fillRect(x + offset, y, .8, height);
    }
    for (let offset = 3; offset < height; offset += 5) {
      context.fillStyle = 'rgba(255,255,255,.045)';
      context.fillRect(x, y + offset, width, .9);
    }
    // 쌈솔 바느질 한 줄
    context.setLineDash([5, 6]);
    context.strokeStyle = 'rgba(255,255,255,.38)';
    context.lineWidth = 1.2;
    context.strokeRect(x + 12, y + 12, Math.max(0, width - 24), Math.max(0, height - 24));
    context.restore();
  }

  function drawChipRow(context, label, colors, y) {
    context.fillStyle = '#8a7c69';
    context.font = '600 21px Pretendard, Arial, sans-serif';
    context.fillText(label, 120, y + 28);
    colors.forEach((color, index) => {
      const x = 270 + index * 305;
      context.fillStyle = color.hex;
      context.fillRect(x, y, 46, 46);
      context.strokeStyle = 'rgba(40,30,20,.16)';
      context.lineWidth = 1;
      context.strokeRect(x + .5, y + .5, 45, 45);
      context.fillStyle = '#3d3933';
      context.font = '500 22px Pretendard, Arial, sans-serif';
      context.fillText(color.name, x + 60, y + 19);
      context.fillStyle = '#8f8270';
      context.font = '19px Pretendard, Arial, sans-serif';
      context.fillText(`${color.role.replace(' 보완', '')} · ${color.hex}`, x + 60, y + 44);
    });
  }


  /* ── 조각보 형태 10가지 (2026-10-11, 팀 피드백: 격자 하나는 예쁘지 않다 → 사용자가 고른다) ──
   * 모든 형태는 600×600 좌표에서 그린다. 큰 그림·작은 미리보기 모두 같은 함수를 배율만 바꿔 부른다.
   * 색은 서버 palette8 그대로: B=고유색 4, C=보완색 4, N=조각용 무채색 3, W=가장 밝은 무채색. 선은 먹색. */
  const S6 = 600;
  function styleColors(p8) {
    const patch = (p8.patch_neutrals || p8.neutrals.slice(0, 3)).map((n) => n.hex);
    const white = patch.includes('#F3F0E9') ? '#F3F0E9' : patch[0];
    return { B: p8.base.map((c) => c.hex), C: p8.complement.map((c) => c.hex), N: patch, W: white, INK: LINE_INK };
  }
  function weave(g, path) {
    g.save();
    g.clip(path);
    for (let x = 0; x < S6; x += 4) { g.fillStyle = x % 12 < 4 ? 'rgba(255,255,255,.05)' : 'rgba(30,20,10,.03)'; g.fillRect(x, 0, .8, S6); }
    for (let y = 0; y < S6; y += 5) { g.fillStyle = 'rgba(255,255,255,.05)'; g.fillRect(0, y, S6, .9); }
    g.restore();
  }
  function patch6(g, path, color, P, seam = 5) {
    g.fillStyle = color;
    g.fill(path);
    weave(g, path);
    g.lineWidth = seam;
    g.lineJoin = 'round';
    g.strokeStyle = P.INK;
    g.stroke(path);
  }
  function rect6(x, y, w, h) { const p = new Path2D(); p.rect(x, y, w, h); return p; }
  function lum(hex) { const n = parseInt(hex.slice(1), 16); return .3 * (n >> 16) + .59 * ((n >> 8) & 255) + .11 * (n & 255); }

  const STYLES = [
    { key: 'pinwheel', name: '바람개비', desc: '가운데 고유색을 네 띠가 돌아가며 감싼다', turn: true, draw(g, P) {
      const { B, C, N } = P; const a = S6 * .3; const m = (S6 - a) / 2; const h = m / 2;
      [[[0, 0, m + a, h], [0, h, m + a, h]], [[S6 - h, 0, h, m + a], [m + a, 0, h, m + a]],
        [[m, S6 - h, m + a, h], [m, m + a, m + a, h]], [[0, m, h, m + a], [h, m, h, m + a]]]
        .forEach(([o, i], k) => { patch6(g, rect6(...o), B[(k + 1) % 4], P); patch6(g, rect6(...i), C[k], P); });
      patch6(g, rect6(m, m, a, a), B[0], P);
      const q = a * .36; patch6(g, rect6(m + (a - q) / 2, m + (a - q) / 2, q, q), N[2], P);
    } },
    { key: 'frames', name: '액자 넷', desc: '네 칸마다 고유색 → 보완색 → 무채색 액자', draw(g, P) {
      const { B, C, N, W } = P; const h = S6 / 2;
      [[0, 0], [h, 0], [0, h], [h, h]].forEach(([x, y], k) => {
        patch6(g, rect6(x, y, h, h), B[k], P);
        patch6(g, rect6(x + h * .17, y + h * .12, h * .66, h * .66), C[k], P);
        patch6(g, rect6(x + h * .33, y + h * .24, h * .34, h * .34), [W, N[0], N[1], W][k], P);
      });
    } },
    { key: 'triangles', name: '삼각 조각', desc: '삼각 조각 32개가 다이아몬드 무늬를 만든다', turn: true, draw(g, P, rand) {
      const { B, C, N, W } = P; const n = 4; const c = S6 / n;
      const pool = [...Array(6).fill(B[0]), ...Array(5).fill(B[1]), ...Array(5).fill(B[2]), ...Array(4).fill(B[3]), ...C, ...C, W, N[0], N[1], N[2]];
      for (let i = pool.length - 1; i > 0; i -= 1) { const j = Math.floor(rand() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
      let k = 0;
      for (let y = 0; y < n; y += 1) for (let x = 0; x < n; x += 1) {
        const X = x * c; const Y = y * c; const t1 = new Path2D(); const t2 = new Path2D();
        if ((x + y) % 2) { t1.moveTo(X, Y); t1.lineTo(X + c, Y); t1.lineTo(X, Y + c); t2.moveTo(X + c, Y); t2.lineTo(X + c, Y + c); t2.lineTo(X, Y + c); }
        else { t1.moveTo(X, Y); t1.lineTo(X + c, Y); t1.lineTo(X + c, Y + c); t2.moveTo(X, Y); t2.lineTo(X, Y + c); t2.lineTo(X + c, Y + c); }
        t1.closePath(); t2.closePath();
        patch6(g, t1, pool[k++], P, 4); patch6(g, t2, pool[k++], P, 4);
      }
    } },
    { key: 'logcabin', name: '로그캐빈', desc: '가운데부터 띠를 감아 나간다. 밝은 색 위·오른쪽, 짙은 색 아래·왼쪽', turn: true, draw(g, P) {
      const { B, C, N, W } = P;
      const sorted = [...B.slice(0, 2), B[3], ...C, W, ...N].sort((a, b) => lum(b) - lum(a));
      const light = sorted.slice(0, 6); const dark = sorted.slice(6);
      const w = S6 / 7; let x = 3 * w; let y = 3 * w; let bw = w; let bh = w; let li = 0; let di = 0;
      patch6(g, rect6(x, y, w, w), B[2], P);
      for (let k = 0; k < 3; k += 1) {
        patch6(g, rect6(x, y - w, bw, w), light[li++], P); y -= w; bh += w;
        patch6(g, rect6(x + bw, y, w, bh), light[li++], P); bw += w;
        patch6(g, rect6(x, y + bh, bw, w), dark[di++], P); bh += w;
        patch6(g, rect6(x - w, y, w, bh), dark[di++], P); x -= w; bw += w;
      }
    } },
    { key: 'saekdong', name: '색동 띠', desc: '색동저고리처럼 가로 띠, 사이사이 가는 무채색 띠', draw(g, P) {
      const { B, C, N, W } = P;
      const seq = [[B[0], 3], [C[2], 1.2], [W, .45], [B[2], 2.2], [C[1], 1.4], [N[1], .45], [B[1], 2.4], [C[0], 1.3], [W, .45], [B[3], 2.2], [C[3], 1.2], [N[2], .45], [B[0], 1.6]];
      const total = seq.reduce((sum, item) => sum + item[1], 0); let y = 0;
      seq.forEach(([color, weight]) => { const h = weight / total * S6; patch6(g, rect6(0, y, S6, h), color, P, 4); y += h; });
    } },
    { key: 'moon', name: '사분원 달', desc: '고유색 네 칸 위에 보완색 고리가 모여 보름달 하나', draw(g, P) {
      const { B, C, N, W } = P; const h = S6 / 2;
      [[0, 0], [h, 0], [h, h], [0, h]].forEach(([x, y], k) => {
        patch6(g, rect6(x, y, h, h), B[k], P);
        const a0 = [Math.PI, 1.5 * Math.PI, 0, .5 * Math.PI][k];
        const ring = (r, color) => { const p = new Path2D(); p.moveTo(h, h); p.arc(h, h, r, a0, a0 + Math.PI / 2); p.closePath(); patch6(g, p, color, P); };
        ring(h * .82, C[k]); ring(h * .5, [W, N[0], W, N[0]][k]); ring(h * .24, B[(k + 2) % 4]);
      });
    } },
    { key: 'plaid', name: '직조 체크', desc: '고유색 가로 띠와 보완색 세로 띠를 겹쳐 짠 천', draw(g, P) {
      const { B, C, W, INK } = P;
      g.fillStyle = W; g.fillRect(0, 0, S6, S6); weave(g, rect6(0, 0, S6, S6));
      g.globalCompositeOperation = 'multiply';
      [[40, B[1], 80], [190, B[2], 60], [300, B[3], 110], [470, B[1], 50], [540, B[0], 40]].forEach(([y, c, h]) => { g.globalAlpha = .85; g.fillStyle = c; g.fillRect(0, y, S6, h); });
      [[30, C[0], 70], [150, C[2], 40], [250, C[1], 120], [420, C[3], 60], [520, C[2], 30]].forEach(([x, c, w]) => { g.globalAlpha = .75; g.fillStyle = c; g.fillRect(x, 0, w, S6); });
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      g.fillStyle = INK; [110, 262, 408, 520].forEach((v) => { g.fillRect(v, 0, 3, S6); g.fillRect(0, v - 40, S6, 3); });
    } },
    { key: 'field', name: '컬러 필드', desc: '큰 색면 셋이 번지듯 쌓인 차분한 그림', draw(g, P) {
      const { B, C } = P; const ground = C[2];
      g.fillStyle = ground; g.fillRect(0, 0, S6, S6); weave(g, rect6(0, 0, S6, S6));
      const soft = (y, h, color, blur) => { g.save(); g.filter = `blur(${blur}px)`; g.fillStyle = color; g.fillRect(70, y, S6 - 140, h); g.restore(); };
      soft(70, 150, B[3], 7); soft(245, 70, C[1], 7); soft(340, 190, B[2], 7); soft(555, 6, B[0], 4);
    } },
    { key: 'fan', name: '부채', desc: '한 모서리에서 부채살처럼 펼쳐진 조각', turn: true, draw(g, P) {
      const { B, C, N, W } = P; const R1 = S6 * 1.42; const R2 = S6 * .62; const R3 = S6 * .26;
      const outer = [B[0], C[0], B[1], C[1], B[2], C[2], B[3], C[3]]; const inner = [N[0], B[3], W, B[2], N[1], B[0], N[0], B[1]];
      g.fillStyle = W; g.fillRect(0, 0, S6, S6);
      for (let i = 0; i < 8; i += 1) {
        const a0 = -Math.PI / 2 + i * (Math.PI / 16); const a1 = a0 + Math.PI / 16;
        const p = new Path2D(); p.arc(0, S6, R1, a0, a1); p.arc(0, S6, R2, a1, a0, true); p.closePath(); patch6(g, p, outer[i], P);
        const q = new Path2D(); q.arc(0, S6, R2, a0, a1); q.arc(0, S6, R3, a1, a0, true); q.closePath(); patch6(g, q, inner[i], P);
      }
      const c = new Path2D(); c.moveTo(0, S6); c.arc(0, S6, R3, -Math.PI / 2, 0); c.closePath(); patch6(g, c, C[2], P);
    } },
    { key: 'wave', name: '물결 띠', desc: '물결 모양 띠가 부드럽게 흐른다', draw(g, P) {
      const { B, C, N, W } = P; const colors = [W, B[0], C[1], B[3], N[0], B[2], C[0], B[1], N[2], C[3], C[2]];
      const n = colors.length; const bh = S6 / (n - 1);
      const edge = (k) => { const pts = []; for (let x = -10; x <= S6 + 10; x += 10) pts.push([x, k * bh + Math.sin(x / 95 + k * .9) * bh * .38]); return pts; };
      for (let k = 0; k < n; k += 1) {
        const top = k === 0 ? [[-10, -10], [S6 + 10, -10]] : edge(k - 1);
        const bottom = k === n - 1 ? [[-10, S6 + 10], [S6 + 10, S6 + 10]] : edge(k);
        const p = new Path2D(); top.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
        [...bottom].reverse().forEach(([x, y]) => p.lineTo(x, y)); p.closePath(); patch6(g, p, colors[k], P, 4);
      }
    } },
  ];

  /* 형태 하나를 (x, y) 에 size 크기로 그린다. 사람마다 다르게: 삼각 배치·회전은 pattern_seed 로 정한다 (결정론). */
  function drawStyleArt(context, report, styleKey, x, y, size) {
    const style = STYLES.find((item) => item.key === styleKey) || STYLES[0];
    const P = styleColors(report.palette8);
    const seed = report.pattern_seed;
    const turns = style.turn ? (parseInt(seed.slice(0, 2), 16) % 4) : 0;
    context.save();
    context.translate(x, y);
    context.scale(size / S6, size / S6);
    context.beginPath();
    context.rect(0, 0, S6, S6);
    context.clip();
    context.translate(S6 / 2, S6 / 2);
    context.rotate(turns * Math.PI / 2);
    context.translate(-S6 / 2, -S6 / 2);
    style.draw(context, P, seededRandom(seed));
    context.restore();
    context.save();
    context.translate(x, y);
    context.scale(size / S6, size / S6);
    context.lineWidth = 14;
    context.strokeStyle = LINE_INK;
    context.strokeRect(7, 7, S6 - 14, S6 - 14);
    context.restore();
    return style;
  }

  function drawThumb(canvas, report, styleKey) {
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
    drawStyleArt(context, report, styleKey, 0, 0, canvas.width);
  }

  function draw8(canvas, report, styleKey) {
    const p8 = report.palette8;
    const context = canvas.getContext('2d');
    const { width, height } = canvas;
    const unit = width / 1600;
    context.clearRect(0, 0, width, height);
    context.save();
    context.scale(unit, unit);
    context.fillStyle = '#fbf8f2';
    context.fillRect(0, 0, 1600, height / unit);

    context.fillStyle = '#91734f';
    context.font = '500 26px Arial, sans-serif';
    context.fillText('MaC   /   CHROMATIC ATELIER', 120, 104);
    context.textAlign = 'right';
    context.fillStyle = '#8c8071';
    context.font = '24px Georgia, serif';
    context.fillText('Astral Color', 1480, 104);
    context.textAlign = 'left';
    context.fillStyle = '#37342e';
    context.font = '500 62px Pretendard, Arial, sans-serif';
    context.fillText('나의 색을 잇다', 120, 205);
    context.fillStyle = '#857a6d';
    context.font = '26px Pretendard, Arial, sans-serif';
    context.fillText('고유색 넷과 보완색 넷, 무채색으로 이은 한 장의 보자기', 122, 255);

    const artX = 120;
    const artY = 316;
    const artSize = 1360;
    context.save();
    context.shadowColor = 'rgba(60,45,30,.2)';
    context.shadowBlur = 30;
    context.shadowOffsetY = 12;
    context.fillStyle = LINE_INK;
    context.fillRect(artX, artY, artSize, artSize);
    context.restore();
    const style = drawStyleArt(context, report, styleKey, artX, artY, artSize);

    context.fillStyle = '#6f6354';
    context.font = '27px Pretendard, Arial, sans-serif';
    context.fillText(`${style.name} 조각보`, 120, 1738);
    context.textAlign = 'right';
    context.fillStyle = '#9a8a75';
    context.font = '23px Georgia, serif';
    context.fillText(`No. ${report.pattern_seed.slice(0, 8).toUpperCase()}`, 1480, 1738);
    context.textAlign = 'left';
    drawChipRow(context, '고유색 4', p8.base, 1784);
    drawChipRow(context, '보완색 4', p8.complement, 1860);
    context.fillStyle = '#9a8b77';
    context.font = '20px Pretendard, Arial, sans-serif';
    const patchNames = (p8.patch_neutrals || p8.neutrals.slice(0, 3)).map((n) => n.name).join(' · ');
    context.fillText(`무채색  ${patchNames} 조각 · 먹색 선   /   보완색 = 색상환 반대편, 명도를 원색에서 멀리`, 120, 1962);
    context.restore();
    return { style, palette8: p8 };
  }

  const api = { ELEMENTS, paletteForReport, buildLayout, draw, buildLayout8, draw8, STYLES, drawThumb };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AstralJogakbo = api;
}(typeof globalThis !== 'undefined' ? globalThis : this));
