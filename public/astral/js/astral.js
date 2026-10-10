const form = document.getElementById('astralForm');
const calendarRadios = document.querySelectorAll('input[name="calendarType"]');
const leapMonthGroup = document.getElementById('leapMonthGroup');
const birthMonth = document.getElementById('birthMonth');
const birthDay = document.getElementById('birthDay');
const birthTime = document.getElementById('birthTime');
const timeUnknown = document.getElementById('timeUnknown');
const formError = document.getElementById('formError');
const submitButton = document.getElementById('submitButton');
const emptyResult = document.getElementById('emptyResult');
const loadingResult = document.getElementById('loadingResult');
const colorResult = document.getElementById('colorResult');
const paidStartButton = document.getElementById('paidStartButton');
const checkoutDialog = document.getElementById('checkoutDialog');
const testPayButton = document.getElementById('testPayButton');
const paidReport = document.getElementById('paidReport');
const REPORT_STORAGE_KEY = 'mac-astral-paid-report-preview';
const REPORT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
let latestAstralPayload = null;
let latestPaidReport = null;

function fillNumberSelect(select, start, end, selected) {
  select.innerHTML = '';
  for (let value = start; value <= end; value += 1) {
    const option = document.createElement('option');
    option.value = String(value).padStart(2, '0');
    option.textContent = `${value}`;
    option.selected = value === selected;
    select.appendChild(option);
  }
}

fillNumberSelect(birthMonth, 1, 12, 5);
fillNumberSelect(birthDay, 1, 31, 21);

calendarRadios.forEach((radio) => {
  radio.addEventListener('change', () => {
    const isLunar = document.querySelector('input[name="calendarType"]:checked').value === 'lunar';
    leapMonthGroup.hidden = !isLunar;
  });
});

timeUnknown.addEventListener('change', () => {
  birthTime.disabled = timeUnknown.checked;
  birthTime.required = !timeUnknown.checked;
});

function showState(state) {
  emptyResult.hidden = state !== 'empty';
  loadingResult.hidden = state !== 'loading';
  colorResult.hidden = state !== 'result';
}

function showError(message) {
  formError.textContent = message;
  formError.hidden = false;
}

function clearError() {
  formError.hidden = true;
  formError.textContent = '';
}

async function postJson(url, payload) {
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch((window.ASTRAL_API_BASE || '') + url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || (typeof result.detail === 'string' ? result.detail : '') || '결과를 불러오지 못했습니다.');
      return result;
    } catch (error) {
      lastError = error;
      if (!(error instanceof TypeError) || attempt === 1) throw error;
      await new Promise((resolve) => window.setTimeout(resolve, 800));
    }
  }
  throw lastError;
}

function buildPayload() {
  const year = document.getElementById('birthYear').value.padStart(4, '0');
  const month = birthMonth.value.padStart(2, '0');
  const day = birthDay.value.padStart(2, '0');
  const calendarType = document.querySelector('input[name="calendarType"]:checked').value;
  const selectedGender = document.querySelector('input[name="gender"]:checked');
  return {
    calendar_type: calendarType,
    birth_date: `${year}-${month}-${day}`,
    is_leap_month: calendarType === 'lunar' && document.querySelector('input[name="leapMonth"]:checked').value === 'true',
    birth_time: timeUnknown.checked ? '' : birthTime.value,
    time_unknown: timeUnknown.checked,
    birth_city: document.getElementById('birthCity').value,
    gender: selectedGender ? selectedGender.value : '',
  };
}

function renderNotices(notices) {
  const container = document.getElementById('noticeList');
  container.innerHTML = '';
  notices.forEach((notice) => {
    const paragraph = document.createElement('p');
    paragraph.textContent = notice;
    container.appendChild(paragraph);
  });
  container.hidden = notices.length === 0;
}

