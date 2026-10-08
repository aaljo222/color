# -*- coding: utf-8 -*-
"""자연어 프롬프트 → 색 토큰 (한 색 또는 장면 팔레트).

역할 분리
  LLM       : 문장을 읽고 "어떤 색을 원하는지"만 정한다 — 브랜드·단계, 또는 장면의 색 역할과 OKLCH 의도값.
  서버 스냅 : LLM이 고른 OKLCH를 정해진 격자(L 0.02 · C 0.01 · H 5°)에 맞춘다.
              → 해석이 조금 흔들려도 같은 격자점이면 같은 HEX가 나온다.
  오라클    : 모든 숫자(HEX·OKLCH·LCH)를 계산한다 (color_oracle, 결정론).
  대조 게이트: LLM 답에 나온 HEX가 전부 오라클 결과(또는 사용자가 준 값)에 있는지 대조한다.

status
  verified  : 색이 계산되었고, 답의 HEX가 전부 오라클 결과와 일치
  failed    : 답에 오라클이 계산하지 않은 HEX가 섞임 (기억으로 쓴 값)
  no_color  : 색을 정하지 않음 (색과 무관한 요청 등) — 실패가 아니라 해석 불가

같은 프롬프트 → 항상 같은 값 (고정 저장)
  격자 스냅만으로는 LLM이 격자 경계 양쪽을 오가면 값이 달라진다.
  그래서 검증 통과한 첫 결과를 Supabase 표 color_prompts에 고정하고, 이후 같은 프롬프트는 그 값을 돌려준다.
  SUPABASE_URL·SUPABASE_SERVICE_KEY가 없으면 같은 서버 인스턴스 안의 메모리 캐시만 쓴다.
  refresh=true로 요청하면 다시 계산해 고정값을 덮어쓴다.

환경변수
  ANTHROPIC_API_KEY (필수) · CLAUDE_MODEL (기본 claude-sonnet-5-5) · ACCESS_TOKEN (선택, app.py에서 검사)
  SUPABASE_URL · SUPABASE_SERVICE_KEY (선택, 고정 저장)
"""
import json, os, re, urllib.request, urllib.error, urllib.parse

import color_oracle as co

API_URL = "https://api.anthropic.com/v1/messages"
MODEL = os.environ.get("CLAUDE_MODEL", "claude-sonnet-5-5")
MAX_TURNS = 8
MAX_PROMPT = 300
GRID = {"L": 0.02, "C": 0.01, "H": 5.0}   # 장면 색 스냅 격자

BRANDS = {  # 이름 → 원색. 여기 적힌 것만 '브랜드 색'으로 인정한다.
    "kriteq navy": "#0a2242",
    "kriteq teal": "#00b8bb",
}

SYSTEM = f"""너는 디자이너의 색 요청을 해석해 색 토큰을 만드는 도우미다.

절대 규칙
- HEX·OKLCH·LCH 숫자를 기억이나 추측으로 답에 쓰지 마라. 답의 숫자는 전부 도구 결과에서 가져온다.
- 도구를 부를 때 label에 그 색의 역할을 짧은 한국어로 적는다 (예: "돌담", "기와", "배경", "버튼 hover").

요청 유형별 처리
A. 브랜드 색: 다음만 인정한다 {json.dumps(BRANDS, ensure_ascii=False)}. "teal"·"틸"은 kriteq teal, "navy"·"네이비"는 kriteq navy.
   단계(50~900)는 step 도구로 계산한다. "한 단계 진하게"=+100, "연하게"=-100, "두 단계"=±200.
   기준 단계가 없으면 브랜드 원색 단계(step 결과의 brand_step)가 기준. 범위를 넘으면 끝 단계로 맞추고 그렇게 말한다.
B. 밝기·채도·색상각을 직접 준 요청: 그 값 그대로 oklch2hex(또는 lch2hex)로 계산한다.
C. 장소·계절·사물·재료·분위기 같은 장면 묘사(예: "덕수궁 돌담길", "비 오는 가을 저녁"):
   그 장면을 대표하는 색 3~5개를 정한다. 각 색마다 OKLCH 의도값을 정해 oklch2hex(label 포함)를 부른다.
   값은 격자에 맞춰 고른다: L은 0.02 단위, C는 0.01 단위, H는 5도 단위. 서버도 이 격자로 맞춘다.
   같은 장면이면 같은 색을 고르도록, 장면의 실제 재료·빛을 기준으로 판단한다(유행·기분으로 바꾸지 않는다).
D. 색과 전혀 관계없는 요청(날씨, 계산 등)만 도구 없이 "색 요청만 도울 수 있다"고 답한다. 장면 묘사는 D가 아니다.

마지막 답
- 한국어 두세 문장: 어떻게 해석했는지. 장면이면 각 색의 역할을 짧게.
- HEX를 쓴다면 도구 결과의 HEX만 쓴다."""

