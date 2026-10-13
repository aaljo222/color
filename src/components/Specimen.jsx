import { absUrl } from "../api.js";

export const ROLE = {
  dominant: "주조색",
  supporting: "보조색",
  atmospheric: "분위기색",
  accent: "강조색",
};
const AXIS = {
  emotion: "감정",
  time: "시간",
  space: "장소",
  quality: "선명도",
  object: "사물",
  image: "그림",
  word: "문장 속 색 말",
  shade: "곁색",
};
const HOW = {
  keyword: "낱말 일치",
  label: "모델 라벨",
  corpus: "코퍼스 문단",
  retrieval: "검색",
  fallback: "기본 톤",
  lexicon: "사전 등급",
  table: "확정 색표",
  grade: "모델 등급",
  measured: "그림에서 측정",
  snapped: "후보에서 고름",
  affect_check: "정서 대조로 다시 고름",
};
const VERDICT = {
  match: "이 기억의 감정과 맞음",
  other: "연구상 다른 감정과 연합",
  none: "확인된 강한 감정 연합 없음",
};

// 기억 표본 한 장: 왼쪽 그림, 오른쪽 라벨(해시·면적비 막대·색 목록·검증)
export default function Specimen({ data }) {
  const img = data.image_png_base64
    ? `data:image/png;base64,${data.image_png_base64}`
    : absUrl(data.image_url);
  const v = data.verification || {};
  const aff =
    data.affect || data.palette.map((p) => p.basis?.affect).find(Boolean); // 저장본은 palette 안에서 찾는다
  const links = Object.fromEntries(
    (data.grounding?.color_links || []).map((l) => [l.role, l]),
  );
  return (
    <article className="plate" aria-label={`색 표본 ${data.specimen_hash}`}>
      <div className="plate-field">
        {img ? (
          <img src={img} alt="표본 그림" />
        ) : (
          <AreaField palette={data.palette} />
        )}
      </div>
      <div className="plate-label">
        <p className="hash">{data.specimen_hash}</p>
        {data.memory_summary && (
          <p className="summary">{data.memory_summary}</p>
        )}
        <div className="ratio" role="img" aria-label="면적 비율">
          {data.palette.map((p) => (
            <span
              key={p.role}
              style={{ background: p.hex, flexGrow: p.area_ratio }}
            />
          ))}
        </div>
        <ul className="roles">
          {data.palette.map((p) => (
            <li key={p.role}>
              <span className="chip" style={{ background: p.hex }} />
              <span className="role">
                {ROLE[p.role] || p.role}
                <small>{Math.round(p.area_ratio * 100)}%</small>
              </span>
              <span className="name">{p.color_name}</span>
              <span className="num">{p.hex}</span>
              {p.basis && p.basis.how === "snapped" ? (
                <span className="why">
                  {AXIS[p.basis.axis] || p.basis.axis} 후보{" "}
                  {p.basis.shade_of
                    ? `${p.basis.shade_of.split(" ")[0]}의 곁색 ${p.basis.candidate}`
                    : p.basis.candidate}{" "}
                  · {p.basis.phrase}
                  {p.basis.area_target != null
                    ? ` (목표 ${Math.round(p.basis.area_target * 100)}%)`
                    : ""}
                  {p.basis.painted_hex
                    ? ` · 그림 속 실제 색 ${p.basis.painted_hex}, 차이 ΔE ${p.basis.fidelity_de00}`
                    : " · 그림에 거의 없음"}
                  {p.basis.merged?.length
                    ? ` · 같은 색을 가리킨 근거: ${p.basis.merged.join(", ")}`
                    : ""}
                </span>
              ) : (
                p.basis && (
                  <span className="why">
                    {AXIS[p.basis.axis]} “{p.basis.phrase || "—"}” ·{" "}
                    {HOW[p.basis.how] || p.basis.how}
                    {p.basis.adjust ? " · 대비 보정" : ""}
                    {p.basis.affect ? " · 정서 보정" : ""}
                    {p.basis.nearest
                      ? ` · 가까운 기준색 ${p.basis.nearest.name} (ΔE ${p.basis.nearest.de00})`
                      : ""}
                  </span>
                )
              )}
              {links[p.role] && <ColorLink l={links[p.role]} />}
            </li>
          ))}
        </ul>
        {aff && v.coverage != null && v.criteria?.arousal_c ? (
          <p className="affect">
            문장의 정서 등급 쾌 {aff.valence} · 각성 {aff.arousal} (1~5) → 4색을
            면적 가중 평균한 채도는 {v.criteria.arousal_c[0]}~
            {v.criteria.arousal_c[1]}, 명도는 {v.criteria.valence_l[0]}~
            {v.criteria.valence_l[1]} 이어야 함
            {v.review ? (
              <small>
                {" "}
                · 이 그림의 4색: 채도 {v.review.chroma_w} · 명도{" "}
                {v.review.light_w}
                {v.review.notes?.length
                  ? " — 범위 밖 (참고 표시만, 합격 판정에는 쓰지 않음)"
                  : " — 범위 안"}
              </small>
            ) : null}
          </p>
        ) : aff && (aff.chroma_pct || aff.dL) ? (
          <p className="affect">
            정서 쾌 {aff.valence} · 각성 {aff.arousal}
            <small>
              {" "}
              (감정 기준 {aff.base?.[0]}·{aff.base?.[1]})
            </small>{" "}
            → 채도 {sign(aff.chroma_pct)}% · 명도 {sign(aff.dL)}
          </p>
        ) : null}
        {v.status && (
          <p className={`stamp ${v.status === "PASS" ? "ok" : "no"}`}>
            {v.coverage != null
              ? `${v.status === "PASS" ? "심사 통과" : "심사 미통과"} · 그림 픽셀의 ${(Math.floor(v.coverage * 1000) / 10).toFixed(1)}%가 4색 중 하나와 거의 같은 색 (ΔE00 ≤ ${v.criteria?.cover_de00 ?? 10})`
              : `${v.status === "PASS" ? "측정 일치" : "측정 불일치"} · 최대 ΔE00 ${Number(v.max_de00).toFixed(2)}`}
          </p>
        )}
        {data.candidates?.length > 0 && <Candidates list={data.candidates} />}
        {data.grounding && <Grounding g={data.grounding} />}
        <p className="meta">
          {data.kb_version} / {data.engine_version}
          {data.variant ? ` · 변형 ${data.variant}` : ""}
          {data.lock_via === "class"
            ? " · 같은 문장급이라 같은 표본"
            : data.cache_hit
              ? " · 같은 기억이라 같은 표본"
              : ""}
          {data.already_owned ? " · 이미 보관함에 있음" : ""}
        </p>
      </div>
    </article>
  );
}