function renderCandidates(candidates) {
  const card = document.getElementById('boundaryCard');
  const container = document.getElementById('boundaryCandidates');
  container.innerHTML = '';
  candidates.forEach((candidate) => {
    const row = document.createElement('div');
    row.className = 'candidate-row';
    const label = document.createElement('span');
    label.textContent = candidate.label;
    const pillars = document.createElement('span');
    pillars.className = 'candidate-pillars';
    pillars.textContent = [candidate.pillars.year, candidate.pillars.month, candidate.pillars.day, candidate.pillars.hour]
      .filter(Boolean).join(' · ');
    row.append(label, pillars);
    container.appendChild(row);
  });
  card.hidden = candidates.length < 2;
}

function renderResult(result) {
  const free = result.free_result;
  document.getElementById('colorSwatch').style.background = free.color.hex;
  document.getElementById('dayMaster').textContent = `일간 ${free.day_master} · 일주 ${free.day_pillar}`;
  document.getElementById('colorName').textContent = free.color.name;
  document.getElementById('hexChip').textContent = free.color.hex;
  document.getElementById('resultDescription').textContent = free.description;
  document.getElementById('disclaimer').textContent = result.disclaimer;
  renderNotices(result.notices || []);
  renderCandidates(result.boundary_candidates || []);
  paidStartButton.disabled = false;
  paidStartButton.textContent = '1,000원 유료 보고서 계속하기';
  showState('result');
}

function mixHex(source, target, amount) {
  const parse = (value) => [1, 3, 5].map((start) => Number.parseInt(value.slice(start, start + 2), 16));
  const [sr, sg, sb] = parse(source);
  const [tr, tg, tb] = parse(target);
  const channel = (from, to) => Math.round(from + (to - from) * amount).toString(16).padStart(2, '0');
  return `#${channel(sr, tr)}${channel(sg, tg)}${channel(sb, tb)}`;
}

