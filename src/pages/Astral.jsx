import { useEffect, useRef } from "react";
import { API } from "../api.js";

// 사주 색 탭 — 박세진님 Astral Color(github.com/ssebni/MaC_astral-color) 화면을 그대로 쓴다.
// 화면·CSS·JS 는 public/astral/ 에 원본 그대로 두고, 바꾼 것은 두 가지뿐:
//   ① API 주소를 ?api= 로 넘겨 백엔드(Railway)의 /api/astral, /api/astral/report-preview 를 부른다
//   ② 탭 안에서는 원본 페이지의 자체 헤더를 숨긴다 (MaC 헤더가 이미 위에 있으므로)
// iframe 은 MaC 헤더 아래 남은 화면을 꽉 채우고 안에서 스크롤한다.
// (내용 높이만큼 늘리면 원본의 결제 창(<dialog>)이 긴 iframe 한가운데 떠서 화면 밖으로 나간다)
export default function Astral() {
  const ref = useRef(null);
  useEffect(() => {
    document.body.classList.add("astral-mode");
    const fit = () => {
      const el = ref.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY;
      el.style.height = `${Math.max(560, window.innerHeight - top)}px`;
    };
    fit();
    window.addEventListener("resize", fit);
    return () => { window.removeEventListener("resize", fit); document.body.classList.remove("astral-mode"); };
  }, []);
  return (
    <iframe
      ref={ref}
      className="astral-frame"
      title="Astral Color · 사주로 찾는 나의 색"
      src={`/astral/astral.html?api=${encodeURIComponent(API)}`}
    />
  );
}
