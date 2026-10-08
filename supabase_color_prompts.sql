-- Color Oracle: 프롬프트별 고정 결과 (같은 프롬프트 → 항상 같은 값)
create table if not exists public.color_prompts (
  prompt     text primary key,          -- 공백 정리 + 소문자
  result     jsonb not null,            -- /api/ask 응답 (status=verified 인 것만)
  created_at timestamptz not null default now()
);
-- 서버(service_role 키)만 접근. 브라우저 anon 키로는 읽기·쓰기 불가.
alter table public.color_prompts enable row level security;
