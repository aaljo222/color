# color-oracle-vercel

색 변환을 LLM 밖에서 결정론적으로 계산하는 Color Oracle을 Vercel에 배포하는 프로젝트입니다.
파이썬 표준 라이브러리만 쓰므로 설치할 패키지는 없습니다.

## 구조

```
color-oracle-vercel/
├─ api/
│  ├─ oracle.py           # 서버리스 함수 → /api/oracle
│  ├─ _color_oracle.py    # 변환 본체 (밑줄 = 함수로 배포되지 않는 내부 모듈)
│  └─ _tool_schema.json   # LLM 도구 정의 5개
├─ public/index.html      # 변환기·팔레트 UI → /
├─ vercel.json
├─ requirements.txt       # 비어 있음 (표준 라이브러리만 사용)
└─ .gitignore
```

## 배포

방법 A: CLI

```bash
npm i -g vercel
cd color-oracle-vercel
vercel          # 처음: 로그인, 프로젝트 이름 지정 → 미리보기 URL
vercel --prod   # 운영 배포
```

방법 B: GitHub 연동

1. 이 폴더를 GitHub 저장소로 push
2. vercel.com → Add New → Project → 저장소 Import
3. Framework Preset: Other, Build Command 비움, Output Directory: `public` → Deploy

배포 후 `https://<프로젝트>.vercel.app/api/oracle?op=selfcheck` 가 `"ok": true` 인지 먼저 확인합니다.

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
vercel dev   # http://localhost:3000
```
