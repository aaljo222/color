import { Link } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { useChat } from "./ChatContext.jsx";
import BotFace from "./BotFace.jsx";

const EXAMPLES = [
  "오늘 너무 행복하고 신나",
  "슬프고 우울한 밤이야",
  "바나나 같은 노란 하늘",
  "파랑이 왜 인기 있어?",
  "빨강은 왜 흥분되는 색이야?",
];

export default function ChatPanel({ variant = "page", onClose }) {
  const {
    items, send, listening, listen, interim, canListen, setOpen, botMood,
  } = useChat();
  const [draft, setDraft] = useState("");
  const inputRef = useRef(null);
  const isWidget = variant === "widget";
  const latestResponseId = items.find((item) => item.status === "done" || item.status === "error")?.id;

  useEffect(() => {
    if (!isWidget) return undefined;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => {
      window.clearTimeout(timer);
    };
  }, [isWidget]);

  function submit(event) {
    event.preventDefault();
    if (!draft.trim() || draft.trim().length > 300) return;
    send(draft);
    setDraft("");
  }

  return (
    <section className={`chat-panel${isWidget ? " chat-panel-widget" : " chat-panel-page"}`}>
      {isWidget && (
        <header className="chat-modal-head">
          <div className="bot-modal-brand">
            <BotFace mood={botMood} tint="#2f5d50" size={32} />
            <strong>색채 챗봇</strong>
          </div>
          <div className="chat-head-actions">
            <Link className="ghost chat-ghost" to="/chat" onClick={() => setOpen(false)}>전체 화면으로 보기</Link>
            <button className="ghost chat-ghost chat-close" type="button" onClick={onClose} aria-label="대화창 닫기">✕</button>
          </div>
        </header>
      )}
      <div className="chat-transcript" aria-live="polite" aria-relevant="additions text">
        {items.length === 0 ? (
          <div className="chat-empty">
            <div className="bot-empty">
              <BotFace mood="happy" tint="#2f5d50" size={56} />
              <p className="empty">아직 대화가 없습니다. 기분이나 궁금한 색을 물어보세요.</p>
            </div>
            <div className="examples">
              {EXAMPLES.map((example) => (
                <button className="ghost chat-ghost" type="button" key={example} onClick={() => send(example)}>{example}</button>
              ))}
            </div>
          </div>
        ) : [...items].map((item) => (
          <Reply key={item.id} item={item} mood={item.id === latestResponseId ? botMood : "idle"} />
        ))}
      </div>
      <form className="chat-composer" onSubmit={submit}>
        <label className="sr" htmlFor={`chat-input-${variant}`}>색채 챗봇에 질문하기</label>
        <textarea
          ref={inputRef}
          id={`chat-input-${variant}`}
          className="chat-input"
          rows={2}
          maxLength={300}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="기분이나 궁금한 색을 적어 주세요"
        />
        <div className="chat-compose-foot">
          <p className="hint chat-voice-hint" aria-live="polite">
            {listening ? interim || "듣고 있어요…" : canListen ? "음성 질문을 할 수 있어요." : "이 브라우저에서는 음성 입력을 지원하지 않아요."}
          </p>
          <div className="form-row chat-controls">
            <button className="ghost chat-ghost" type="button" onClick={listen} disabled={!canListen || listening} aria-label="음성으로 질문하기">
              {listening ? "듣는 중…" : "🎙 음성"}
            </button>
            <button className="primary chat-send" type="submit" disabled={!draft.trim()}>보내기</button>
          </div>
        </div>
      </form>
    </section>
  );
}

