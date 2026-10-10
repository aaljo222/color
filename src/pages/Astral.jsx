import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import { draw, ELEMENTS } from "../astral/jogakbo.js";

// Astral Color (사주 컬러) — 원본: github.com/ssebni/MaC_astral-color. 사주 계산·4색은 서버(astral_color 엔진)가 정한다.
// 이 화면은 보여 주기만 한다. 보완색 4·무채색 4는 서버 palette8 (계산기), 조각보는 jogakbo.js v2.
const STEM_EL = { 갑: "목", 을: "목", 병: "화", 정: "화", 무: "토", 기: "토", 경: "금", 신: "금", 임: "수", 계: "수" };
const BRANCH_EL = { 자: "수", 축: "토", 인: "목", 묘: "목", 진: "토", 사: "화", 오: "화", 미: "토", 신: "금", 유: "금", 술: "토", 해: "수" };
const STEM_HJ = { 갑: "甲", 을: "乙", 병: "丙", 정: "丁", 무: "戊", 기: "己", 경: "庚", 신: "辛", 임: "壬", 계: "癸" };
const BRANCH_HJ = { 자: "子", 축: "丑", 인: "寅", 묘: "卯", 진: "辰", 사: "巳", 오: "午", 미: "未", 신: "申", 유: "酉", 술: "戌", 해: "亥" };
const EL_INK = { 목: "#315846", 화: "#A64632", 토: "#806238", 금: "#596674", 수: "#244B63" };

const EMPTY = { calendar_type: "solar", birth_date: "", is_leap_month: false, birth_time: "", time_unknown: false, birth_city: "", gender: "" };

function Chip({ c, sub }) {
  return (
    <li className="as-chip">
      <span className="as-sw" style={{ background: c.hex }} />
      <span><span className="as-role">{sub || c.role}</span><b>{c.name}</b><span className="num as-hex">{c.hex}</span></span>
    </li>
  );
}