function hexAlpha(hex, alpha) {
  const red = Number.parseInt(hex.slice(1, 3), 16);
  const green = Number.parseInt(hex.slice(3, 5), 16);
  const blue = Number.parseInt(hex.slice(5, 7), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function drawPattern(report) {
  const canvas = document.getElementById('patternCanvas');
  const legend = document.getElementById('patternAreaLegend');
  legend.innerHTML = '';
  if (report.palette8) {
    // 8색 조각보: 고유색 4 / 보완색 4 칩 (팀 피드백 2026-10-10)
    AstralJogakbo.draw8(canvas, report);
    document.querySelector('.pattern-source-note').textContent = '한국 조각보의 면 분할과 모시의 결, 쌈솔에서 영감을 받아 몬드리안식 고정 격자로 새로 그린 디지털 작품입니다.';
    [['고유색', report.palette8.base], ['보완색', report.palette8.complement]].forEach(([label, colors]) => {
      const row = document.createElement('div');
      row.className = 'pattern-chip-row';
      const title = document.createElement('b');
      title.textContent = label;
      row.appendChild(title);
      colors.forEach((color) => {
        const item = document.createElement('span');
        const dot = document.createElement('i');
        dot.style.backgroundColor = color.hex;
        item.title = `${color.role} ${color.hex}`;
        item.append(dot, document.createTextNode(color.name));
        row.appendChild(item);
      });
      legend.appendChild(row);
    });
    return;
  }
  const { palette } = AstralJogakbo.draw(canvas, report);
  AstralJogakbo.ELEMENTS.forEach((element) => {
    const item = document.createElement('span');
    const dot = document.createElement('i');
    dot.style.backgroundColor = palette[element];
    const percent = Math.round(report.visual_composition[element] / report.visual_slot_count * 1000) / 10;
    item.append(dot, document.createTextNode(`${element} ${percent}%`));
    legend.appendChild(item);
  });
}

function renderPillars(report) {
  const container = document.getElementById('reportPillars');
  container.innerHTML = '';
  AstralReportUI.pillarModels(report.pillars).forEach((pillar) => {
    const item = document.createElement('article');
    item.className = `pillar-card${pillar.key === 'day' ? ' pillar-day' : ''}`;
    const name = document.createElement('h4');
    name.textContent = pillar.label;
    item.appendChild(name);
    item.setAttribute('aria-label', `${pillar.label} ${pillar.value || '시간 미상'}`);
    if (!pillar.value) {
      const unknown = document.createElement('p');
      unknown.className = 'pillar-unknown';
      unknown.textContent = '시간 미상';
      const note = document.createElement('small');
      note.textContent = '시주는 만들지 않아요';
      item.append(unknown, note);
    } else {
      [pillar.stem, pillar.branch].forEach((letter, index) => {
        const row = document.createElement('div');
        row.className = 'pillar-letter';
        row.style.setProperty('--pillar-ink', AstralReportUI.ELEMENT_INK[letter.element]);
        row.style.setProperty('--pillar-color', report.element_profile.element_colors[letter.element]);
        const label = document.createElement('small');
        label.textContent = index === 0 ? '천간' : '지지';
        const glyph = document.createElement('strong');
        glyph.textContent = `${letter.text}(${letter.hanja})`;
        const element = document.createElement('span');
        element.className = 'pillar-element';
        element.textContent = letter.element;
        row.append(label, glyph, element);
        item.appendChild(row);
      });
      if (pillar.key === 'day') {
        const marker = document.createElement('small');
        marker.className = 'pillar-day-label';
        marker.textContent = '일간 = 나의 기준';
        item.appendChild(marker);
      }
    }
    container.appendChild(item);
  });
}

function renderOverview(overview, colors) {
  const uniqueColor = colors.find((color) => color.role === '고유색');
  const container = document.getElementById('reportOverview');
  container.style.setProperty('--overview-color', hexAlpha(uniqueColor.hex, .24));
  document.getElementById('overviewHeadline').textContent = overview.headline;
  document.getElementById('overviewSummary').textContent = overview.summary;
  const keywords = document.getElementById('overviewKeywords');
  keywords.innerHTML = '';
  overview.keywords.forEach((keyword) => {
    const item = document.createElement('span');
    item.textContent = keyword;
    keywords.appendChild(item);
  });
}

function renderReading(report) {
  const container = document.getElementById('readingGrid');
  container.innerHTML = '';
  report.reading.forEach((section, index) => {
    const accent = AstralReportUI.readingAccent(section, report);
    const article = document.createElement('article');
    const header = document.createElement('header');
    const chip = document.createElement('div');
    const heading = document.createElement('div');
    const role = document.createElement('span');
    const number = document.createElement('span');
    const title = document.createElement('h4');
    const colorName = document.createElement('p');
    const possibility = document.createElement('p');
    const facts = document.createElement('div');
    const evidence = document.createElement('details');
    const evidenceLabel = document.createElement('summary');
    const evidenceCopy = document.createElement('p');
    const action = document.createElement('p');
    article.style.setProperty('--section-color', accent.hex);
    header.className = 'reading-color-header';
    chip.className = 'reading-color-chip';
    chip.setAttribute('aria-label', `${accent.name} ${accent.hex}`);
    role.className = 'reading-role';
    role.textContent = accent.role;
    number.className = 'reading-number';
    number.textContent = String(index + 1).padStart(2, '0');
    title.textContent = section.title;
    colorName.className = 'reading-color-name';
    colorName.textContent = `${accent.name} · ${accent.hex}`;
    chip.appendChild(number);
    heading.append(role, title, colorName);
    header.append(chip, heading);
    possibility.className = 'reading-possibility';
    possibility.innerHTML = '<strong>해석 가능성</strong>';
    possibility.append(document.createTextNode(section.possibility));
    facts.className = 'reading-facts';
    [['활용할 강점', section.strength], ['확인할 지점', section.watch]].forEach(([label, text]) => {
      const box = document.createElement('p');
      const caption = document.createElement('strong');
      caption.textContent = label;
      box.append(caption, document.createTextNode(text));
      facts.appendChild(box);
    });
    action.className = 'reading-action';
    action.innerHTML = '<strong>오늘 해볼 작은 행동</strong>';
    action.append(document.createTextNode(section.action));
    evidence.className = 'reading-evidence';
    evidenceLabel.textContent = '이 풀이의 계산 근거 보기';
    evidenceCopy.textContent = section.evidence;
    evidence.append(evidenceLabel, evidenceCopy);
    article.append(header, possibility, facts, action, evidence);
    container.appendChild(article);
  });
}

function renderElementProfile(profile) {
  const model = AstralReportUI.spectrumModel(profile);
  const container = document.getElementById('elementSpectrum');
  container.innerHTML = '';
  const svgNode = (name, attributes, parent) => {
    const node = document.createElementNS('http://www.w3.org/2000/svg', name);
    Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
    if (parent) parent.appendChild(node);
    return node;
  };
  const points = (items) => items.map(point => `${point.x},${point.y}`).join(' ');
  const svg = svgNode('svg', { viewBox: '0 0 360 340', role: 'img', 'aria-labelledby': 'spectrumTitle spectrumDesc' }, container);
  svgNode('title', { id: 'spectrumTitle' }, svg).textContent = '오각형 오행 컬러 스펙트럼';
  svgNode('desc', { id: 'spectrumDesc' }, svg).textContent = model.axes.map(axis => `${axis.element} ${axis.count}칸 ${axis.percent}%`).join(', ') + `. 바깥 눈금은 가장 많은 항목의 ${model.maximum}칸이며 다섯 축에 같은 눈금을 적용했습니다. 사주의 강약이 아닌 이미지용 구성입니다.`;
  model.rings.forEach((ring, index) => svgNode('polygon', { points: points(ring), fill: 'none', stroke: '#e1dbcf', 'stroke-width': index === model.rings.length - 1 ? 1.4 : .8 }, svg));
  model.axes.forEach(axis => svgNode('line', { x1: model.center.x, y1: model.center.y, x2: axis.outer.x, y2: axis.outer.y, stroke: '#e6dfd3' }, svg));
  // Each colored wedge is clipped by the measured polygon, not an invented score.
  const defs = svgNode('defs', {}, svg);
  const clip = svgNode('clipPath', { id: 'spectrumAreaClip' }, defs);
  svgNode('polygon', { points: points(model.axes.map(axis => axis.value)) }, clip);
  const fill = svgNode('g', { 'clip-path': 'url(#spectrumAreaClip)' }, svg);
  model.axes.forEach((axis, index) => {
    const prev = model.axes[(index + 4) % 5].outer;
    const next = model.axes[(index + 1) % 5].outer;
    const start = { x: (prev.x + axis.outer.x) / 2, y: (prev.y + axis.outer.y) / 2 };
    const end = { x: (next.x + axis.outer.x) / 2, y: (next.y + axis.outer.y) / 2 };
    svgNode('polygon', { points: points([model.center, start, axis.outer, end]), fill: axis.color, 'fill-opacity': .85 }, fill);
  });
  svgNode('polygon', { class: 'spectrum-data', points: points(model.axes.map(axis => axis.value)), fill: 'none', stroke: '#8b6e43', 'stroke-width': 2.2, 'stroke-linejoin': 'round' }, svg);
  model.axes.forEach(axis => {
    if (axis.count > 0) svgNode('circle', { cx: axis.value.x, cy: axis.value.y, r: 4.8, fill: axis.ink, stroke: '#fffdf8', 'stroke-width': 1.7 }, svg);
    const text = svgNode('text', { x: axis.label.x, y: axis.label.y, 'text-anchor': 'middle', fill: axis.ink, class: 'spectrum-axis' }, svg);
    svgNode('tspan', { x: axis.label.x, dy: 0 }, text).textContent = `${axis.element} ${axis.english}`;
    svgNode('tspan', { x: axis.label.x, dy: 18, class: 'spectrum-axis-value' }, text).textContent = `${axis.count}칸 · ${axis.percent}%`;
  });
  document.getElementById('spectrumScale').textContent = `확대 눈금 · 중심 0칸 → 바깥선 ${model.maximum}칸 · 8단계로 표시합니다. 비율(%)은 전체 ${profile.slot_count}칸 기준입니다.`;
  const legend = document.getElementById('spectrumLegend');
  legend.innerHTML = '';
  model.axes.forEach(axis => {
    const item = document.createElement('li');
    const dot = document.createElement('i');
    const label = document.createElement('span');
    const value = document.createElement('strong');
    dot.style.backgroundColor = axis.color;
    label.textContent = axis.element;
    value.textContent = `${axis.count} / ${profile.slot_count}칸 · ${axis.percent}%`;
    item.append(dot, label, value);
    legend.appendChild(item);
  });
  const solution = profile.color_solution;
  document.getElementById('elementHeadline').textContent = `${profile.dominant.join('·')}의 면적이 가장 큰 팔레트`;
  document.getElementById('elementDescription').textContent = `${profile.slot_count}칸을 오행별로 나눈 분포입니다. 적게 나타난 ${solution.element}에는 ${solution.color_name}을 균형색으로 연결했어요.`;
  document.getElementById('elementNote').textContent = profile.note;
}

function renderStyling(report) {
  const container = document.getElementById('stylingGrid');
  container.innerHTML = '';
  const labels = { daily: ['입는 색', '곁에 두는 색', '화면의 색'], balance: ['입는 색', '공간의 색', '기록의 색'], work: ['도구', '할 일', '표현'], meet: ['외출', '메시지', '기록'] };
  AstralReportUI.stylingModels(report).forEach(model => {
    const card = document.createElement('article');
    card.className = `styling-card styling-${model.key}`;
    card.style.setProperty('--styling-color', model.color.hex);
    const header = document.createElement('header');
    const swatch = document.createElement('span');
    swatch.className = 'styling-swatch';
    swatch.setAttribute('aria-label', model.color.hex);
    const heading = document.createElement('div');
    const label = document.createElement('p');
    label.className = 'styling-purpose';
    label.textContent = `${model.title} · ${model.color.role}`;
    const name = document.createElement('h4');
    name.textContent = model.color.name;
    const hex = document.createElement('code');
    hex.textContent = model.color.hex;
    heading.append(label, name, hex);
    header.append(swatch, heading);
    const tagline = document.createElement('p');
    tagline.className = 'styling-tagline';
    tagline.textContent = model.tagline;
    const useList = document.createElement('ul');
    model.tips.forEach((tip, index) => {
      const item = document.createElement('li');
      const caption = document.createElement('span');
      const text = document.createElement('p');
      caption.textContent = labels[model.key][index];
      text.textContent = tip;
      item.append(caption, text);
      useList.appendChild(item);
    });
    const frequency = document.createElement('p');
    frequency.className = 'styling-frequency';
    frequency.textContent = `이렇게 시작해요 · ${model.frequency}`;
    const details = document.createElement('details');
    const summary = document.createElement('summary');
    const reason = document.createElement('p');
    summary.textContent = '이 색을 제안하는 이유';
    reason.textContent = model.reason;
    details.append(summary, reason);
    if (model.moment) {
      const moment = document.createElement('p');
      moment.textContent = `이럴 때 · ${model.moment}`;
      details.appendChild(moment);
    }
    card.append(header, tagline, useList, frequency, details);
    container.appendChild(card);
  });
}

function renderPaidColors(colors) {
  const descriptions = {
    고유색: '일간을 기준으로 정한 중심 색',
    재능색: '천간의 십신을 가중해 고른 활동 주제',
    관계색: '일지 본기의 십신으로 읽는 관계 주제',
    균형색: '이미지 구성에서 적은 오행을 채우는 시각화 색',
  };
  const container = document.getElementById('paidColorGrid');
  container.innerHTML = '';
  colors.forEach((color) => {
    const card = document.createElement('article');
    const swatch = document.createElement('button');
    const copyLabel = document.createElement('span');
    const role = document.createElement('p');
    const name = document.createElement('h4');
    const basis = document.createElement('p');
    const guide = document.createElement('p');
    const caution = document.createElement('p');
    const hex = document.createElement('code');
    const details = document.createElement('details');
    const summary = document.createElement('summary');
    swatch.className = 'paid-color-swatch';
    swatch.type = 'button';
    swatch.setAttribute('aria-label', `${color.name} ${color.hex} HEX 복사`);
    swatch.style.backgroundColor = color.hex;
    copyLabel.className = 'swatch-copy-label';
    copyLabel.textContent = 'HEX 복사';
    swatch.appendChild(copyLabel);
    swatch.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(color.hex);
        copyLabel.textContent = '복사 완료';
        window.setTimeout(() => { copyLabel.textContent = 'HEX 복사'; }, 1400);
      } catch (_) {
        copyLabel.textContent = color.hex;
      }
    });
    role.className = 'color-role';
    role.textContent = color.role;
    name.textContent = color.name;
    basis.textContent = `${descriptions[color.role]} · 기준 ${color.basis}`;
    guide.className = 'color-guide';
    guide.textContent = `이렇게 사용해 보세요 · ${color.guide.use}`;
    caution.className = 'color-caution';
    caution.textContent = color.guide.avoid;
    hex.textContent = color.hex;
    details.className = 'color-chip-details';
    summary.textContent = '색의 기준과 활용법';
    details.append(summary, basis, guide, caution);
    card.append(role, swatch, name, hex, details);
    container.appendChild(card);
  });
}

