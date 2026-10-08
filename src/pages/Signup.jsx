import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase, useAuth } from "../auth.jsx";

// Supabase 오류 메시지 → 한국어
function ko(msg = "") {
  const m = msg.toLowerCase();
  if (m.includes("already registered") || m.includes("already exists")) return "이미 가입된 이메일입니다. 로그인해 주세요.";
  if (m.includes("password") && m.includes("characters")) return "비밀번호가 너무 짧습니다.";
  if (m.includes("rate limit") || m.includes("too many")) return "요청이 많습니다. 잠시 뒤 다시 시도하세요.";
  if (m.includes("not authorized")) return "이 이메일로는 가입 메일을 보낼 수 없습니다 (메일 서버 설정 필요). 관리자에게 알려 주세요.";
  if (m.includes("sending") && m.includes("email")) return "가입 확인 메일을 보내지 못했습니다. 잠시 뒤 다시 시도하세요.";
  if (m.includes("database error")) return "가입 정보를 저장하지 못했습니다. 관리자에게 알려 주세요.";
  if (m.includes("weak") || m.includes("pwned")) return "더 강한 비밀번호를 쓰세요 (흔한 비밀번호는 막혀 있습니다).";
  if (m.includes("invalid") && m.includes("email")) return "이메일 형식을 확인하세요.";
  return `가입하지 못했습니다: ${msg}`;
}

function strength(pw) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Za-z]/.test(pw) && /\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw) || pw.length >= 12) s++;
  return s; // 0~3
}
const LABEL = ["너무 약함", "약함", "보통", "강함"];

export default function Signup() {
  const { user, enabled } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ name: "", email: "", pw: "", pw2: "" });
  const [agree, setAgree] = useState({ terms: false, privacy: false });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [sentTo, setSentTo] = useState("");

  if (!enabled) return <section><h1 className="title">회원가입</h1><p className="empty">이 사이트는 아직 로그인이 설정되지 않았습니다. 관리자는 VITE_SUPABASE_URL과 VITE_SUPABASE_ANON_KEY를 넣어 주세요.</p></section>;
  if (user) return <section><h1 className="title">이미 로그인되어 있습니다</h1><p className="lead">{user.email}</p><button className="primary" onClick={() => nav("/vault")}>보관함 열기</button></section>;

  if (sentTo) return (
    <section className="narrow">
      <h1 className="title">메일을 확인하세요</h1>
      <p className="lead"><b>{sentTo}</b>로 가입 확인 메일을 보냈습니다. 메일의 링크를 누르면 가입이 끝나고 바로 로그인됩니다.</p>
      <p className="hint">메일이 안 보이면 스팸함을 확인하세요.</p>
      <button className="ghost" onClick={resend} disabled={busy}>확인 메일 다시 보내기</button>
      {err && <p className="hint" role="status">{err}</p>}
      <p className="hint"><Link to="/login">로그인 화면으로</Link></p>
    </section>
  );

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const s = strength(f.pw);
  const mismatch = f.pw2 && f.pw !== f.pw2;
  const ready = f.email && f.pw.length >= 8 && f.pw === f.pw2 && agree.terms && agree.privacy && !busy;

  async function submit(e) {
    e.preventDefault();
    if (!ready) return;
    setBusy(true); setErr("");
    const { data, error } = await supabase.auth.signUp({
      email: f.email.trim(),
      password: f.pw,
      options: {
        data: { name: f.name.trim() || null },
        emailRedirectTo: window.location.origin + "/vault",
      },
    });
    setBusy(false);
    if (error) return setErr(ko(error.message));
    // 이메일 중복이면 Supabase는 오류 대신 identities 가 빈 user 를 돌려준다
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0)
      return setErr("이미 가입된 이메일입니다. 로그인해 주세요.");
    if (data.session) return nav("/vault");      // 메일 확인을 끈 프로젝트
    setSentTo(f.email.trim());
  }

  async function resend() {
    setBusy(true); setErr("");
    const { error } = await supabase.auth.resend({ type: "signup", email: sentTo, options: { emailRedirectTo: window.location.origin + "/vault" } });
    setBusy(false);
    setErr(error ? ko(error.message) : "다시 보냈습니다.");
  }

  const oauth = (provider) => supabase.auth.signInWithOAuth({ provider, options: { redirectTo: window.location.origin + "/vault" } });

  return (
    <section className="narrow">
      <h1 className="title">회원가입</h1>
      <p className="lead">가입하면 만든 표본이 보관함에 남습니다. Google·카카오로 가입하면 무료 크레딧도 받을 수 있습니다.</p>

      <div className="form-row">
        <button type="button" className="ghost" onClick={() => oauth("google")}>Google로 가입</button>
        <button type="button" className="ghost" onClick={() => oauth("kakao")}>카카오로 가입</button>
      </div>
      <p className="divider"><span>또는 이메일로</span></p>

      <form className="stack" onSubmit={submit} noValidate>
        <label className="field"><span>이름 (선택)</span>
          <input value={f.name} onChange={set("name")} maxLength={30} autoComplete="name" /></label>
        <label className="field"><span>이메일</span>
          <input type="email" required value={f.email} onChange={set("email")} autoComplete="email" /></label>
        <label className="field"><span>비밀번호 (8자 이상)</span>
          <input type="password" required minLength={8} value={f.pw} onChange={set("pw")} autoComplete="new-password" aria-describedby="pw-meter" />
          {f.pw && (
            <span id="pw-meter" className="meter" data-s={s}>
              <i /><i /><i /><em>{f.pw.length < 8 ? "8자 이상 입력하세요" : LABEL[s]}</em>
            </span>
          )}
        </label>
        <label className="field"><span>비밀번호 확인</span>
          <input type="password" required value={f.pw2} onChange={set("pw2")} autoComplete="new-password" aria-invalid={mismatch || undefined} />
          {mismatch && <em className="field-err">비밀번호가 서로 다릅니다.</em>}
        </label>

        <fieldset className="agree">
          <legend className="sr">약관 동의</legend>
          <label className="check"><input type="checkbox" checked={agree.terms && agree.privacy}
            onChange={(e) => setAgree({ terms: e.target.checked, privacy: e.target.checked })} /><b>모두 동의</b></label>
          <label className="check"><input type="checkbox" checked={agree.terms} onChange={(e) => setAgree({ ...agree, terms: e.target.checked })} />
            (필수) 이용약관에 동의합니다</label>
          <label className="check"><input type="checkbox" checked={agree.privacy} onChange={(e) => setAgree({ ...agree, privacy: e.target.checked })} />
            (필수) 개인정보 수집·이용에 동의합니다 — 이메일·이름, 탈퇴 시 삭제. 기억 문장 원문은 암호화해 보관합니다.</label>
        </fieldset>

        <button className="primary" disabled={!ready}>{busy ? "가입 중…" : "가입하기"}</button>
        {err && <p className="error" role="alert">{err}</p>}
      </form>
      <p className="hint">이미 계정이 있나요? <Link to="/login">로그인</Link></p>
    </section>
  );
}
