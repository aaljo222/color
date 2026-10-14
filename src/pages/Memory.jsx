import { useCallback, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";
import { useChat } from "../chat/ChatContext.jsx";
import Specimen from "../components/Specimen.jsx";
import useSpeech from "../hooks/useSpeech.js";

const EXAMPLE = "초여름 오후, 아빠 손을 잡고 놀이공원 회전목마 앞에서 설레던 기억";
const MEMORY_MAX_LENGTH = 300;

export default function Memory() {
  const { token, user } = useAuth();
  const { listening: chatListening } = useChat();
  const [memory, setMemory] = useState("");
  const memoryRef = useRef(memory);
  const [email, setEmail] = useState("");
  const [keep, setKeep] = useState(false);
  const [engine, setEngine] = useState("");          // "" = 서버 기본(ENGINE_MODE), A/B 비교용
  const [variant, setVariant] = useState(0);          // eng-2.6 변형 번호: 같은 문장으로 다른 그림 (같은 번호면 같은 값)
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [data, setData] = useState(null);
  const [interim, setInterim] = useState("");
  const [speechNotice, setSpeechNotice] = useState("");
  const n = memory.trim().length;
  const speech = useSpeech({
    onInterim: setInterim,
    onFinal: (recognized) => {
      const current = memoryRef.current.trimEnd();
      const addition = recognized.trim();
      const combined = current ? `${current} ${addition}` : addition;
      if (combined.length > MEMORY_MAX_LENGTH) setSpeechNotice("입력란은 300자까지라 음성 결과의 뒷부분을 잘랐어요.");
      else setSpeechNotice("");
      const next = combined.slice(0, MEMORY_MAX_LENGTH);
      memoryRef.current = next;
      setMemory(next);
    },
  });

  function setMemoryValue(value) {
    memoryRef.current = value;
    setMemory(value);
    setSpeechNotice("");
  }

  function toggleSpeech() {
    if (speech.listening) {
      speech.stop();
      return;
    }
    if (chatListening) {
      setSpeechNotice("챗봇에서 음성 입력 중이에요. 완료한 뒤 다시 시도해 주세요.");
      return;
    }
    setSpeechNotice("");
    speech.start();
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr("");
    speech.stop();
    try {
      const d = await api("/api/analyze", { method: "POST", token,
        body: { memory: memory.trim(), email: email || null, keep_text: !!user && keep, include_image: true, engine: engine || null, variant: Number(variant) || 0 } });
      setData(d);
    } catch (ex) { setErr(ex.message); } finally { setBusy(false); }
  }

  return (
    <section>
      <h1 className="title">기억 한 문장을, 색 표본 한 장으로</h1>
      <p className="lead">같은 기억은 언제 다시 넣어도 같은 네 가지 색이 됩니다. 언어 모델은 감정·시간·장소만 읽고, 색은 계산기가 정합니다.</p>
      <form className="memory-form" onSubmit={submit}>
        <label htmlFor="mem" className="sr">기억 문장</label>
        <textarea id="mem" className="memory-input" rows={3} maxLength={300} value={memory}
          placeholder={EXAMPLE} onChange={(e) => setMemoryValue(e.target.value)} />
        <div className="form-row mem-input-actions">
          <span className={`count ${n > 0 && n < 10 ? "warn" : ""}`}>{n} / 300 {n > 0 && n < 10 ? "· 10자 이상 써 주세요" : ""}</span>
          <button
            type="button"
            className={`ghost${speech.listening ? " mem-rec" : ""}`}
            aria-label="음성으로 기억 입력"
            aria-pressed={speech.listening}
            disabled={!speech.supported || busy || chatListening}
            onClick={toggleSpeech}
          >
            {speech.listening ? "● 듣는 중" : "🎤 말하기"}
          </button>
          <button type="button" className="ghost" onClick={() => setMemoryValue(EXAMPLE)}>예시 넣기</button>
        </div>
        <p className="hint mem-speech-status" aria-live="polite">
          {!speech.supported
            ? "Chrome/Edge에서 음성 입력을 쓸 수 있어요"
            : speech.error || speechNotice || (interim ? `인식 중: ${interim}` : chatListening ? "챗봇에서 음성 입력 중입니다." : "")}
        </p>
        <div className="form-row wrap">
          <label className="field">
            <span>색 코드를 메일로 받기 (선택, 저장하지 않음)</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </label>
          <label className="field">
            <span>엔진 (비교용)</span>
            <select value={engine} onChange={(e) => setEngine(e.target.value)}>
              <option value="">서버 기본</option>
              <option value="palette">팔레트 계산 (eng-1.2)</option>
              <option value="image_first">그림 먼저 (eng-2.6)</option>
            </select>
          </label>
          {engine !== "palette" && (
            <label className="field">
              <span>변형 번호 (같은 문장으로 다른 그림)</span>
              <select value={variant} onChange={(e) => setVariant(e.target.value)}>
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => <option key={n} value={n}>{n === 0 ? "0 (기본)" : n}</option>)}
              </select>
            </label>
          )}
          {user && (
            <label className="check">
              <input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} />
              원문도 암호화해서 보관하기
            </label>
          )}
        </div>
        <button className="primary" disabled={busy || n < 10}>{busy ? "표본을 만드는 중…" : "표본 만들기"}</button>
        {!user && <p className="hint">로그인하지 않으면 접속한 인터넷 주소(IP)마다 하루 2번까지 만들 수 있고(메일 주소와는 상관없음), 결과는 저장되지 않습니다. <Link to="/login">로그인</Link>하면 보관함에 남습니다.</p>}
        {err && <p className="error" role="alert">{err}</p>}
      </form>
      {data?.save_error && <p className="hint" role="status">{data.save_error}</p>}
      {data && <Specimen data={data} />}
    </section>
  );
}