export default function Astral() {
  const [f, setF] = useState(EMPTY);
  const [free, setFree] = useState(null);
  const [rep, setRep] = useState(null);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const cv = useRef(null);
  const [png, setPng] = useState("");
  const set = (k) => (e) => { const v = e.target.type === "checkbox" ? e.target.checked : e.target.value; setF((o) => ({ ...o, [k]: v })); setFree(null); setRep(null); };

  async function run(kind) {
    setErr(""); setBusy(kind);
    try {
      const body = { ...f, birth_time: f.time_unknown ? "" : f.birth_time };
      if (kind === "free") { setFree(await api("/api/astral", { method: "POST", body })); setRep(null); }
      else setRep(await api("/api/astral/report-preview", { method: "POST", body }));
    } catch (e) { setErr(e.message); } finally { setBusy(""); }
  }

  useEffect(() => {
    if (!rep || !cv.current) return;
    const go = () => { draw(cv.current, rep); setPng(cv.current.toDataURL("image/png")); };
    (document.fonts?.ready || Promise.resolve()).then(go);
  }, [rep]);

  const p8 = rep?.palette8;
  return (
    <section className="astral">
      <h1 className="title">사주로 찾는 나의 색</h1>
      <p className="lead">생년월일과 태어난 시각으로 사주 여덟 글자를 계산하고, 그 계산에 연결된 색을 보여 줍니다. 색은 언어 모델이 아니라 계산 규칙이 정합니다. 성격이나 미래를 확정하는 풀이가 아닙니다.</p>

      <form className="as-form" onSubmit={(e) => { e.preventDefault(); run("free"); }}>
        <fieldset className="as-row">
          <legend className="sr">달력</legend>
          <label className="as-radio"><input type="radio" name="cal" value="solar" checked={f.calendar_type === "solar"} onChange={set("calendar_type")} /> 양력</label>
          <label className="as-radio"><input type="radio" name="cal" value="lunar" checked={f.calendar_type === "lunar"} onChange={set("calendar_type")} /> 음력</label>
          {f.calendar_type === "lunar" && <label className="as-radio"><input type="checkbox" checked={f.is_leap_month} onChange={set("is_leap_month")} /> 윤달</label>}
        </fieldset>
        <div className="as-grid">
          <label>생년월일<input id="as-date" type="date" required min="1900-01-01" max="2100-12-31" value={f.birth_date} onChange={set("birth_date")} /></label>
          <label>태어난 시각<input id="as-time" type="time" value={f.birth_time} disabled={f.time_unknown} required={!f.time_unknown} onChange={set("birth_time")} /></label>
          <label>태어난 시·군<input id="as-city" type="text" placeholder="예: 수원시" maxLength={40} required value={f.birth_city} onChange={set("birth_city")} /></label>
          <label>성별<select id="as-gender" required value={f.gender} onChange={set("gender")}><option value="">고르세요</option><option value="female">여성</option><option value="male">남성</option></select></label>
        </div>
        <label className="as-radio"><input type="checkbox" checked={f.time_unknown} onChange={set("time_unknown")} /> 태어난 시각을 모릅니다 (시주 없이 여섯 글자로 계산)</label>
        <div className="as-actions">
          <button className="primary" disabled={!!busy}>{busy === "free" ? "계산 중…" : "무료로 고유색 보기"}</button>
          <span className="hint">성별은 프로필에만 쓰고 계산에는 쓰지 않습니다. 입력은 저장하지 않습니다.</span>
        </div>
        {err && <p className="error" role="alert">{err}</p>}
      </form>

      {free && (
        <div className="as-free">
          <div className="as-free-sw" style={{ background: free.free_result.color.hex }} />
          <div>
            <p className="meta">일주 {free.free_result.day_pillar} · 일간 {free.free_result.day_master}</p>
            <h2 className="as-h2">{free.free_result.color.name} <span className="num as-hex">{free.free_result.color.hex}</span></h2>
            <p>{free.free_result.description}</p>
            {free.notices?.map((n) => <p key={n} className="hint">{n}</p>)}
            <button className="ghost" onClick={() => run("report")} disabled={!!busy}>{busy === "report" ? "만드는 중…" : "상세 보고서 미리보기 · 테스트 (결제 없음)"}</button>
          </div>
        </div>
      )}

      {rep && (
        <div className="as-report">
          <h2 className="sub">{rep.overview.headline}</h2>
          <p className="lead">{rep.overview.summary}</p>

          <h3 className="as-h3">만세력</h3>
          <div className="as-pillars">
            {[["hour", "시주"], ["day", "일주"], ["month", "월주"], ["year", "연주"]].map(([k, label]) => {
              const v = rep.pillars[k];
              return (
                <div key={k} className={`as-pillar${k === "day" ? " me" : ""}`}>
                  <span className="as-plabel">{label}</span>
                  {v ? <>
                    <span className="as-char" style={{ background: rep.element_profile.element_colors[STEM_EL[v[0]]], color: EL_INK[STEM_EL[v[0]]] }}>{STEM_HJ[v[0]]}<small>{v[0]} · {STEM_EL[v[0]]}</small></span>
                    <span className="as-char" style={{ background: rep.element_profile.element_colors[BRANCH_EL[v[1]]], color: EL_INK[BRANCH_EL[v[1]]] }}>{BRANCH_HJ[v[1]]}<small>{v[1]} · {BRANCH_EL[v[1]]}</small></span>
                  </> : <span className="as-none">시각 미상</span>}
                </div>
              );
            })}
          </div>

          <h3 className="as-h3">나의 색 여덟 가지</h3>
          <p className="hint" style={{ marginTop: 0 }}>위는 사주 계산에서 나온 고유색 넷, 아래는 각 색의 반대편 색상에서 명도를 벌려 만든 보완색 넷입니다. 함께 쓰면 비슷한 색끼리 뭉쳐 흐려 보이지 않습니다.</p>
          <div className="as-chiprows">
            <div><p className="as-rowtitle">고유색</p><ul className="as-chips">{p8.base.map((c) => <Chip key={c.role} c={c} />)}</ul></div>
            <div><p className="as-rowtitle">보완색</p><ul className="as-chips">{p8.complement.map((c) => <Chip key={c.role} c={c} sub={`${c.of}의 보완`} />)}</ul></div>
            <div><p className="as-rowtitle">잇는 무채색</p><ul className="as-chips small-chips">{p8.neutrals.map((c) => <Chip key={c.key} c={c} sub="무채색" />)}</ul></div>
          </div>

          <h3 className="as-h3">조각보</h3>
          <div className="as-jogakbo">
            <canvas ref={cv} width={1600} height={2000} aria-label="사주 색 조각보" />
            <div className="as-jg-side">
              <p>면적은 격자로 먼저 나누고 색을 얹었습니다. 오행 조각의 면적비는 사주 구성 그대로이고, 균형색은 전체의 약 10%, 보완색과 무채색은 사이사이에 놓았습니다. 조각 사이 선은 무채색이라 비슷한 색도 또렷하게 갈라집니다.</p>
              <dl className="as-counts">
                {ELEMENTS.map((e) => (
                  <div key={e}><dt style={{ color: EL_INK[e] }}>{e}</dt><dd className="num">{rep.element_profile.counts[e]} / {rep.visual_slot_count}칸</dd></div>
                ))}
              </dl>
              {png && <a className="ghost" href={png} download={`astral-jogakbo-${rep.pattern_seed.slice(0, 8)}.png`}>조각보 PNG 저장</a>}
            </div>
          </div>

          <h3 className="as-h3">오늘의 흐름 · {rep.today_fortune.date_kst}</h3>
          <div className="as-today">
            <span className="as-sw big" style={{ background: rep.today_fortune.today_color.hex }} />
            <div>
              <p><b>{rep.today_fortune.theme}</b> · {rep.today_fortune.today_color.name} · <span className="num">{rep.today_fortune.score}점</span></p>
              <p>{rep.today_fortune.reading}</p>
              <p className="hint">해 볼 일: {rep.today_fortune.recommended_action} · 살펴볼 점: {rep.today_fortune.check_point}</p>
            </div>
          </div>

          <h3 className="as-h3">풀이</h3>
          <div className="as-reading">
            {rep.reading.map((s) => (
              <article key={s.key}>
                <h4>{s.title}</h4>
                <p className="hint">{s.evidence}</p>
                <p>{s.possibility} {s.strength}</p>
                <p className="hint">살펴볼 점: {s.watch} · 해 볼 일: {s.action}</p>
              </article>
            ))}
          </div>
          <p className="hint">{rep.disclaimer} 지금은 결제 없이 보는 테스트 미리보기입니다.</p>
        </div>
      )}
    </section>
  );
}
