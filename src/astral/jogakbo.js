// 조각보 v2 (2026-10-10 팀 피드백 반영) — 면적 나눔을 먼저 고정하고, 8색 + 무채색으로 칠한다.
//  ① 면적: 12×12 격자 위에서 큰 조각부터 1/3~2/3 지점으로 자른다 (몬드리안식 격자). 시드 = pattern_seed → 같은 사람 = 같은 조각보
//  ② 색 배정 (면적 비율):
//       균형색 1조각 ≈ 10%  (Astral color_solution "전체의 10~15% 강조색")
//       보완색 4조각 ≈ 4%씩 (고유·재능·관계·균형의 보완색, 서버 palette8)
//       무채색 2조각 ≈ 5%씩 (명도를 바꿔 지백·연회색·먹회색·먹색 중)
//       나머지 = 오행 조각. 오행끼리의 면적비는 Astral visual_composition 그대로 (큰 조각부터 모자란 오행에)
//  ③ 조각 사이 선은 무채색 (밝은 팔레트면 먹색, 어두운 팔레트면 지백) → 색 차이가 작아도 조각이 또렷하다
//  Astral 이 계산한 4색 HEX 는 바꾸지 않는다. 보완색·무채색만 더한다.

export const ELEMENTS = ["목", "화", "토", "금", "수"];
const STEM_ELEMENTS = { 갑: "목", 을: "목", 병: "화", 정: "화", 무: "토", 기: "토", 경: "금", 신: "금", 임: "수", 계: "수" };
const TOPIC_OFFSETS = { 비견: 0, 겁재: 0, 식신: 1, 상관: 1, 편재: 2, 정재: 2, 편관: 3, 정관: 3, 편인: 4, 정인: 4 };
const G = 12;