function Reply({ item, mood }) {
  if (item.status === "error") {
    return (
      <article className="chat-card chat-reply-error">
        <div className="bot-reply-head"><BotFace mood={mood} tint="#2f5d50" size={28} /></div>
        <p className="meta">질문</p>
        <p className="chat-question">{item.text}</p>
        <p className="error" role="alert">{item.error}</p>
      </article>
    );
  }
  if (item.status !== "done") {
    return (
      <article className="chat-card">
        <div className="bot-reply-head"><BotFace mood={mood} tint="#2f5d50" size={28} /></div>
        <p className="meta">질문</p>
        <p className="chat-question">{item.text}</p>
        <p className="hint" role="status">{item.waiting ? "순서를 기다리는 중…" : "생각하는 중…"}</p>
      </article>
    );
  }

  const data = item.data || {};
  const source = data.source === "paper" ? "논문" : data.source === "web" ? "웹 검색" : "근거 없음";
  const mode = data.mode === "scene" ? "장면" : data.mode === "qa" ? "질문 답변" : "응답";

  // javascript: 등 위험한 스킴을 방어하고 안전한 http/https 링크만 허용
  const getSafeUrl = (rawUrl) => {
    if (!rawUrl || typeof rawUrl !== "string") return null;
    const trimmed = rawUrl.trim();
    return /^https?:\/\//i.test(trimmed) ? trimmed : null;
  };

  return (
    <article className="chat-card">
      <div className="bot-reply-head">
        <BotFace mood={mood} tint="#2f5d50" size={28} />
        <div className="chat-badges">
          <span className="chip chat-badge">{source}</span>
          <span className="chip chat-badge">{mode}</span>
        </div>
      </div>

      <p className="meta">질문</p>
      <p className="chat-question">{item.text}</p>

      {/* 웹 검색 Fallback 발생 시 안내 힌트 */}
      {data.source === "web" && (
        <p className="hint chat-web-hint" style={{ fontSize: "0.85rem", color: "#2f5d50", margin: "4px 0" }}>
          논문에서는 찾지 못해 웹에서 찾았어요
        </p>
      )}

      {/* 근거 없음 발생 시 안내 힌트 */}
      {data.source === "none" && (
        <p className="hint chat-none-hint" style={{ fontSize: "0.85rem", color: "#888", margin: "4px 0" }}>
          근거를 찾지 못했어요. 질문이나 표현을 조금 더 다듬어 보세요.
        </p>
      )}

      {data.svg && <img className="chat-scene" src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(data.svg)}`} alt="질문의 색채 장면" />}
      
      {data.palette?.length > 0 && (
        <div className="chat-palette" aria-label="추천 팔레트">
          {data.palette.map((color, index) => (
            <span className="chat-palette-chip" key={`${color}-${index}`} title={color} style={{ backgroundColor: color }}>
              <span className="sr">{color}</span>
            </span>
          ))}
        </div>
      )}

      {data.answer && <p className="chat-answer">{data.answer}</p>}
      
      {data.ou_preference !== undefined && data.ou_preference !== null && (
        <p className="meta chat-score">Ou et al. 참고 점수: {data.ou_preference}</p>
      )}

      {/* 출처 및 안전한 외부 URL 링크 렌더링 */}
      {data.citations?.length > 0 && (
        <ol className="chat-citations">
          {data.citations.map((citation, index) => {
            const safeUrl = getSafeUrl(citation?.url);
            const citeText = citation?.cite || "참고 자료";
            const scoreText = citation?.score !== undefined && citation?.score !== null ? ` · ${citation.score}` : "";
            
            return (
              <li key={`${citeText}-${index}`}>
                {citation?.kind === "web" && (
                  <span className="chip chat-sub-badge" style={{ fontSize: "0.7rem", marginRight: "4px", padding: "1px 4px", background: "#eef", borderRadius: "4px" }}>웹</span>
                )}
                {safeUrl ? (
                  <a 
                    href={safeUrl} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="chat-citation-link"
                    style={{ color: "#2a52be", textDecoration: "underline" }}
                  >
                    {citeText}
                  </a>
                ) : (
                  <span>{citeText}</span>
                )}
                {scoreText}
              </li>
            );
          })}
        </ol>
      )}

      {data.note && <p className="hint chat-note">{data.note}</p>}
    </article>
  );
}