function renderFortune(fortune) {
  document.getElementById('fortuneScore').textContent = fortune.score;
  const scoreLabels = {
    base: '기본', cycle_rhythm: '60일 리듬', element_familiarity: '오행 구성',
    talent_match: '재능 주제', relationship_match: '관계 주제', branch_relation: '일지 관계',
  };
  document.getElementById('fortuneScoreBasis').textContent = Object.entries(fortune.score_components)
    .filter(([key, value]) => key === 'base' || value !== 0)
    .map(([key, value]) => `${scoreLabels[key]} ${value > 0 && key !== 'base' ? '+' : ''}${value}`)
    .join(' · ');
  document.getElementById('fortuneTheme').textContent = fortune.theme;
  document.getElementById('fortuneReading').textContent = fortune.reading;
  document.getElementById('fortuneAction').textContent = fortune.recommended_action;
  document.getElementById('fortuneCheck').textContent = fortune.check_point;
  const todayColor = document.getElementById('fortuneColor');
  todayColor.textContent = `${fortune.today_color.name} ${fortune.today_color.hex}`;
  todayColor.style.setProperty('--today-color', fortune.today_color.hex);
  document.getElementById('fortuneNotice').textContent = `${fortune.date_kst} · ${fortune.notice}`;
}

function renderPaidReport(report) {
  latestPaidReport = report;
  const genderName = report.profile.gender === 'male' ? '남성' : '여성';
  const timeLabel = report.profile.time_unknown ? '출생시간 미상' : '출생시간 반영';
  document.getElementById('reportMeta').textContent = `${report.profile.solar_date} · ${report.profile.birth_city} · ${genderName} · ${timeLabel} · ${report.report_version}`;
  renderPillars(report);
  renderOverview(report.overview, report.colors);
  renderReading(report);
  renderElementProfile(report.element_profile);
  renderStyling(report);
  renderPaidColors(report.colors);
  drawPattern(report);
  document.getElementById('patternFamily').textContent = `${report.pattern_family.name} · ${report.pattern_family.inspiration}`;
  renderFortune(report.today_fortune);
  const counts = Object.entries(report.visual_composition).map(([element, count]) => `${element} ${count}`).join(' · ');
  document.getElementById('compositionNote').textContent = report.palette8
    ? '조각 면적은 고정된 격자로 나누고, 큰 조각부터 고유색·재능색·관계색·균형색을 놓았습니다. 보완색 4개와 무채색 조각을 사이사이 섞고, 조각 사이 선은 먹색으로 감쌌습니다. 이미지용 구성이며 강약·용신 판단 수치는 아닙니다.'
    : `내부 패치 면적은 ${report.visual_slot_count}칸 오행 구성(${counts})의 비율을 따릅니다. 둘레와 바탕은 4색으로 연결합니다. 이미지용 비율이며 강약·용신 판단 수치는 아닙니다.`;
  document.getElementById('paidDisclaimer').textContent = report.disclaimer;
  document.querySelector('.test-badge').textContent = '개발용 테스트 결제';
  paidReport.hidden = false;
}

