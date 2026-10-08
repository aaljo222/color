import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, useAuth } from "../auth.jsx";

export default function Login() {
  const { user, enabled } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [mode, setMode] = useState("login");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  if (!enabled) return <section><h1 className="title">로그인</h1><p className="empty">이 사이트는 아직 로그인이 설정되지 않았습니다. 관리자는 VITE_SUPABASE_URL과 VITE_SUPABASE_ANON_KEY를 넣어 주세요.</p></section>;
  if (user) return <section><h1 className="title">로그인됨</h1><p className="lead">{user.email}</p><button className="primary" onClick={() => nav("/vault")}>보관함 열기</button></section>;

  async function submit(e) {
    e.preventDefault(); setBusy(true); setMsg("");
    const f = mode === "login" ? supabase.auth.signInWithPassword : supabase.auth.signUp;
    const { error, data } = await f.call(supabase.auth, { email, password: pw });
    setBusy(false);
    if (error) return setMsg(error.message === "Invalid login credentials" ? "이메일 또는 비밀번호가 맞지 않습니다." : error.message);
    if (mode === "signup" && !data.session) return setMsg("가입 확인 메일을 보냈습니다. 메일의 링크를 누른 뒤 로그인하세요.");
    nav("/vault");
  }
  const oauth = (provider) => supabase.auth.signInWithOAuth({ provider, options: { redirectTo: window.location.origin + "/vault" } });

  return (
    <section className="narrow">
      <h1 className="title">{mode === "login" ? "로그인" : "회원가입"}</h1>
      <p className="lead">Google이나 카카오로 로그인하면 무료 크레딧을 받을 수 있습니다. 이메일 가입만으로는 받을 수 없습니다.</p>
      <div className="form-row">
        <button className="ghost" onClick={() => oauth("google")}>Google로 계속하기</button>
        <button className="ghost" onClick={() => oauth("kakao")}>카카오로 계속하기</button>
      </div>
      <form className="stack" onSubmit={submit}>
        <label className="field"><span>이메일</span><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>
        <label className="field"><span>비밀번호 (6자 이상)</span><input type="password" required minLength={6} value={pw} onChange={(e) => setPw(e.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} /></label>
        <button className="primary" disabled={busy}>{mode === "login" ? "로그인" : "가입하기"}</button>
        {msg && <p className="hint" role="status">{msg}</p>}
      </form>
      <button className="link" onClick={() => setMode(mode === "login" ? "signup" : "login")}>
        {mode === "login" ? "계정이 없나요? 회원가입" : "이미 계정이 있나요? 로그인"}
      </button>
    </section>
  );
}
