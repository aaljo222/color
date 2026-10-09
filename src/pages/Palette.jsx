import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";

const SRC = { rule: "규칙으로 계산", lexicon: "어휘사전", llm: "새 장면 추상화" };
const ORIGIN = { rule: "규칙", lexicon: "사전", llm: "새 낱말" };
const EXAMPLES = ["덕수궁 돌담길", "돌담과 하늘 느낌", "벚꽃 아주 연하게", "teal 600보다 한 단계 진하게", "밝기 0.7, 채도 0.12, 색상각 30"];

export default function Palette() {
  const { token } = useAuth();
  const [prompt, setPrompt] = useState("덕수궁 돌담길");
  const [res, setRes] = useState(null);
  const [gal, setGal] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const [sug, setSug] = useState(null);          // 입력 중 추천: 이미 저장된 비슷한 문장
  const typed = useRef(false);

  // 입력이 멈추고 0.45초 뒤 /similar — LLM 을 부르지 않는 조회만 한다
  useEffect(() => {
    if (!typed.current) return;
    const q = prompt.trim();
    if (q.length < 2) { setSug(null); return; }
    const id = setTimeout(() => {
      api("/api/palette/similar", { query: { q, k: 3 } }).then(setSug).catch(() => setSug(null));
    }, 450);
    return () => clearTimeout(id);
  }, [prompt]);

  const loadGallery = () => api("/api/palette/gallery").then((d) => setGal(d.items)).catch(() => {});
  useEffect(() => { loadGallery(); }, []);

  async function run(p, refresh = false) {
    if (!p.trim()) return;
    setBusy(true); setErr(""); setSug(null); typed.current = false;
    try {
      setRes(await api("/api/palette", { method: "POST", token, body: { prompt: p.trim(), refresh } }));
      loadGallery();
    } catch (ex) { setErr(ex.message); } finally { setBusy(false); }
  }

  return (
    <section>
      <h1 className="title">색을 말로 고르기</h1>
      <p className="lead">브랜드 단계, 숫자, 장면 묘사 무엇이든 됩니다. 한 번 계산한 문장과 낱말은 저장돼서, 다시 물어도 같은 색이 나옵니다.</p>
      <form className="memory-form" onSubmit={(e) => { e.preventDefault(); run(prompt); }}>
        <label htmlFor="pp" className="sr">색 문장</label>
        <textarea id="pp" className="memory-input small" rows={2} maxLength={300} value={prompt} onChange={(e) => { typed.current = true; setPrompt(e.target.value); }} />
        {sug?.items?.length > 0 && (
          <div className="similar" aria-live="polite">
            <p className="hint">이미 저장된 비슷한 문장 — 누르면 언어 모델 없이 바로 불러옵니다 <span className="small">({sug.method === "embedding" ? "뜻" : "글자"} 기준)</span></p>
            <SimilarList items={sug.items} onPick={(x) => { setPrompt(x.prompt); run(x.prompt); }} />
          </div>
        )}
        <div className="examples">
          {EXAMPLES.map((x) => <button type="button" key={x} className="ghost" onClick={() => { setPrompt(x); run(x); }}>{x}</button>)}
        </div>
        <div className="form-row">
          <button className="primary" disabled={busy}>{busy ? "계산하는 중…" : "색 계산하기"}</button>
          <button type="button" className="ghost" disabled={busy} onClick={() => run(prompt, true)}
            title="저장된 결과를 버리고 다시 계산해 덮어씁니다. 이미 사전에 있는 낱말의 색은 그대로입니다.">다시 계산</button>
        </div>
        {err && <p className="error" role="alert">{err}</p>}
      </form>

      {res && res.status === "no_color" && <p className="empty">{res.message}</p>}
      {res && res.status === "ok" && (
        <div className="palette-result">
          <img className="thumb-big" src={res.thumbnail} alt={`${res.prompt} 팔레트`} />
          <div>
            <p className="meta">
              {SRC[res.source]} · {res.cached ? "저장된 결과, 언어 모델 호출 없음" : res.llm_used ? "언어 모델 1회 (등급만)" : "언어 모델 호출 없음"}
              {res.new_concepts?.length ? ` · 사전에 추가: ${res.new_concepts.join(", ")}` : ""}
            </p>
            <table className="ptable">
              <thead><tr><th scope="col"><span className="sr">색</span></th><th scope="col">역할</th><th scope="col">HEX</th><th scope="col">OKLCH · LCH</th><th scope="col">등급</th><th scope="col">출처</th></tr></thead>
              <tbody>
                {res.palette.map((p, i) => (
                  <tr key={i}>
                    <td><span className="chip" style={{ background: p.hex }} /></td>
                    <td>{p.label}</td>
                    <td className="num">{p.hex}{p.gamut_mapped ? <em className="tag">채도 줄임</em> : null}</td>
                    <td className="num small">{p.oklch}<br />{p.lch}</td>
                    <td className="small">{p.descriptor ? `${p.descriptor.hue} · 밝기 ${p.descriptor.lightness} · 채도 ${p.descriptor.chroma}` : "—"}</td>
                    <td className="small">{ORIGIN[p.origin]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {res.similar?.items?.length > 0 && (
              <div className="similar">
                <p className="hint">비슷한 저장 문장 <span className="small">(추천일 뿐, 이 결과는 바뀌지 않습니다)</span></p>
                <SimilarList items={res.similar.items} onPick={(x) => { setPrompt(x.prompt); run(x.prompt); window.scrollTo({ top: 0, behavior: "smooth" }); }} />
              </div>
            )}
          </div>
        </div>
      )}

      <h2 className="sub">저장된 문장</h2>
      {gal.length === 0 ? <p className="empty">아직 저장된 문장이 없습니다. 위에서 하나 계산해 보세요.</p> : (
        <div className="gallery">
          {gal.map((g) => (
            <button key={g.key} className="gal-item" onClick={() => { setPrompt(g.prompt); run(g.prompt); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
              <img src={g.thumbnail} alt="" />
              <span className="gal-meta"><span>{g.prompt}</span><span>{g.hits}회</span></span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function SimilarList({ items, onPick }) {
  return (
    <ul className="sim-list">
      {items.map((x) => (
        <li key={x.key}>
          <button type="button" className="sim-item" onClick={() => onPick(x)}>
            <img src={x.thumbnail} alt="" />
            <span className="sim-text">{x.prompt}</span>
            <span className="num small sim-score">{Math.round(x.score * 100)}%</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
