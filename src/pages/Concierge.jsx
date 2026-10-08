import { useState } from "react";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";

const TYPES = [["bespoke", "맞춤 표본 제작"], ["acquisition", "표본 소장"], ["viewing", "전시·관람"], ["partnership", "제휴"]];

export default function Concierge() {
  const { token } = useAuth();
  const [f, setF] = useState({ client_name: "", contact: "", request_type: "bespoke", message: "" });
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault(); setErr("");
    try { await api("/api/concierge", { method: "POST", token, body: f }); setDone(true); } catch (ex) { setErr(ex.message); }
  }
  if (done) return <section className="narrow"><h1 className="title">문의를 보냈습니다</h1><p className="lead">남겨 주신 연락처로 답을 드립니다. 연락처는 암호화해서 보관합니다.</p></section>;
  return (
    <section className="narrow">
      <h1 className="title">문의</h1>
      <p className="lead">맞춤 표본, 소장, 전시, 제휴에 대해 남겨 주세요.</p>
      <form className="stack" onSubmit={submit}>
        <label className="field"><span>이름</span><input required maxLength={50} value={f.client_name} onChange={set("client_name")} /></label>
        <label className="field"><span>연락처 (이메일 또는 전화)</span><input required minLength={3} maxLength={100} value={f.contact} onChange={set("contact")} /></label>
        <label className="field"><span>문의 종류</span>
          <select value={f.request_type} onChange={set("request_type")}>{TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        </label>
        <label className="field"><span>내용</span><textarea required rows={5} maxLength={2000} value={f.message} onChange={set("message")} /></label>
        <button className="primary">문의 보내기</button>
        {err && <p className="error" role="alert">{err}</p>}
      </form>
    </section>
  );
}