function saveReportPreview(report) {
  try {
    localStorage.setItem(REPORT_STORAGE_KEY, JSON.stringify({
      expiresAt: Date.now() + REPORT_RETENTION_MS,
      report,
    }));
  } catch (_) {
    // Storage can be blocked by the browser; the current result still remains visible.
  }
}

function hidePaidReport() {
  paidReport.hidden = true;
  latestPaidReport = null;
}

function invalidateCalculatedResults() {
  if (!latestAstralPayload && paidReport.hidden && colorResult.hidden) return;
  latestAstralPayload = null;
  hidePaidReport();
  paidStartButton.disabled = true;
  paidStartButton.textContent = '무료 결과 계산 후 열 수 있어요';
  showState('empty');
  clearError();
}

form.addEventListener('input', invalidateCalculatedResults);
form.addEventListener('change', invalidateCalculatedResults);

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearError();
  const payload = buildPayload();
  if (!payload.gender) {
    showError('성별을 선택해 주세요.');
    return;
  }
  if (!payload.birth_city) {
    showError('대한민국 내 출생 시·군을 입력해 주세요.');
    return;
  }
  if (!payload.time_unknown && !payload.birth_time) {
    showError('출생 시각을 입력하거나 시간 모름을 선택해 주세요.');
    return;
  }

  hidePaidReport();
  showState('loading');
  submitButton.disabled = true;
  try {
    const result = await postJson('/api/astral', payload);
    latestAstralPayload = payload;
    renderResult(result);
    if (window.innerWidth < 821) document.querySelector('.preview-panel').scrollIntoView({ behavior: 'smooth' });
  } catch (error) {
    showState('empty');
    const message = error instanceof TypeError && /fetch/i.test(error.message)
      ? '계산 서버에 연결하지 못했습니다. 화면을 새로고침한 뒤 다시 시도해 주세요.'
      : error.message || '잠시 후 다시 시도해 주세요.';
    showError(message);
  } finally {
    submitButton.disabled = false;
  }
});

