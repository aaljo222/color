# -*- coding: utf-8 -*-
"""Vercel Python 서버리스 함수 — /api/oracle
색 값은 LLM이 아니라 이 함수(color_oracle)가 계산한다.

GET  /api/oracle?op=hex2oklch&hex=%2300b8bb
GET  /api/oracle?op=oklch2hex&L=0.52&C=0.11&H=196.85
GET  /api/oracle?op=hex2lch&hex=%230a2242
GET  /api/oracle?op=lch2hex&L=50&C=40&H=200
GET  /api/oracle?op=scale&hex=%2300b8bb&name=teal
GET  /api/oracle?op=selfcheck
GET  /api/oracle?op=tools                    # LLM에 등록할 도구 정의(JSON)
POST /api/oracle  {"name": "oklch2hex", "input": {"L":0.52,"C":0.11,"H":196.85}}
                                             # 모델의 tool_use를 그대로 넘기면 tool_result용 JSON을 돌려준다
"""
import io, json, os, sys, contextlib
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _color_oracle as co  # noqa: E402  (밑줄로 시작하는 파일은 Vercel이 함수로 만들지 않는다)

with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "_tool_schema.json"), encoding="utf-8") as f:
    TOOLS = json.load(f)


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
    """tool_runner와 같은 디스패처. 입력 검증 후 오라클 호출."""
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
        return {"name": r["name"], "base": r["base"], "base_oklch": r["base_oklch"],
                "brand_step": r["brand_step"], "steps": r["steps"], "css": r["css"]}
    raise ValueError(f"알 수 없는 도구: {name}")


def selfcheck():
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        ok = co.selfcheck()
    lines = [l for l in buf.getvalue().splitlines() if l.startswith(("PASS", "FAIL"))]
    return {"ok": bool(ok), "items": lines}


class handler(BaseHTTPRequestHandler):
    def _send(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Cache-Control", "public, max-age=86400" if code == 200 else "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self._send(204, {})

    def do_GET(self):
        q = {k: v[0] for k, v in parse_qs(urlparse(self.path).query).items()}
        op = q.pop("op", "")
        try:
            if op == "selfcheck":
                return self._send(200, selfcheck())
            if op == "tools":
                return self._send(200, TOOLS)
            if not op:
                return self._send(400, {"error": "op가 필요합니다", "ops": [t["name"] for t in TOOLS] + ["selfcheck", "tools"]})
            return self._send(200, run_tool(op, q))
        except ValueError as e:
            return self._send(400, {"error": str(e)})
        except Exception as e:  # 예상 밖 오류
            return self._send(500, {"error": f"내부 오류: {type(e).__name__}"})

    def do_POST(self):
        try:
            n = int(self.headers.get("Content-Length") or 0)
            if n > 10_000:
                return self._send(413, {"error": "요청이 너무 큽니다"})
            data = json.loads(self.rfile.read(n) or b"{}")
            return self._send(200, {"name": data.get("name"), "result": run_tool(data.get("name"), data.get("input") or {})})
        except (ValueError, json.JSONDecodeError) as e:
            return self._send(400, {"error": str(e)})
        except Exception as e:
            return self._send(500, {"error": f"내부 오류: {type(e).__name__}"})
