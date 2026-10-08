// 백엔드 호출 한 곳. 로그인했으면 Supabase access_token 을 Bearer 로 붙인다.
export const API = (import.meta.env.VITE_API_BASE || "http://localhost:8000").replace(/\/$/, "");

// 백엔드가 "/api/dev/images/…" 같은 상대 경로를 주면 API 주소를 앞에 붙인다 (메모리 저장소 개발 모드)
export const absUrl = (u) => (u && u.startsWith("/") ? API + u : u);

export async function api(path, { method = "GET", body, token, query } = {}) {
  const url = new URL(API + path);
  if (query) Object.entries(query).forEach(([k, v]) => v !== undefined && url.searchParams.set(k, v));
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(url, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch {
    throw new Error("서버에 연결하지 못했습니다. 백엔드 주소(VITE_API_BASE)와 CORS 설정을 확인하세요.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const d = data.detail;
    const msg = typeof d === "string" ? d : d?.error || (Array.isArray(d) ? d.map((x) => x.msg).join(" · ") : "") || data.error;
    const err = new Error(msg || `요청 실패 (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}
