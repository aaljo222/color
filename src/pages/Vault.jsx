import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, absUrl } from "../api.js";
import { useAuth } from "../auth.jsx";
import Specimen from "../components/Specimen.jsx";

export default function Vault() {
  const { token, enabled } = useAuth();
  const [items, setItems] = useState(null);
  const [credits, setCredits] = useState(null);
  const [open, setOpen] = useState(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!token) return;
    api("/api/specimens", { token }).then((d) => setItems(d.items)).catch((e) => setErr(e.message));
    api("/api/me/credits", { token }).then(setCredits).catch(() => {});
  }, [token]);

  if (!enabled) return <section><h1 className="title">내 보관함</h1><p className="empty">로그인이 아직 설정되지 않은 사이트입니다 (VITE_SUPABASE_URL 필요).</p></section>;
  if (!token) return <section><h1 className="title">내 보관함</h1><p className="empty">보관함은 로그인한 사람만 볼 수 있습니다. <Link to="/login">로그인하기</Link></p></section>;

  async function claim() {
    setMsg("");
    try {
      const r = await api("/api/me/credits/claim", { method: "POST", token });
      setMsg(r.granted ? "무료 크레딧을 받았습니다." : r.reason);
      setCredits(await api("/api/me/credits", { token }));
    } catch (e) { setMsg(e.message); }
  }
  async function show(id) {
    try { setOpen(await api(`/api/specimens/${id}`, { token })); window.scrollTo({ top: 0, behavior: "smooth" }); } catch (e) { setErr(e.message); }
  }

  return (
    <section>
      <h1 className="title">내 보관함</h1>
      <div className="credit-row">
        <p className="lead">남은 크레딧 <b className="num">{credits ? credits.credits : "…"}</b>. 새 표본을 만들 때 1씩 쓰고, 이미 가진 표본과 같은 기억이면 쓰지 않습니다.</p>
        {credits && !credits.free_credit_claimed && <button className="ghost" onClick={claim}>무료 크레딧 받기</button>}
      </div>
      {msg && <p className="hint">{msg} {msg.includes("추가 인증") && "Google 또는 카카오로 로그인하면 받을 수 있습니다."}</p>}
      {err && <p className="error" role="alert">{err}</p>}
      {open && <Specimen data={open} />}
      {items && items.length === 0 && <p className="empty">아직 표본이 없습니다. <Link to="/">기억 한 문장</Link>으로 첫 표본을 만드세요.</p>}
      {items && items.length > 0 && (
        <div className="gallery">
          {items.map((s) => (
            <button key={s.id} className="gal-item" onClick={() => show(s.id)}>
              {s.thumb_url ? <img src={absUrl(s.thumb_url)} alt="" /> :
                <span className="area-field small">{s.palette.map((p) => <span key={p.role} style={{ background: p.hex, flexGrow: p.area_ratio }} />)}</span>}
              <span className="gal-meta"><span>{s.memory_summary || s.specimen_hash}</span><span>{new Date(s.created_at).toLocaleDateString("ko-KR")}</span></span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