function rng(seedHex) {
  let v = parseInt(seedHex.slice(0, 8), 16) || 1;
  return () => { v = (Math.imul(v, 1664525) + 1013904223) >>> 0; return v / 4294967296; };
}
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => "#" + hexRgb(a).map((x, i) => Math.round(x + (hexRgb(b)[i] - x) * t).toString(16).padStart(2, "0")).join("");
const lum = (h) => { const [r, g, b] = hexRgb(h).map((c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };

// Astral 원본과 같은 규칙: 역할색을 그 오행에 놓고, 남은 오행은 오행 기본색
export function elementPalette(report) {
  const pal = { ...report.element_profile.element_colors };
  const day = report.colors.find((c) => c.role === "고유색");
  const dayEl = STEM_ELEMENTS[day.basis], di = ELEMENTS.indexOf(dayEl), used = new Set();
  for (const c of report.colors) {
    const el = c.role === "고유색" ? dayEl : c.role === "균형색" ? c.basis : ELEMENTS[(di + TOPIC_OFFSETS[c.basis]) % 5];
    if (!used.has(el)) { pal[el] = c.hex; used.add(el); }
  }
  return pal;
}

// ① 면적 고정: 격자 분할
export function buildGrid(report) {
  const r = rng(report.pattern_seed);
  const target = report.visual_slot_count === 6 ? 13 : 16;
  let rects = [{ x: 0, y: 0, w: G, h: G }];
  let guard = 0;
  while (rects.length < target && guard++ < 200) {
    const cand = rects.filter((q) => q.w >= 4 || q.h >= 4).sort((a, b) => b.w * b.h - a.w * a.h || a.y - b.y || a.x - b.x);
    if (!cand.length) break;
    const q = cand[Math.min(cand.length - 1, r() < 0.7 ? 0 : 1)];
    const vertical = q.w > q.h ? true : q.h > q.w ? false : r() < 0.5;
    const len = vertical ? q.w : q.h;
    if (len < 4) continue;
    const lo = Math.max(2, Math.round(len / 3)), hi = Math.min(len - 2, Math.round((len * 2) / 3));
    const cut = lo + Math.floor(r() * (hi - lo + 1));
    rects = rects.filter((x) => x !== q);
    if (vertical) rects.push({ x: q.x, y: q.y, w: cut, h: q.h }, { x: q.x + cut, y: q.y, w: q.w - cut, h: q.h });
    else rects.push({ x: q.x, y: q.y, w: q.w, h: cut }, { x: q.x, y: q.y + cut, w: q.w, h: q.h - cut });
  }
  return rects.map((q, i) => ({ ...q, id: i, area: q.w * q.h }));
}

const touches = (a, b) => (a.x === b.x + b.w || b.x === a.x + a.w) && a.y < b.y + b.h && b.y < a.y + a.h
  || (a.y === b.y + b.h || b.y === a.y + a.h) && a.x < b.x + b.w && b.x < a.x + a.w;

// ② 색 배정
export function assign(report, rects) {
  const p8 = report.palette8, total = G * G, ep = elementPalette(report);
  const free = [...rects].sort((a, b) => b.area - a.area || a.id - b.id);
  const take = (goal, avoid = []) => {
    let best = null;
    for (const q of free) {
      if (q === free[0]) continue;                              // 가장 큰 조각은 오행(고유색 쪽)에 남긴다
      const pen = Math.abs(q.area - goal) + (avoid.some((o) => touches(o, q)) ? 3 : 0);
      if (!best || pen < best.pen) best = { q, pen };
    }
    if (!best) return null;
    free.splice(free.indexOf(best.q), 1);
    return best.q;
  };
  const out = [];
  const bal = report.colors.find((c) => c.role === "균형색");
  const qb = take(total * 0.10); if (qb) out.push({ ...qb, kind: "balance", hex: bal.hex, label: "균형색" });
  const placed = () => out;
  for (const c of p8.complement) { const q = take(total * 0.04, placed()); if (q) out.push({ ...q, kind: "complement", hex: c.hex, label: c.role }); }
  const neu = [p8.neutrals[0], p8.neutrals[report.pattern_seed.charCodeAt(3) % 2 ? 2 : 1]];
  for (const n of neu) { const q = take(total * 0.05, placed()); if (q) out.push({ ...q, kind: "neutral", hex: n.hex, label: n.name }); }
  // 나머지 = 오행 조각 (면적비 = visual_composition)
  const comp = report.visual_composition, elTotal = ELEMENTS.reduce((s, e) => s + comp[e], 0);
  const rest = free.reduce((s, q) => s + q.area, 0), got = Object.fromEntries(ELEMENTS.map((e) => [e, 0]));
  const dayEl = STEM_ELEMENTS[report.colors.find((c) => c.role === "고유색").basis];
  for (const q of free) {
    const els = ELEMENTS.filter((e) => comp[e] > 0);
    let el = els.sort((a, b) => (comp[b] / elTotal * rest - got[b]) - (comp[a] / elTotal * rest - got[a]) || (b === dayEl) - (a === dayEl))[0];
    if (q === free[0] && comp[dayEl] > 0) el = dayEl;           // 가장 큰 조각 = 고유색의 오행
    got[el] += q.area;
    out.push({ ...q, kind: "element", element: el, hex: ep[el], label: el });
  }
  // 같은 색끼리 맞닿으면 한쪽을 아주 조금 밝게 (조각이 하나로 붙어 보이지 않게)
  out.sort((a, b) => a.id - b.id);
  for (let i = 0; i < out.length; i++) for (let j = 0; j < i; j++)
    if (out[i].hex === out[j].hex && touches(out[i], out[j])) out[i] = { ...out[i], hex: mix(out[i].hex, "#ffffff", 0.14) };
  const share = Object.fromEntries(ELEMENTS.map((e) => [e, rest ? got[e] / rest : 0]));
  return { pieces: out, share, areas: { balance: qb ? qb.area / total : 0, complement: out.filter((p) => p.kind === "complement").reduce((s, p) => s + p.area, 0) / total, neutral: out.filter((p) => p.kind === "neutral").reduce((s, p) => s + p.area, 0) / total } };
}

function linen(ctx, x, y, w, h, r) {
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.globalAlpha = 0.05; ctx.strokeStyle = "#000"; ctx.lineWidth = 1;
  for (let o = 2; o < w; o += 5) { ctx.beginPath(); ctx.moveTo(x + o, y); ctx.lineTo(x + o + (r() - 0.5) * 2, y + h); ctx.stroke(); }
  ctx.globalAlpha = 0.07; ctx.strokeStyle = "#fff";
  for (let o = 3; o < h; o += 6) { ctx.beginPath(); ctx.moveTo(x, y + o); ctx.lineTo(x + w, y + o + (r() - 0.5) * 2); ctx.stroke(); }
  ctx.restore();
}

// ③ 그리기
export function draw(canvas, report) {
  const ctx = canvas.getContext("2d"), W = 1600, H = 2000, s = canvas.width / W;
  const rects = buildGrid(report), { pieces, share, areas } = assign(report, rects), r = rng(report.pattern_seed.slice(8));
  const p8 = report.palette8;
  const avgL = pieces.reduce((t, p) => t + lum(p.hex) * p.area, 0) / (G * G);
  const seam = avgL > 0.28 ? "#2E2C2A" : "#F3F0E9";
  ctx.setTransform(s, 0, 0, s, 0, 0);
  ctx.fillStyle = "#F6F4EF"; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#8B8579"; ctx.font = "500 24px 'IBM Plex Sans KR', Pretendard, sans-serif"; ctx.fillText("MaC  /  ASTRAL COLOR", 120, 100);
  ctx.textAlign = "right"; ctx.fillText(`No. ${report.pattern_seed.slice(0, 8).toUpperCase()}`, 1480, 100); ctx.textAlign = "left";
  ctx.fillStyle = "#24221F"; ctx.font = "700 60px 'Gowun Batang', 'Noto Serif KR', serif"; ctx.fillText("나의 색을 잇다", 120, 196);
  ctx.fillStyle = "#6E685E"; ctx.font = "26px 'IBM Plex Sans KR', Pretendard, sans-serif";
  ctx.fillText("고유색 넷과 보완색 넷, 그 사이를 잇는 무채색", 122, 244);

  const ax = 120, ay = 300, A = 1360, line = 14, u = A / G;
  ctx.save(); ctx.shadowColor = "rgba(40,30,20,.18)"; ctx.shadowBlur = 30; ctx.shadowOffsetY = 12;
  ctx.fillStyle = seam; ctx.fillRect(ax - line, ay - line, A + line * 2, A + line * 2); ctx.restore();
  for (const p of pieces) {
    const x = ax + p.x * u + line / 2, y = ay + p.y * u + line / 2, w = p.w * u - line, h = p.h * u - line;
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, mix(p.hex, "#ffffff", 0.05)); g.addColorStop(1, mix(p.hex, "#000000", 0.04));
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    linen(ctx, x, y, w, h, r);
    ctx.save(); ctx.setLineDash([5, 6]); ctx.lineWidth = 1.4;
    ctx.strokeStyle = lum(p.hex) > 0.45 ? "rgba(46,44,42,.22)" : "rgba(255,255,255,.35)";
    ctx.strokeRect(x + 10, y + 10, w - 20, h - 20); ctx.restore();
  }

  const chipRow = (title, items, y0) => {
    ctx.fillStyle = "#6E685E"; ctx.font = "600 22px 'IBM Plex Sans KR', Pretendard, sans-serif"; ctx.fillText(title, 120, y0);
    items.forEach((c, i) => {
      const x = 120 + i * 342, y = y0 + 18;
      ctx.fillStyle = c.hex; ctx.fillRect(x, y, 56, 56);
      ctx.strokeStyle = "rgba(0,0,0,.12)"; ctx.lineWidth = 1; ctx.strokeRect(x + .5, y + .5, 55, 55);
      ctx.fillStyle = "#8B8579"; ctx.font = "20px 'IBM Plex Sans KR', Pretendard, sans-serif"; ctx.fillText(c.role, x + 70, y + 22);
      ctx.fillStyle = "#24221F"; ctx.font = "22px 'IBM Plex Sans KR', Pretendard, sans-serif"; ctx.fillText(`${c.name}`, x + 70, y + 50);
    });
  };
  chipRow("고유색", p8.base, 1726);
  chipRow("보완색", p8.complement.map((c) => ({ ...c, role: c.role.replace(" 보완", "") })), 1826);
  ctx.fillStyle = "#8B8579"; ctx.font = "20px 'IBM Plex Sans KR', Pretendard, sans-serif";
  const ratio = ELEMENTS.filter((e) => report.visual_composition[e] > 0).map((e) => `${e} ${Math.round(share[e] * 100)}%`).join(" · ");
  ctx.fillText(`오행 조각 면적  ${ratio}   |   균형색 ${Math.round(areas.balance * 100)}% · 보완색 ${Math.round(areas.complement * 100)}% · 무채색 ${Math.round(areas.neutral * 100)}%`, 120, 1962);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  return { pieces, share, areas, seam };
}