HEX_RE = re.compile(r"#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![0-9a-fA-F])")
_cache = {}


class LLMError(Exception):
    pass


def _key(prompt):
    return " ".join(prompt.split()).lower()


def _sb():
    url, key = os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_SERVICE_KEY")
    return (url.rstrip("/"), key) if url and key else None


def _store_get(prompt):
    sb = _sb()
    if not sb:
        return _cache.get(_key(prompt))
    url, key = sb
    q = urllib.parse.urlencode({"prompt": "eq." + _key(prompt), "select": "result"})
    req = urllib.request.Request(f"{url}/rest/v1/color_prompts?{q}", headers={"apikey": key, "Authorization": f"Bearer {key}"})
    try:
        with urllib.request.urlopen(req, timeout=8) as r:
            rows = json.loads(r.read())
        return rows[0]["result"] if rows else None
    except Exception:
        return _cache.get(_key(prompt))   # 저장소 장애 시 계산으로 진행


def _store_put(prompt, out, overwrite=False):
    _cache[_key(prompt)] = out
    sb = _sb()
    if not sb:
        return
    url, key = sb
    body = json.dumps({"prompt": _key(prompt), "result": out}, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(f"{url}/rest/v1/color_prompts?on_conflict=prompt", data=body, method="POST", headers={
        "apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates" if overwrite else "resolution=ignore-duplicates"})
    try:
        urllib.request.urlopen(req, timeout=8).close()
    except Exception:
        pass


def _norm_hex(h):
    s = h.lstrip("#").lower()
    if len(s) == 3:
        s = "".join(c * 2 for c in s)
    return "#" + s


def _hexes_in(obj, out):
    """도구 결과 안의 모든 HEX를 모은다 (대조 게이트의 허용 목록)."""
    if isinstance(obj, dict):
        for v in obj.values(): _hexes_in(v, out)
    elif isinstance(obj, list):
        for v in obj: _hexes_in(v, out)
    elif isinstance(obj, str):
        out.update(_norm_hex(m) for m in HEX_RE.findall(obj))
    return out


def _snap(inp):
    """LLM이 고른 OKLCH를 격자에 맞춘다. 숫자가 아니면 그대로 두어 오라클이 오류를 내게 한다."""
    out = dict(inp)
    for k, g in GRID.items():
        try:
            v = round(float(inp[k]) / g) * g
            out[k] = round(v % 360 if k == "H" else v, 4)
        except (KeyError, TypeError, ValueError):
            pass
    return out


def _call_claude(messages, tools, key, use_temperature=True):
    body = {"model": MODEL, "max_tokens": 1500, "system": SYSTEM, "tools": tools, "messages": messages}
    if use_temperature:
        body["temperature"] = 0
    req = urllib.request.Request(API_URL, data=json.dumps(body).encode("utf-8"), method="POST", headers={
        "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01"})
    try:
        with urllib.request.urlopen(req, timeout=50) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "replace")[:300]
        if use_temperature and e.code == 400 and "temperature" in detail:
            return _call_claude(messages, tools, key, use_temperature=False)  # temperature를 안 받는 모델
        raise LLMError(f"Claude API 오류 {e.code}: {detail}")
    except urllib.error.URLError as e:
        raise LLMError(f"Claude API 연결 실패: {e.reason}")


