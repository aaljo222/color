# -*- coding: utf-8 -*-
"""Color Oracle — Vercel Python 엔트리포인트 (WSGI, 표준 라이브러리만 사용)
색 값은 LLM이 아니라 이 앱(color_oracle)이 계산한다.

GET  /                                         변환기·팔레트 화면
GET  /api/oracle?op=hex2oklch&hex=%2300b8bb
GET  /api/oracle?op=oklch2hex&L=0.52&C=0.11&H=196.85
GET  /api/oracle?op=hex2lch&hex=%230a2242
GET  /api/oracle?op=lch2hex&L=50&C=40&H=200
GET  /api/oracle?op=scale&hex=%2300b8bb&name=teal
GET  /api/oracle?op=selfcheck
GET  /api/oracle?op=tools                      LLM에 등록할 도구 정의
POST /api/oracle  {"name": "...", "input": {...}}   모델의 tool_use를 그대로 실행
"""
import io, json, os, contextlib
from urllib.parse import parse_qs

import color_oracle as co

HERE = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(HERE, "tool_schema.json"), encoding="utf-8") as f:
    TOOLS = json.load(f)
with open(os.path.join(HERE, "templates", "index.html"), "rb") as f:
    INDEX_HTML = f.read()


def _num(v, name):
    try:
        x = float(v)
    except (TypeError, ValueError):
        raise ValueError(f"{name} 값이 숫자가 아닙니다: {v!r}")
    if x != x or x in (float("inf"), float("-inf")):
        raise ValueError(f"{name} 값이 유효하지 않습니다")
    return x


def _hex(v):
    if not isinstance(v, str):
        raise ValueError("hex가 필요합니다 (#rrggbb 또는 #rgb)")
    s = v.strip().lstrip("#")
    if len(s) not in (3, 6) or any(c not in "0123456789abcdefABCDEF" for c in s):
        raise ValueError(f"HEX 형식이 아닙니다: {v!r}")
    return "#" + s.lower()


def run_tool(name, inp):
    if name == "hex2oklch":
        return co.hex2oklch(_hex(inp.get("hex")))
    if name == "hex2lch":
        return co.hex2lch(_hex(inp.get("hex")))
    if name == "oklch2hex":
        L, C, H = _num(inp.get("L"), "L"), _num(inp.get("C"), "C"), _num(inp.get("H"), "H")
        if not 0 <= L <= 1: raise ValueError("OKLCH L은 0~1입니다")
        if not 0 <= C <= 0.5: raise ValueError("OKLCH C는 0~0.5입니다")
        return co.oklch2hex(L, C, H % 360)
    if name == "lch2hex":
        L, C, H = _num(inp.get("L"), "L"), _num(inp.get("C"), "C"), _num(inp.get("H"), "H")
        if not 0 <= L <= 100: raise ValueError("LCH L은 0~100입니다")
        if not 0 <= C <= 230: raise ValueError("LCH C는 0~230입니다")
        return co.lch2hex(L, C, H % 360)
    if name == "scale":
        r = co.scale(_hex(inp.get("hex")), str(inp.get("name") or "brand")[:32])
        return {k: r[k] for k in ("name", "base", "base_oklch", "brand_step", "steps", "css")}
    raise ValueError(f"알 수 없는 도구: {name}")


def selfcheck():
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        ok = co.selfcheck()
    return {"ok": bool(ok), "items": [l for l in buf.getvalue().splitlines() if l.startswith(("PASS", "FAIL"))]}


CORS = [("Access-Control-Allow-Origin", "*"),
        ("Access-Control-Allow-Methods", "GET, POST, OPTIONS"),
        ("Access-Control-Allow-Headers", "Content-Type")]
STATUS = {200: "200 OK", 204: "204 No Content", 400: "400 Bad Request", 404: "404 Not Found",
          405: "405 Method Not Allowed", 413: "413 Payload Too Large", 500: "500 Internal Server Error"}


def _json(start_response, code, obj):
    body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
    start_response(STATUS[code], [("Content-Type", "application/json; charset=utf-8"),
                                  ("Content-Length", str(len(body))),
                                  ("Cache-Control", "public, max-age=86400" if code == 200 else "no-store")] + CORS)
    return [body]


def _api(environ, start_response):
    method = environ.get("REQUEST_METHOD", "GET")
    if method == "OPTIONS":
        start_response(STATUS[204], CORS); return [b""]
    try:
        if method == "GET":
            q = {k: v[0] for k, v in parse_qs(environ.get("QUERY_STRING", "")).items()}
            op = q.pop("op", "")
            if op == "selfcheck": return _json(start_response, 200, selfcheck())
            if op == "tools": return _json(start_response, 200, TOOLS)
            if not op:
                return _json(start_response, 400, {"error": "op가 필요합니다",
                                                   "ops": [t["name"] for t in TOOLS] + ["selfcheck", "tools"]})
            return _json(start_response, 200, run_tool(op, q))
        if method == "POST":
            n = int(environ.get("CONTENT_LENGTH") or 0)
            if n > 10_000: return _json(start_response, 413, {"error": "요청이 너무 큽니다"})
            data = json.loads(environ["wsgi.input"].read(n) or b"{}")
            return _json(start_response, 200, {"name": data.get("name"),
                                               "result": run_tool(data.get("name"), data.get("input") or {})})
        return _json(start_response, 405, {"error": "GET, POST만 지원합니다"})
    except (ValueError, json.JSONDecodeError) as e:
        return _json(start_response, 400, {"error": str(e)})
    except Exception as e:
        return _json(start_response, 500, {"error": f"내부 오류: {type(e).__name__}"})


def app(environ, start_response):
    path = environ.get("PATH_INFO", "/")
    if path.rstrip("/") == "/api/oracle":
        return _api(environ, start_response)
    if path in ("/", "/index.html"):
        start_response("200 OK", [("Content-Type", "text/html; charset=utf-8"),
                                  ("Content-Length", str(len(INDEX_HTML))),
                                  ("X-Content-Type-Options", "nosniff")])
        return [INDEX_HTML]
    return _json(start_response, 404, {"error": "없는 경로입니다", "path": path})


if __name__ == "__main__":   # 로컬 실행: python app.py → http://localhost:8000
    from wsgiref.simple_server import make_server
    print("http://localhost:8000"); make_server("", 8000, app).serve_forever()
