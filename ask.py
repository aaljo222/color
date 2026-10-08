# -*- coding: utf-8 -*-
"""자연어 프롬프트 → 색 토큰.

역할 분리
  LLM      : 문장을 읽고 "어떤 색을 원하는지"(브랜드·단계·조정)만 정한 뒤 도구를 부른다.
  오라클   : 모든 숫자(HEX·OKLCH·LCH)를 계산한다 (color_oracle, 결정론).
  서버 게이트: LLM 답에 나온 HEX가 전부 오라클 결과(또는 사용자가 준 값)에 있는지 대조한다.
             하나라도 없으면 verified=false — 기억으로 쓴 값이 섞였다는 뜻.

같은 프롬프트에 같은 값이 나오는 이유
  - 최종 값(final)은 LLM 문장이 아니라 마지막 오라클 결과에서 서버가 만든다.
  - 단계 요청은 `step` 도구로만 계산되므로, LLM이 단계를 같게 해석하면 값은 항상 같다.
  - temperature 0, 같은 인스턴스 안에서는 프롬프트 캐시.

환경변수
  ANTHROPIC_API_KEY (필수) · CLAUDE_MODEL (기본 claude-sonnet-5-5) · ACCESS_TOKEN (선택, app.py에서 검사)
"""
import json, os, re, urllib.request, urllib.error

import color_oracle as co

API_URL = "https://api.anthropic.com/v1/messages"
MODEL = os.environ.get("CLAUDE_MODEL", "claude-sonnet-5-5")
MAX_TURNS = 6
MAX_PROMPT = 300

BRANDS = {  # 이름 → 원색. 여기 적힌 것만 '브랜드 색'으로 인정한다.
    "kriteq navy": "#0a2242",
    "kriteq teal": "#00b8bb",
}

SYSTEM = f"""너는 디자이너의 색 요청을 해석하는 도우미다.
규칙:
1. HEX·OKLCH·LCH 숫자를 기억이나 추측으로 쓰지 마라. 숫자는 전부 도구 결과에서만 가져온다.
2. 브랜드 색은 다음만 인정한다: {json.dumps(BRANDS, ensure_ascii=False)}. "teal"·"틸"은 kriteq teal, "navy"·"네이비"는 kriteq navy로 본다.
3. 단계(50~900) 요청은 step 도구로 계산한다. "한 단계 진하게"=+100, "한 단계 연하게"=-100, "두 단계"=±200. 기준 단계가 없으면 브랜드 원색 단계(step 결과의 brand_step)를 기준으로 한다. 범위(50~900)를 넘으면 끝 단계로 맞추고 그렇게 했다고 말한다.
4. 밝기·채도·색상각을 직접 정해 달라는 요청은 oklch2hex(또는 lch2hex)로 계산한다.
5. 마지막 답은 한국어 두세 문장: 어떻게 해석했는지와 최종 HEX 하나. 최종 HEX는 마지막으로 부른 도구의 결과여야 한다.
6. 색과 관계없는 요청이면 도구를 부르지 말고 색 요청만 도울 수 있다고 답한다."""

HEX_RE = re.compile(r"#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![0-9a-fA-F])")
_cache = {}


class LLMError(Exception):
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


def _call_claude(messages, tools, key, use_temperature=True):
    body = {"model": MODEL, "max_tokens": 1024, "system": SYSTEM, "tools": tools, "messages": messages}
    if use_temperature:
        body["temperature"] = 0
    req = urllib.request.Request(API_URL, data=json.dumps(body).encode("utf-8"), method="POST", headers={
        "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01"})
    try:
        with urllib.request.urlopen(req, timeout=40) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "replace")[:300]
        if use_temperature and e.code == 400 and "temperature" in detail:
            return _call_claude(messages, tools, key, use_temperature=False)  # temperature를 안 받는 모델
        raise LLMError(f"Claude API 오류 {e.code}: {detail}")
    except urllib.error.URLError as e:
        raise LLMError(f"Claude API 연결 실패: {e.reason}")


def answer(prompt, run_tool, tools, call=None):
    """prompt → {answer, final, calls, verified, unverified_hexes}. call은 테스트용 주입 지점."""
    prompt = prompt.strip()
    if not prompt:
        raise ValueError("prompt가 비어 있습니다")
    if len(prompt) > MAX_PROMPT:
        raise ValueError(f"prompt는 {MAX_PROMPT}자 이하로 써 주세요")
    if prompt in _cache:
        return {**_cache[prompt], "cached": True}

    key = os.environ.get("ANTHROPIC_API_KEY")
    if call is None:
        if not key:
            raise LLMError("서버에 ANTHROPIC_API_KEY가 설정되지 않았습니다 (Vercel → Settings → Environment Variables)")
        call = lambda msgs: _call_claude(msgs, tools, key)

    messages = [{"role": "user", "content": prompt}]
    calls, last_color, last_req = [], None, None
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
            try:
                res, err = run_tool(u["name"], u.get("input") or {}), False
            except ValueError as e:
                res, err = {"error": str(e)}, True
            calls.append({"name": u["name"], "input": u.get("input"), "result": res})
            if not err and isinstance(res, dict) and "hex" in res:
                req = res.get("oklch")
                if u["name"] == "oklch2hex":
                    i = u.get("input") or {}
                    req = f"oklch({i.get('L')} {i.get('C')} {i.get('H')})"
                elif u["name"] == "lch2hex":
                    i = u.get("input") or {}
                    req = f"lch({i.get('L')} {i.get('C')} {i.get('H')})"
                last_color, last_req = res["hex"], req
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

    final = None
    if last_color:
        final = {"hex": last_color, "oklch": co.hex2oklch(last_color)["css"], "lch": co.hex2lch(last_color)["css"],
                 "requested_oklch": last_req}  # 요청값(단계 설계값). HEX 8비트 반올림·색역 매핑 때문에 실제값과 조금 다를 수 있다
    if final and said and final["hex"] not in said:
        unverified = sorted(set(unverified) | {"(답의 HEX가 최종값과 다름)"})

    out = {
        "prompt": prompt,
        "answer": text,
        "final": final,
        "calls": calls,
        "verified": bool(calls) and final is not None and not unverified,
        "unverified_hexes": unverified,
        "model": MODEL,
    }
    if out["verified"]:
        _cache[prompt] = out
    return {**out, "cached": False}
