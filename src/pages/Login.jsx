import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase, useAuth } from "../auth.jsx";

export default function Login() {
  const { user, enabled } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  if (!enabled) return <section><h1 className="title">로그인</h1><p className="empty">이 사이트는 아직 로그인이 설정되지 않았습니다. 관리자는 VITE_SUPABASE_URL과 VITE_SUPABASE_ANON_KEY를 넣어 주세요.</p></section>;
  if (user) return <section><h1 className="title">로그인됨</h1><p className="lead">{user.email}</p><button className="primary" onClick={() => nav("/vault")}>보관함 열기</button></section>;

  async function submit(e) {
    e.preventDefault(); setBusy(true); setMsg("");
    const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
    setBusy(false);
    if (error) {
      const m = error.message || "";
      if (m === "Invalid login credentials") return setMsg("이메일 또는 비밀번호가 맞지 않습니다.");
      if (m.toLowerCase().includes("not confirmed")) return setMsg("가입 확인 메일의 링크를 먼저 눌러 주세요.");
      return setMsg("로그인하지 못했습니다. 잠시 뒤 다시 시도하세요.");
    }
    nav("/vault");
  }
  const oauth = (provider) => supabase.auth.signInWithOAuth({ provider, options: { redirectTo: window.location.origin + "/vault" } });

  return (
    <section className="narrow">
      <h1 className="title">로그인</h1>
      <p className="lead">Google이나 카카오로 로그인하면 무료 크레딧을 받을 수 있습니다. 이메일 가입만으로는 받을 수 없습니다.</p>
      <div className="form-row">
        <button type="button" className="ghost" onClick={() => oauth("google")}>Google로 계속하기</button>
        <button type="button" className="ghost" onClick={() => oauth("kakao")}>카카오로 계속하기</button>
      </div>
      <form className="stack" onSubmit={submit}>
        <label className="field"><span>이메일</span><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>
        <label className="field"><span>비밀번호</span><input type="password" required minLength={6} value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" /></label>
        <button className="primary" disabled={busy}>{busy ? "로그인 중…" : "로그인"}</button>
        {msg && <p className="hint" role="status">{msg}</p>}
      </form>
      <p className="hint">계정이 없나요? <Link to="/signup">회원가입</Link></p>
    </section>
  );
}
