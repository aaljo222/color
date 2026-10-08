# color-oracle-vercel

색 변환을 LLM 밖에서 결정론적으로 계산하는 Color Oracle을 Vercel에 배포하는 프로젝트입니다.
파이썬 표준 라이브러리만 쓰므로 설치할 패키지는 없습니다.

## 구조

```
color-oracle-vercel/
├─ app.py              # Vercel 엔트리포인트 (WSGI app) → /, /api/oracle, /api/ask
├─ ask.py              # 프롬프트 → Claude 의도 해석 → 격자 스냅 → 오라클 계산 → 대조 검증 → 고정 저장
├─ supabase_color_prompts.sql  # (선택) 프롬프트별 고정값 표
├─ color_oracle.py     # 변환 본체
├─ tool_schema.json    # LLM 도구 정의 6개 (step 포함)
├─ templates/index.html# 변환기·팔레트 화면
├─ pyproject.toml      # [tool.vercel] entrypoint = "app:app", 의존성 없음
├─ vercel.json
└─ .gitignore
```

## 배포

GitHub 연동(현재 aaljo222/color): 위 파일을 저장소 루트에 그대로 두고 push 하면 자동 빌드됩니다.
예전 `api/`, `public/`, `requirements.txt`는 지웁니다.

```bash
git rm -r --cached api public requirements.txt 2>/dev/null; rm -rf api public requirements.txt
git add -A && git commit -m "Vercel Python entrypoint로 전환" && git push
```

CLI로 올릴 때:

```bash
npm i -g vercel
vercel --prod
```

배포 후 `https://<프로젝트>.vercel.app/api/oracle?op=selfcheck` 가 `"ok": true` 인지 먼저 확인합니다.
Vercel 프로젝트 설정의 Framework Preset이 다른 값으로 잡혀 있으면 Other(또는 Python)로 바꿉니다.

## 프롬프트 기능 (/api/ask)

Vercel → Project → Settings → Environment Variables 에 넣고 Redeploy 합니다.

| 이름 | 필수 | 설명 |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | 예 | Claude API 키 |
| `CLAUDE_MODEL` | 아니오 | 기본 `claude-sonnet-5-5` |
| `SUPABASE_URL` | 권장 | 같은 프롬프트 → 항상 같은 값 (고정 저장) |
| `SUPABASE_SERVICE_KEY` | 권장 | Supabase service_role 키 (서버 전용, 브라우저에 노출 금지) |
| `ACCESS_TOKEN` | 권장 | 설정하면 화면의 "접근 토큰" 칸에 같은 값을 넣어야 호출됨 (공개 URL로 API 크레딧이 새는 것 방지) |

```bash
curl -X POST https://<프로젝트>.vercel.app/api/ask \
  -H "Content-Type: application/json" -H "X-Access-Token: <토큰>" \
  -d '{"prompt":"Kriteq teal 600보다 한 단계 진하게"}'
```

**프롬프트 유형**: 브랜드 단계("teal 600보다 한 단계 진하게") · 수치 직접 지정 · 장면 묘사("덕수궁 돌담길" → 역할별 3~5색 팔레트).

**같은 프롬프트 → 같은 값**: ① LLM이 고른 OKLCH를 서버가 격자(L 0.02 · C 0.01 · H 5°)에 맞춤 ② 검증 통과한 첫 결과를 Supabase `color_prompts`에 고정, 이후 그대로 반환. Supabase SQL Editor에서 `supabase_color_prompts.sql`을 한 번 실행합니다. 고정값을 바꾸려면 화면의 "다시 계산"(요청 `{"refresh": true}`).

**status**: `verified`(값 = 오라클 결과) · `failed`(답에 오라클이 계산하지 않은 HEX) · `no_color`(색과 무관한 요청).

응답의 `final`(hex·oklch·lch)은 LLM 문장이 아니라 마지막 오라클 결과에서 서버가 만든 값입니다.
`verified`가 false면 LLM 답에 오라클이 계산하지 않은 HEX가 섞였거나 도구를 부르지 않은 경우입니다.

## API

| 요청 | 결과 |
| --- | --- |
| `GET /api/oracle?op=hex2oklch&hex=%2300b8bb` | `{"L":0.7096,"C":0.1208,"H":196.85,"css":"oklch(...)"}` |
| `GET /api/oracle?op=oklch2hex&L=0.52&C=0.11&H=196.85` | `{"hex":"#007b7e","gamut_mapped":true}` |
| `GET /api/oracle?op=hex2lch&hex=%230a2242` | CIE LCH (D50) |
| `GET /api/oracle?op=lch2hex&L=50&C=40&H=200` | `{"hex":...,"gamut_mapped":...}` |
| `GET /api/oracle?op=scale&hex=%2300b8bb&name=teal` | 50~900 단계 + CSS 변수 |
| `GET /api/oracle?op=selfcheck` | 자가 검산 7항목 |
| `GET /api/oracle?op=tools` | LLM 도구 정의 JSON |
| `POST /api/oracle` `{"name":"oklch2hex","input":{"L":0.52,"C":0.11,"H":196.85}}` | 모델의 tool_use를 그대로 실행 |

HEX의 `#`은 URL에서 `%23`으로 씁니다.

## LLM 연결 (Claude 도구 사용 예)

```python
import anthropic, requests, json
BASE = "https://<프로젝트>.vercel.app/api/oracle"
tools = requests.get(BASE, params={"op": "tools"}).json()
client = anthropic.Anthropic()
msgs = [{"role": "user", "content": "teal(#00b8bb) 600 단계 HEX 알려줘. 밝기 0.52"}]
while True:
    r = client.messages.create(model="claude-sonnet-5-5", max_tokens=1024, tools=tools, messages=msgs)
    msgs.append({"role": "assistant", "content": r.content})
    uses = [b for b in r.content if b.type == "tool_use"]
    if not uses:
        print(r.content[0].text); break
    msgs.append({"role": "user", "content": [
        {"type": "tool_result", "tool_use_id": u.id,
         "content": json.dumps(requests.post(BASE, json={"name": u.name, "input": u.input}).json()["result"], ensure_ascii=False)}
        for u in uses]})
```

## 로컬 확인

```bash
python app.py   # http://localhost:8000 (표준 라이브러리 wsgiref)
```
