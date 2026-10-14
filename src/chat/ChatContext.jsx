import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";
import { mockAsk, mockResult } from "./mock.js";

const ASK = "/api/chat/ask";
const RESULT = (id) => "/api/chat/result/" + id;
const POLL_MS = 300;
const POLL_MAX = 120;
const ChatCtx = createContext(null);

function errorMessage(error, ask = false) {
  if (!ask && error?.status === 404) return "결과를 찾을 수 없어요(만료되었을 수 있어요).";
  if (ask && error?.status === 422) return "1~300자로 입력해 주세요.";
  return "서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.";
}

export function ChatProvider({ children }) {
  const { token } = useAuth();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [canListen, setCanListen] = useState(false);
  const [ttsPlaying, setTtsPlaying] = useState(false);
  const [responseMood, setResponseMood] = useState("idle");
  const triggerRef = useRef(null);
  const recognitionRef = useRef(null);
  const recognitionErrorRef = useRef(false);
  const aliveRef = useRef(true);
  const timerRefs = useRef(new Set());
  const pendingTextRef = useRef(new Set());
  const sendRef = useRef(null);
  const utteranceRef = useRef(null);
  const responseMoodRef = useRef(null);
  const responseMoodTimerRef = useRef(null);

  useEffect(() => {
    const supported = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    setCanListen(supported);
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      timerRefs.current.forEach((timer) => window.clearTimeout(timer));
      timerRefs.current.clear();
      recognitionRef.current?.abort();
      utteranceRef.current = null;
      window.speechSynthesis?.cancel();
    };
  }, []);

  const updateItem = useCallback((id, changes) => {
    if (!aliveRef.current) return;
    setItems((current) => current.map((item) => item.id === id ? { ...item, ...changes } : item));
  }, []);

  const wait = useCallback(() => new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      timerRefs.current.delete(timer);
      resolve();
    }, POLL_MS);
    timerRefs.current.add(timer);
  }), []);

  const send = useCallback(async (value) => {
    const text = String(value ?? "").trim();
    if (!text) return;
    const id = `${Date.now()}-${Math.random()}`;
    if (text.length > 300) {
      setItems((current) => [{ id, text, status: "error", error: "1~300자로 입력해 주세요." }, ...current]);
      return;
    }
    if (pendingTextRef.current.has(text)) return;
    setItems((current) => [{ id, text, status: "queued" }, ...current]);
    pendingTextRef.current.add(text);
    let asking = true;
    try {
      // TODO: 인증 정책 확정
      const askData = import.meta.env.VITE_CHAT_MOCK === "1"
        ? await mockAsk(text)
        : await api(ASK, { method: "POST", body: { text }, token, sameOrigin: true });
      if (!aliveRef.current) return;
      asking = false;
      const jobId = askData?.job_id;
      if (!jobId) {
        updateItem(id, { status: "error", error: "요청을 처리하지 못했어요." });
        return;
      }
      let finished = false;
      for (let attempt = 0; attempt < POLL_MAX; attempt += 1) {
        const result = import.meta.env.VITE_CHAT_MOCK === "1"
          ? await mockResult(jobId)
          : await api(RESULT(jobId), { token, sameOrigin: true });
        if (!aliveRef.current) return;
        if (result?.status === "done") {
          updateItem(id, { status: "done", data: result.data || {} });
          finished = true;
          break;
        }
        if (result?.status === "error") {
          updateItem(id, { status: "error", error: result.error || "요청을 처리하지 못했어요." });
          finished = true;
          break;
        }
        updateItem(id, { status: "running", waiting: result?.status === "queued" });
        if (attempt + 1 < POLL_MAX) await wait();
      }
      if (!finished && aliveRef.current) updateItem(id, { status: "error", error: "시간이 초과됐어요." });
    } catch (error) {
      if (aliveRef.current) updateItem(id, { status: "error", error: errorMessage(error, asking) });
    } finally {
      pendingTextRef.current.delete(text);
    }
  }, [token, updateItem, wait]);

  sendRef.current = send;

  const listen = useCallback(() => {
    if (!canListen || listening) return;
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new Recognition();
    recognition.lang = "ko-KR";
    recognition.interimResults = true;
    recognitionRef.current = recognition;
    recognitionErrorRef.current = false;
    let finalText = "";
    recognition.onresult = (event) => {
      if (!aliveRef.current) return;
      let liveText = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const transcript = event.results[index][0].transcript;
        if (event.results[index].isFinal) finalText += transcript;
        else liveText += transcript;
      }
      setInterim(liveText || finalText);
    };
    recognition.onerror = () => {
      if (!aliveRef.current) return;
      recognitionErrorRef.current = true;
      setListening(false);
      setInterim("음성 입력을 사용할 수 없어요.");
    };
    recognition.onend = () => {
      if (!aliveRef.current) return;
      setListening(false);
      if (!recognitionErrorRef.current) setInterim("");
      if (finalText.trim()) sendRef.current?.(finalText);
    };
    setInterim("");
    setListening(true);
    recognition.start();
  }, [canListen, listening]);

  const spokenIdRef = useRef(null);
  useEffect(() => {
    const latestResponse = items.find((item) => item.status === "done" || item.status === "error");
    if (!latestResponse || responseMoodRef.current === latestResponse.id) return;
    responseMoodRef.current = latestResponse.id;
    window.clearTimeout(responseMoodTimerRef.current);
    const mood = latestResponse.status === "error" || latestResponse.data?.source === "none"
      ? "sorry"
      : latestResponse.data?.mode === "scene" ? "happy" : "idle";
    setResponseMood(mood);
    if (mood !== "idle") {
      responseMoodTimerRef.current = window.setTimeout(() => {
        responseMoodTimerRef.current = null;
        if (aliveRef.current) setResponseMood("idle");
      }, 6000);
    }
  }, [items]);

  useEffect(() => () => window.clearTimeout(responseMoodTimerRef.current), []);

  useEffect(() => {
    const latest = items.find((item) => item.status === "done");
    if (!latest || latest.data?.mode !== "scene" || !(open || pathname === "/chat")) {
      utteranceRef.current = null;
      window.speechSynthesis?.cancel();
      setTtsPlaying(false);
      return;
    }
    if (spokenIdRef.current === latest.id) return;
    spokenIdRef.current = latest.id;
    const Speech = window.SpeechSynthesisUtterance;
    if (!Speech || !window.speechSynthesis) return;
    const answer = latest.data?.answer || "";
    const cutoff = answer.indexOf("근거:");
    const spoken = (cutoff < 0 ? answer : answer.slice(0, cutoff)).trim();
    if (!spoken) return;
    utteranceRef.current = null;
    window.speechSynthesis.cancel();
    const utterance = new Speech(spoken);
    utteranceRef.current = utterance;
    utterance.lang = "ko-KR";
    utterance.onstart = () => {
      if (aliveRef.current && utteranceRef.current === utterance) setTtsPlaying(true);
    };
    utterance.onend = () => {
      if (utteranceRef.current !== utterance) return;
      utteranceRef.current = null;
      if (aliveRef.current) setTtsPlaying(false);
    };
    utterance.onerror = () => {
      if (utteranceRef.current !== utterance) return;
      utteranceRef.current = null;
      if (aliveRef.current) setTtsPlaying(false);
    };
    window.speechSynthesis.speak(utterance);
  }, [items, open, pathname]);

  const botMood = items.some((item) => item.status === "queued" || item.status === "running")
    ? "think"
    : ttsPlaying ? "talk" : responseMood;

  return (
    <ChatCtx.Provider value={{
      open, setOpen, items, send, listening, listen, interim, canListen, triggerRef, botMood,
    }}>
      {children}
    </ChatCtx.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatCtx);
  if (!context) throw new Error("useChat은 ChatProvider 안에서 사용해야 합니다.");
  return context;
}
