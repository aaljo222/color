import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";

export default function Tools() {
  const [L, setL] = useState(0.52), [C, setC] = useState(0.11), [H, setH] = useState(196.85);
  const [out, setOut] = useState(null);
  const [hex, setHex] = useState("#00b8bb");
  const [conv, setConv] = useState(null);
  const [brand, setBrand] = useState("#00b8bb");
  const [scale, setScale] = useState(null);
  const [check, setCheck] = useState(null);
  const [err, setErr] = useState("");
  const t = useRef();

  useEffect(() => { api("/api/oracle", { query: { op: "selfcheck" } }).then(setCheck).catch(() => setCheck({ ok: false })); }, []);
  useEffect(() => {
    clearTimeout(t.current);
    t.current = setTimeout(() => api("/api/oracle", { query: { op: "oklch2hex", L, C, H } }).then(setOut).catch((e) => setErr(e.message)), 120);
  }, [L, C, H]);

  async function toOk(e) {
    e.preventDefault(); setErr("");
    try {
      const [o, l] = await Promise.all([api("/api/oracle", { query: { op: "hex2oklch", hex } }), api("/api/oracle", { query: { op: "hex2lch", hex } })]);
      setConv({ o, l, hex });
    } catch (ex) { setErr(ex.message); }
  }
  async function mkScale(e) {
    e.preventDefault(); setErr("");
    try { setScale(await api("/api/oracle", { query: { op: "scale", hex: brand, name: "brand" } })); } catch (ex) { setErr(ex.message); }
  }

  return (
    <section>
      <h1 className="title">색 변환</h1>
      <p className="lead">디자이너가 쓰는 OKLCH와 코드가 쓰는 HEX를 서버의 계산기로 바꿉니다.</p>
      {check && <p className={`stamp inline ${check.ok ? "ok" : "no"}`}>{check.ok ? `자가 검산 ${check.items.length}/${check.items.length} 통과` : "계산기에 연결하지 못했습니다"}</p>}
      {err && <p className="error" role="alert">{err}</p>}
      <div className="tools">
        <form className="tool" onSubmit={(e) => e.preventDefault()}>
          <h2 className="sub">OKLCH에서 HEX로</h2>
          <Slider label="밝기 L" min={0} max={1} step={0.005} v={L} set={setL} />
          <Slider label="채도 C" min={0} max={0.4} step={0.001} v={C} set={setC} />
          <Slider label="색상 H" min={0} max={360} step={0.05} v={H} set={setH} />
          {out && <div className="result"><span className="swatch" style={{ background: out.hex }} /><span className="num big">{out.hex}</span>{out.gamut_mapped && <em className="tag">화면 밖이라 채도 줄임</em>}</div>}
        </form>
        <form className="tool" onSubmit={toOk}>
          <h2 className="sub">HEX에서 OKLCH·LCH로</h2>
          <div className="form-row"><input aria-label="HEX" value={hex} onChange={(e) => setHex(e.target.value)} /><button className="primary">바꾸기</button></div>
          {conv && <div className="result"><span className="swatch" style={{ background: conv.hex }} /><span className="num">{conv.o.css}<br />{conv.l.css}</span></div>}
        </form>
      </div>
      <form className="tool wide" onSubmit={mkScale}>
        <h2 className="sub">브랜드 색으로 50–900 단계 만들기</h2>
        <div className="form-row"><input aria-label="브랜드 HEX" value={brand} onChange={(e) => setBrand(e.target.value)} /><button className="primary">단계 만들기</button></div>
        {scale && (
          <>
            <div className="scale">
              {Object.entries(scale.steps).map(([s, v]) => (
                <div key={s} className={`step ${v.brand ? "brand" : ""}`} title={v.oklch}>
                  <span style={{ background: v.hex }} />
                  <b>{s}</b><span className="num small">{v.hex}</span>{v.gamut_mapped && <em className="tag">줄임</em>}
                </div>
              ))}
            </div>
            <pre className="css">{scale.css}</pre>
          </>
        )}
      </form>
    </section>
  );
}

function Slider({ label, min, max, step, v, set }) {
  return (
    <label className="slider">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={v} onChange={(e) => set(+e.target.value)} />
      <input type="number" min={min} max={max} step={step} value={v} onChange={(e) => set(+e.target.value)} aria-label={`${label} 값`} />
    </label>
  );
}
