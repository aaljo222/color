/* Presentation only: calculated pillars, color HEX and counts are never changed. */
(function (root) {
  'use strict';
  const ELEMENTS = ['목', '화', '토', '금', '수'];
  const ELEMENT_INK = { 목: '#315846', 화: '#A64632', 토: '#806238', 금: '#596674', 수: '#244B63' };
  const STEM_ELEMENTS = { 갑: '목', 을: '목', 병: '화', 정: '화', 무: '토', 기: '토', 경: '금', 신: '금', 임: '수', 계: '수' };
  const BRANCH_ELEMENTS = { 자: '수', 축: '토', 인: '목', 묘: '목', 진: '토', 사: '화', 오: '화', 미: '토', 신: '금', 유: '금', 술: '토', 해: '수' };
  const STEM_HANJA = { 갑: '甲', 을: '乙', 병: '丙', 정: '丁', 무: '戊', 기: '己', 경: '庚', 신: '辛', 임: '壬', 계: '癸' };
  const BRANCH_HANJA = { 자: '子', 축: '丑', 인: '寅', 묘: '卯', 진: '辰', 사: '巳', 오: '午', 미: '未', 신: '申', 유: '酉', 술: '戌', 해: '亥' };
  const ENGLISH = { 목: 'Wood', 화: 'Fire', 토: 'Earth', 금: 'Metal', 수: 'Water' };

  function pillarModels(pillars) {
    return [['hour', '시주'], ['day', '일주'], ['month', '월주'], ['year', '연주']].map(([key, label]) => {
      const value = pillars[key];
      return {
        key, label, value: value || null,
        stem: value ? { text: value[0], hanja: STEM_HANJA[value[0]], element: STEM_ELEMENTS[value[0]] } : null,
        branch: value ? { text: value[1], hanja: BRANCH_HANJA[value[1]], element: BRANCH_ELEMENTS[value[1]] } : null,
      };
    });
  }

  function spectrumModel(profile) {
    if (ELEMENTS.some(element => !Number.isInteger(profile.counts[element]) || profile.counts[element] < 0)) throw new Error('오행 칸수는 음수가 아닌 정수여야 합니다.');
    const total = ELEMENTS.reduce((sum, element) => sum + profile.counts[element], 0);
    if (![6, 8].includes(profile.slot_count) || total !== profile.slot_count) throw new Error('오행 구성의 합계가 맞지 않습니다.');
    const center = { x: 180, y: 170 };
    const radius = 120;
    // Zoom the shared count axis, not the data. Percentages still use all 6/8 slots.
    const maximum = Math.max(...ELEMENTS.map(element => profile.counts[element]));
    const point = (index, fraction) => {
      const angle = (-90 + index * 72) * Math.PI / 180;
      return { x: center.x + Math.cos(angle) * radius * fraction, y: center.y + Math.sin(angle) * radius * fraction };
    };
    const axes = ELEMENTS.map((element, index) => ({
      element, english: ENGLISH[element], count: profile.counts[element],
      percent: Math.round(profile.counts[element] / total * 1000) / 10,
      color: profile.element_colors[element], ink: ELEMENT_INK[element],
      outer: point(index, 1), label: point(index, 1.24),
      value: point(index, profile.counts[element] / maximum),
    }));
    return { center, axes, maximum, rings: Array.from({ length: 8 }, (_, index) => ELEMENTS.map((_, axis) => point(axis, (index + 1) / 8))) };
  }

  function readingAccent(section, report) {
    if (section.key === 'month_command') {
      const element = BRANCH_ELEMENTS[report.pillars.month[1]];
      return { role: '월령', name: `${element}의 계절색`, hex: report.element_profile.element_colors[element] };
    }
    return report.colors.find(color => color.role === section.color_role);
  }

  const BALANCE_TIPS = {
    목: ['셔츠·양말의 작은 초록 포인트', '책상에 있는 화분이나 패브릭 소품', '시작할 일을 표시하는 노트 탭'],
    화: ['스카프·양말·파우치의 부드러운 분홍 포인트', '컵이나 작은 패브릭에 따뜻한 색 한 곳', '전하고 싶은 말을 적는 메모의 강조선'],
    토: ['가방·벨트·니트의 모래빛 한 곳', '책상 매트나 수납함의 차분한 바탕', '반복 일정을 묶는 달력 배경'],
    금: ['밝은 셔츠·손수건으로 다른 색 사이에 여백', '이미 있는 밝은 트레이나 컵을 한 곳에 정리', '문서의 넓은 여백과 완료 라벨'],
    수: ['푸른 양말·파우치처럼 작은 포인트', '쿠션·머그의 차분한 물빛', '독서 노트나 잠금화면의 부드러운 배경'],
  };

  function stylingModels(report) {
    const byRole = Object.fromEntries(report.colors.map(color => [color.role, color]));
    const solution = report.element_profile.color_solution;
    return [
      { key: 'daily', color: byRole['고유색'], title: '매일 함께할 색', tagline: '내 기준을 떠올리는 작은 시그니처',
        reason: '일간에 연결된 고유색입니다. 날짜마다 바뀌지 않으니 매일 보는 물건 한두 곳에 가볍게 이어 보세요.',
        tips: ['파우치·키링·양말 중 한 곳에 작은 포인트', '책상 위 컵이나 노트처럼 자주 보는 물건', '휴대폰 위젯이나 프로필의 작은 배경'],
        frequency: '매일 · 작은 포인트 한두 곳' },
      { key: 'balance', color: byRole['균형색'], title: '새롭게 더해볼 색', tagline: '익숙한 팔레트에 새로운 결 더하기',
        reason: `${solution.element} ${report.element_profile.counts[solution.element]} / ${report.visual_slot_count}칸으로, 이미지 구성에서 적게 나타난 항목에 연결된 색입니다. 기운이 부족하다는 진단은 아닙니다.`,
        tips: BALANCE_TIPS[solution.element], frequency: solution.ratio, moment: solution.moment },
      { key: 'work', color: byRole['재능색'], title: '일·공부에 꺼낼 색', tagline: '집중할 일을 눈에 보이게 구분하기',
        reason: `재능 주제 ${byRole['재능색'].basis}에 연결된 색입니다. 중요한 할 일을 찾기 쉽게 만드는 표식으로 써보세요.`,
        tips: ['노트·파일의 탭이나 제목 표시', '오늘 끝낼 항목에만 짧은 강조선', '발표 자료의 핵심 한 문장에 포인트'], frequency: '일·공부할 때 · 핵심 한 곳' },
      { key: 'meet', color: byRole['관계색'], title: '만남에 쓰는 색', tagline: '대화의 장면을 기억하는 포인트',
        reason: `관계 주제 ${byRole['관계색'].basis}에 연결된 색입니다. 궁합을 바꾸는 색이 아니라 만남을 준비하는 취향의 도구입니다.`,
        tips: ['약속 있는 날 스카프나 작은 액세서리', '초대장·메시지 카드의 부드러운 포인트', '대화 뒤 기억할 내용을 적는 메모'], frequency: '대화·약속이 있는 날' },
    ];
  }

  const api = { ELEMENTS, ELEMENT_INK, pillarModels, spectrumModel, readingAccent, stylingModels };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AstralReportUI = api;
}(typeof globalThis !== 'undefined' ? globalThis : this));