// 코퍼스 RAG 근거 (eng-2.2): 이 표본에 쓰인 장면·사물 문단과, 적용된 규칙을 뒷받침하는 연구
function Grounding({ g }) {
  const n =
    (g.scenes?.length || 0) +
    (g.objects?.length || 0) +
    (g.research?.length || 0);
  if (!n && !g.missing?.length) return null;
  return (
    <details className="grounding">
      <summary>
        왜 이 색인가 — 근거 {n}건{" "}
        <small title="코퍼스 세 파일 내용의 지문. 문단이 하나만 바뀌어도 바뀝니다 (표본 해시와 다른 값)">
          (코퍼스 {g.corpus_version})
        </small>
      </summary>
      {g.missing?.length > 0 && (
        <ul>
          {g.missing.map((m) => (
            <li key={m.axis}>
              {AXIS[m.axis] || m.axis} · “{m.phrase || "—"}” → KB에 맞는 항목이
              없어 기본 톤 (근거 문단 없음)
            </li>
          ))}
        </ul>
      )}
      {g.scenes?.length > 0 && (
        <ul>
          {g.scenes.map((s) => (
            <li key={s.id}>
              {AXIS[s.axis] || s.axis} · “{s.text}” → {s.color_note}
              {s.status === "draft" ? <em className="tag">초안</em> : null}
            </li>
          ))}
        </ul>
      )}
      {g.objects?.length > 0 && (
        <ul>
          {g.objects.map((o) => (
            <li key={o.id}>
              사물 “{o.name}” · 코퍼스 등급 {o.grade.join(" · ")}
              {o.status === "draft" ? <em className="tag">초안</em> : null}
            </li>
          ))}
        </ul>
      )}
      {g.research?.length > 0 && (
        <ul className="refs">
          {g.research.map((r) => (
            <li key={r.id}>
              <a href={r.url} target="_blank" rel="noreferrer">
                {r.citation}
              </a>
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}

// 칩 하나의 색-감정 연구 근거 (eng-2.6): 칩의 색상 갈래와 연합이 확인된 연구, 이 기억의 감정과 맞는지
function ColorLink({ l }) {
  const r = l.refs?.[0];
  return (
    <span className="why link">
      색-감정 · {l.family}
      {r?.emotions?.length ? ` ↔ ${r.emotions.join("·")}` : ""} ·{" "}
      {VERDICT[l.verdict]}
      {r?.match?.length ? ` (${r.match.join("·")})` : ""}
      {r ? (
        <>
          {" "}
          ·{" "}
          <a href={r.url} target="_blank" rel="noreferrer">
            {r.citation.split(" (")[0]}{" "}
            {(r.citation.match(/\((\d{4})\)/) || [])[1] || ""}
          </a>
        </>
      ) : null}
    </span>
  );
}

// 그리기 전 후보 색 (eng-2.6): 그림 뒤 4색은 이 안에서 골랐다
function Candidates({ list }) {
  return (
    <details className="cands">
      <summary>
        그리기 전 후보 {list.length}색 — 4색은 이 안에서 골랐습니다
      </summary>
      <ul>
        {list.map((c) => (
          <li key={c.id} className={c.chosen ? "on" : ""}>
            <span className="chip" style={{ background: c.hex }} />
            <span>
              {c.id} {c.label}
            </span>
            <small>
              {AXIS[c.origin] || c.origin} ·{" "}
              {c.tier === "large"
                ? `넓게 ${Math.round(c.area_target * 100)}%`
                : "작게"}{" "}
              · 그림에서 {Math.round((c.painted_share || 0) * 100)}%
            </small>
            <span className="num">{c.hex}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

const sign = (n) => (n > 0 ? `+${n}` : `${n}`);

function AreaField({ palette }) {
  return (
    <div className="area-field">
      {palette.map((p) => (
        <span
          key={p.role}
          style={{ background: p.hex, flexGrow: p.area_ratio }}
        />
      ))}
    </div>
  );
}