def _tools_with_label(tools):
    """색을 만드는 도구에 label(역할 이름) 입력을 더한다. 오라클은 label을 쓰지 않는다."""
    out = []
    for t in tools:
        if t["name"] in ("oklch2hex", "lch2hex", "step"):
            t = json.loads(json.dumps(t))
            t["input_schema"]["properties"]["label"] = {"type": "string", "description": "이 색의 역할 (예: 돌담, 배경, 버튼 hover)"}
        out.append(t)
    return out


def answer(prompt, run_tool, tools, call=None, refresh=False):
    """prompt → {status, answer, final, palette, calls, unverified_hexes}. call은 테스트용 주입 지점."""
    prompt = prompt.strip()
    if not prompt:
        raise ValueError("prompt가 비어 있습니다")
    if len(prompt) > MAX_PROMPT:
        raise ValueError(f"prompt는 {MAX_PROMPT}자 이하로 써 주세요")
    if not refresh:
        pinned = _store_get(prompt)
        if pinned:
            return {**pinned, "cached": True}

    tools = _tools_with_label(tools)
    if call is None:
        key = os.environ.get("ANTHROPIC_API_KEY")
        if not key:
            raise LLMError("서버에 ANTHROPIC_API_KEY가 설정되지 않았습니다 (Vercel → Settings → Environment Variables)")
        call = lambda msgs: _call_claude(msgs, tools, key)

    messages = [{"role": "user", "content": prompt}]
    calls, palette, text = [], [], ""
    for _ in range(MAX_TURNS):
        resp = call(messages)
        content = resp.get("content", [])
        messages.append({"role": "assistant", "content": content})
        uses = [b for b in content if b.get("type") == "tool_use"]
        if not uses:
            text = "".join(b.get("text", "") for b in content if b.get("type") == "text").strip()
            break
        results = []
        for u in uses:
            name, inp = u["name"], dict(u.get("input") or {})
            label = str(inp.pop("label", "") or "")[:30]
            if name == "oklch2hex":
                inp = _snap(inp)
            try:
                res, err = run_tool(name, inp), False
            except ValueError as e:
                res, err = {"error": str(e)}, True
            calls.append({"name": name, "label": label, "input": inp, "result": res})
            if not err and isinstance(res, dict) and "hex" in res and name != "scale":
                req = res.get("oklch")
                if name == "oklch2hex":
                    req = f"oklch({inp.get('L')} {inp.get('C')} {inp.get('H')})"
                elif name == "lch2hex":
                    req = f"lch({inp.get('L')} {inp.get('C')} {inp.get('H')})"
                h = res["hex"]
                palette = [p for p in palette if p["label"] != label or not label]  # 같은 역할을 다시 계산하면 새 값으로
                palette.append({"label": label, "hex": h, "requested": req, "gamut_mapped": res.get("gamut_mapped", False),
                                "oklch": co.hex2oklch(h)["css"], "lch": co.hex2lch(h)["css"]})
            results.append({"type": "tool_result", "tool_use_id": u["id"],
                            "content": json.dumps(res, ensure_ascii=False), "is_error": err})
        messages.append({"role": "user", "content": results})
    else:
        text = "(도구 호출이 너무 많아 멈췄습니다)"

    # 대조 게이트: LLM 문장 속 HEX ⊆ 오라클 결과 HEX ∪ 사용자가 준 HEX
    allowed = set()
    for c in calls: _hexes_in(c["result"], allowed)
    allowed |= {_norm_hex(h) for h in HEX_RE.findall(prompt)}
    said = [_norm_hex(h) for h in HEX_RE.findall(text)]
    unverified = sorted({h for h in said if h not in allowed})

    if not palette:
        status = "failed" if unverified else "no_color"
    else:
        status = "failed" if unverified else "verified"

    out = {
        "prompt": prompt,
        "status": status,
        "verified": status == "verified",
        "answer": text,
        "final": ({k: palette[-1][k] for k in ("hex", "oklch", "lch")} | {"requested_oklch": palette[-1]["requested"]}) if palette else None,
        "palette": palette,
        "calls": calls,
        "unverified_hexes": unverified,
        "model": MODEL,
    }
    if status == "verified":
        _store_put(prompt, out, overwrite=refresh)
    return {**out, "cached": False}