document.getElementById('hexChip').addEventListener('click', async (event) => {
  const value = event.currentTarget.textContent;
  try {
    await navigator.clipboard.writeText(value);
    event.currentTarget.textContent = '복사됨';
    window.setTimeout(() => { event.currentTarget.textContent = value; }, 1200);
  } catch (_) {
    event.currentTarget.title = '복사할 수 없습니다';
  }
});

document.getElementById('resetButton').addEventListener('click', () => {
  showState('empty');
  latestAstralPayload = null;
  hidePaidReport();
  paidStartButton.disabled = true;
  paidStartButton.textContent = '무료 결과 계산 후 열 수 있어요';
  clearError();
  document.querySelector('.form-panel').scrollIntoView({ behavior: 'smooth' });
});

paidStartButton.addEventListener('click', () => {
  if (!latestAstralPayload) return;
  document.getElementById('checkoutError').hidden = true;
  checkoutDialog.showModal();
});

testPayButton.addEventListener('click', async () => {
  const checkoutError = document.getElementById('checkoutError');
  checkoutError.hidden = true;
  testPayButton.disabled = true;
  testPayButton.textContent = '보고서를 만들고 있어요…';
  try {
    const report = await postJson('/api/astral/report-preview', latestAstralPayload);
    renderPaidReport(report);
    saveReportPreview(report);
    checkoutDialog.close();
    paidReport.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    checkoutError.textContent = error instanceof TypeError && /fetch/i.test(error.message)
      ? '보고서 서버에 연결하지 못했습니다. 화면을 새로고침한 뒤 다시 시도해 주세요.'
      : error.message || '잠시 후 다시 시도해 주세요.';
    checkoutError.hidden = false;
  } finally {
    testPayButton.disabled = false;
    testPayButton.textContent = '테스트 결제 완료하기';
  }
});

document.getElementById('downloadPatternButton').addEventListener('click', (event) => {
  if (!latestPaidReport) return;
  const canvas = document.getElementById('patternCanvas');
  const link = document.createElement('a');
  link.href = canvas.toDataURL('image/png');
  link.download = `astral-color-${latestPaidReport.pattern_seed}.png`;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  const button = event.currentTarget;
  button.textContent = '다운로드 시작됨';
  window.setTimeout(() => { button.textContent = 'PNG 다운로드'; }, 1400);
});
