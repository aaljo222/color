import { useEffect } from "react";
import { NavLink, Route, Routes, useNavigate } from "react-router-dom";
import { useAuth, supabase } from "./auth.jsx";
import Memory from "./pages/Memory.jsx";
import Palette from "./pages/Palette.jsx";
import Tools from "./pages/Tools.jsx";
import Vault from "./pages/Vault.jsx";
import Login from "./pages/Login.jsx";
import Signup from "./pages/Signup.jsx";
import Concierge from "./pages/Concierge.jsx";
import Astral from "./pages/Astral.jsx";

const NAV = [["/", "기억 표본"], ["/palette", "색 문장"], ["/tools", "색 변환"], ["/astral", "사주 색"], ["/vault", "내 보관함"], ["/concierge", "문의"]];

export default function App() {
  const { user } = useAuth();
  const nav = useNavigate();
  // 메일 링크가 만료·무효면 Supabase가 #error_code=... 를 붙여 돌려보낸다 → 로그인 화면에서 안내
  useEffect(() => {
    const h = new URLSearchParams(window.location.hash.slice(1));
    const code = h.get("error_code");
    if (code) nav(`/login?err=${encodeURIComponent(code)}`, { replace: true });
  }, [nav]);
  return (
    <div className="shell">
      <header className="top">
        <NavLink to="/" className="mark" aria-label="MaC 처음으로">
          <span className="mark-word">MaC</span>
          <span className="mark-sub">Memory &amp; Color</span>
        </NavLink>
        <nav className="nav" aria-label="주 메뉴">
          {NAV.map(([to, label]) => (
            <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => (isActive ? "on" : "")}>{label}</NavLink>
          ))}
        </nav>
        <div className="who">
          {user ? (
            <button className="link" onClick={() => supabase.auth.signOut()}>로그아웃</button>
          ) : (
            <><NavLink to="/login" className="link">로그인</NavLink><span className="sep" aria-hidden>·</span><NavLink to="/signup" className="link">회원가입</NavLink></>
          )}
        </div>
      </header>
      <main className="main">
        <Routes>
          <Route path="/" element={<Memory />} />
          <Route path="/palette" element={<Palette />} />
          <Route path="/tools" element={<Tools />} />
          <Route path="/astral" element={<Astral />} />
          <Route path="/vault" element={<Vault />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/concierge" element={<Concierge />} />
          <Route path="*" element={<p className="empty">없는 페이지입니다. 위 메뉴에서 고르세요.</p>} />
        </Routes>
      </main>
      <footer className="foot">
        <p>색 값은 언어 모델이 아니라 계산기가 정합니다. 같은 기억은 같은 표본이 됩니다.</p>
      </footer>
    </div>
  );
}
