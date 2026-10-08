import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";
import Specimen from "../components/Specimen.jsx";

const EXAMPLE = "초여름 오후, 아빠 손을 잡고 놀이공원 회전목마 앞에서 설레던 기억";

export default function Memory() {
  const { token, user } = useAuth();
  const [memory, setMemory] = useState("");
  const [email, setEmail] = useState("");
  const [keep, setKeep] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [data, setData] = useState(null);
  const n = memory.trim().length;

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      const d = await api("/api/analyze", { method: "POST", token,
        body: { memory: memory.trim(), email: email || null, keep_text: !!user && keep, include_image: true } });
      setData(d);
    } catch (ex) { setErr(ex.message); } finally { setBusy(false); }
  }

  return (
    <section>
      <h1 className="title">기억 한 문장을, 색 표본 한 장으로</h1>
      <p className="lead">같은 기억은 언제 다시 넣어도 같은 네 가지 색이 됩니다. 언어 모델은 감정·시간·장소만 읽고, 색은 계산기가 정합니다.</p>
      <form className="memory-form" onSubmit={submit}>
        <label htmlFor="mem" className="sr">기억 문장</label>
        <textarea id="mem" className="memory-input" rows={3} maxLength={300} value={memory}
          placeholder={EXAMPLE} onChange={(e) => setMemory(e.target.value)} />
        <div className="form-row">
          <span className={`count ${n > 0 && n < 10 ? "warn" : ""}`}>{n} / 300 {n > 0 && n < 10 ? "· 10자 이상 써 주세요" : ""}</span>
          <button type="button" className="ghost" onClick={() => setMemory(EXAMPLE)}>예시 넣기</button>
        </div>
        <div className="form-row wrap">
          <label className="field">
            <span>색 코드를 메일로 받기 (선택, 저장하지 않음)</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </label>
          {user && (
            <label className="check">
              <input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} />
              원문도 암호화해서 보관하기
            </label>
          )}
        </div>
        <button className="primary" disabled={busy || n < 10}>{busy ? "표본을 만드는 중…" : "표본 만들기"}</button>
        {!user && <p className="hint">로그인하지 않으면 하루 2번까지 만들 수 있고, 결과는 저장되지 않습니다. <Link to="/login">로그인</Link>하면 보관함에 남습니다.</p>}
        {err && <p className="error" role="alert">{err}</p>}
      </form>
      {data?.save_error && <p className="hint" role="status">{data.save_error}</p>}
      {data && <Specimen data={data} />}
    </section>
  );
}
