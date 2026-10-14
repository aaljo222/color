import { useCallback, useEffect, useRef, useState } from "react";

function speechError(code) {
  if (code === "not-allowed") return "마이크 권한을 허용해 주세요";
  if (code === "no-speech") return "목소리가 들리지 않았어요";
  if (code === "network") return "음성 인식 서버에 연결할 수 없어요";
  return "음성 인식 중 문제가 생겼어요. 다시 시도해 주세요.";
}

export default function useSpeech({ lang = "ko-KR", onInterim, onFinal } = {}) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const recognitionRef = useRef(null);
  const aliveRef = useRef(true);
  const callbacksRef = useRef({ onInterim, onFinal });
  callbacksRef.current = { onInterim, onFinal };

  useEffect(() => {
    aliveRef.current = true;
    setSupported(!!(window.SpeechRecognition || window.webkitSpeechRecognition));
    return () => {
      aliveRef.current = false;
      try {
        recognitionRef.current?.abort();
      } catch {
        recognitionRef.current = null;
      }
      recognitionRef.current = null;
    };
  }, []);

  const stop = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    try {
      recognition.stop();
    } catch {
      if (aliveRef.current) setListening(false);
    }
  }, []);

  const start = useCallback(() => {
    if (!supported || recognitionRef.current) return;
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setSupported(false);
      return;
    }

    setError("");
    // Web Speech 음성 인식은 HTTPS 또는 localhost에서만 사용할 수 있습니다.
    let recognition;
    try {
      recognition = new Recognition();
      recognition.lang = lang;
      recognition.continuous = false;
      recognition.interimResults = true;
      recognitionRef.current = recognition;
      recognition.onresult = (event) => {
        if (!aliveRef.current) return;
        let interimText = "";
        let finalText = "";
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const result = event.results[index];
          if (result.isFinal) finalText += result[0].transcript;
          else interimText += result[0].transcript;
        }
        callbacksRef.current.onInterim?.(interimText);
        if (finalText.trim()) callbacksRef.current.onFinal?.(finalText.trim());
      };
      recognition.onerror = (event) => {
        if (!aliveRef.current || event.error === "aborted") return;
        setError(speechError(event.error));
        callbacksRef.current.onInterim?.("");
      };
      recognition.onend = () => {
        if (!aliveRef.current) return;
        recognitionRef.current = null;
        setListening(false);
        callbacksRef.current.onInterim?.("");
      };
      recognition.start();
      setListening(true);
    } catch {
      recognitionRef.current = null;
      setListening(false);
      setError("음성 인식을 시작하지 못했어요. 다시 시도해 주세요.");
    }
  }, [lang, supported]);

  return { supported, listening, error, start, stop };
}
