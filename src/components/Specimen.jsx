import { absUrl } from "../api.js";

export const ROLE = { dominant: "주조색", supporting: "보조색", atmospheric: "분위기색", accent: "강조색" };
const AXIS = { emotion: "감정", time: "시간", space: "장소", quality: "선명도", object: "사물" };
const HOW = { keyword: "낱말 일치", label: "모델 라벨", retrieval: "검색", fallback: "기본 톤", lexicon: "사전 등급", grade: "모델 등급" };

// 기억 표본 한 장: 왼쪽 그림, 오른쪽 라벨(해시·면적비 막대·색 목록·검증)
export default function Specimen({ data }) {
  const img = data.image_png_base64 ? `data:image/png;base64,${data.image_png_base64}` : absUrl(data.image_url);
  const v = data.verification || {};
  return (
    <article className="plate" aria-label={`색 표본 ${data.specimen_hash}`}>
      <div className="plate-field">
        {img ? <img src={img} alt="표본 그림" /> : <AreaField palette={data.palette} />}
      </div>
      <div className="plate-label">
        <p className="hash">{data.specimen_hash}</p>
        {data.memory_summary && <p className="summary">{data.memory_summary}</p>}
        <div className="ratio" role="img" aria-label="면적 비율">
          {data.palette.map((p) => <span key={p.role} style={{ background: p.hex, flexGrow: p.area_ratio }} />)}
        </div>
        <ul className="roles">
          {data.palette.map((p) => (
            <li key={p.role}>
              <span className="chip" style={{ background: p.hex }} />
              <span className="role">{ROLE[p.role] || p.role}<small>{Math.round(p.area_ratio * 100)}%</small></span>
              <span className="name">{p.color_name}</span>
              <span className="num">{p.hex}</span>
              {p.basis && (
                <span className="why">
                  {AXIS[p.basis.axis]} “{p.basis.phrase || "—"}” · {HOW[p.basis.how] || p.basis.how}
                  {p.basis.adjust ? " · 대비 보정" : ""}
                </span>
              )}
            </li>
          ))}
        </ul>
        {v.status && (
          <p className={`stamp ${v.status === "PASS" ? "ok" : "no"}`}>
            {v.status === "PASS" ? "측정 일치" : "측정 불일치"} · 최대 ΔE00 {Number(v.max_de00).toFixed(2)}
          </p>
        )}
        <p className="meta">
          {data.kb_version} / {data.engine_version}
          {data.cache_hit ? " · 같은 기억이라 같은 표본" : ""}
          {data.already_owned ? " · 이미 보관함에 있음" : ""}
        </p>
      </div>
    </article>
  );
}

function AreaField({ palette }) {
  return (
    <div className="area-field">
      {palette.map((p) => <span key={p.role} style={{ background: p.hex, flexGrow: p.area_ratio }} />)}
    </div>
  );
}
