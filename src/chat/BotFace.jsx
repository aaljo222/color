import { useEffect, useState } from "react";

const FACE_IMAGES = import.meta.glob("../assets/chat/bot/*.webp", {
  eager: true,
  query: "?url",
  import: "default",
});

export default function BotFace({ mood = "idle", tint = "#2f5d50", size = 56, look = 0 }) {
  const [blink, setBlink] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const image = FACE_IMAGES[`../assets/chat/bot/${mood}.webp`]
    || FACE_IMAGES["../assets/chat/bot/idle.webp"];

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => setReducedMotion(media.matches);
    updateMotion();
    media.addEventListener?.("change", updateMotion);
    return () => media.removeEventListener?.("change", updateMotion);
  }, []);

  useEffect(() => {
    if (mood !== "idle" || reducedMotion) {
      setBlink(false);
      return undefined;
    }
    let blinkTimeout;
    let nextBlink;
    const scheduleBlink = () => {
      nextBlink = window.setTimeout(() => {
        setBlink(true);
        blinkTimeout = window.setTimeout(() => {
          setBlink(false);
          scheduleBlink();
        }, 140);
      }, 4000 + Math.random() * 3000);
    };
    scheduleBlink();
    return () => {
      window.clearTimeout(nextBlink);
      window.clearTimeout(blinkTimeout);
    };
  }, [mood, reducedMotion]);

  return (
    <span
      className={`bot-face${mood === "idle" && !reducedMotion ? " bot-face-breathe" : ""}`}
      style={{ "--bot-size": `${size}px`, "--bot-tint": tint }}
      aria-hidden="true"
    >
      {image ? (
        <img className="bot-face-image" src={image} width={size} height={size} alt="" />
      ) : (
        <svg className="bot-face-svg" viewBox="0 0 120 120" role="presentation">
          <path d="M19 116c2-23 16-34 41-34s39 11 41 34" fill="var(--green)" />
          <path d="M44 75h32v22c-9 9-23 9-32 0z" fill="#d99f7d" />
          <path d="M39 91l21 12 21-12 10 25H29z" fill="#23483e" />
          <path d="M49 90l11 9 11-9 6 5-17 18-17-18z" fill="#f0eee6" />
          <path d="M85 104l-3-7 4-3 7 5-3 7z" fill={tint} stroke="#eee8d8" strokeWidth="1.5" />
          <circle cx="60" cy="48" r="29" fill="#e8b692" />
          <path d="M32 48c-2-22 8-35 28-37 14-2 27 6 30 19 2 8 1 18-1 24l-4-15c-10 1-22-3-31-10-5 8-12 12-21 13z" fill="#292724" />
          <path d="M34 49c1 18 10 33 26 34 16-1 25-16 26-34-4-3-8-8-10-13-13 7-26 7-39 3z" fill="#e8b692" />
          <path d="M35 51q-8-4-7 5t9 8m49-13q8-4 7 5t-9 8" fill="#d99f7d" />
          <path d="M42 45q7-4 13 0m11 0q7-4 13 0" fill="none" stroke="#362722" strokeWidth="2.5" strokeLinecap="round" />
          {mood === "happy" ? (
            <path d="M42 51q7 7 14 0m9 0q7 7 14 0" fill="none" stroke="#362722" strokeWidth="2.8" strokeLinecap="round" />
          ) : (
            <g className={blink && mood === "idle" ? "bot-face-blink" : ""}>
              <ellipse cx="49" cy="52" rx="4" ry="5" fill="#fff8eb" />
              <ellipse cx="72" cy="52" rx="4" ry="5" fill="#fff8eb" />
              <circle cx={50 + look * 2.3 + (mood === "think" ? -1 : 0)} cy={52 + (mood === "think" ? -2 : 0)} r="2.8" fill="#292724" />
              <circle cx={73 + look * 2.3 + (mood === "think" ? -1 : 0)} cy={52 + (mood === "think" ? -2 : 0)} r="2.8" fill="#292724" />
              <circle cx={51 + look * 2.3 + (mood === "think" ? -1 : 0)} cy={51 + (mood === "think" ? -2 : 0)} r=".9" fill="#fff" />
              <circle cx={74 + look * 2.3 + (mood === "think" ? -1 : 0)} cy={51 + (mood === "think" ? -2 : 0)} r=".9" fill="#fff" />
            </g>
          )}
          {mood === "think" ? (
            <path d="M41 41q6-4 12-1m9-5q6-4 12-1" fill="none" stroke="#362722" strokeWidth="2.5" strokeLinecap="round" />
          ) : mood === "sorry" ? (
            <path d="M41 43q6 1 12 4m9 0q6-3 12-4" fill="none" stroke="#362722" strokeWidth="2.5" strokeLinecap="round" />
          ) : null}
          {mood === "talk" ? (
            <ellipse className={!reducedMotion ? "bot-face-mouth-talk" : ""} cx="60" cy="68" rx="6" ry="5" fill="#713d35" />
          ) : mood === "happy" ? (
            <path d="M48 66q12 14 24 0" fill="none" stroke="#713d35" strokeWidth="3" strokeLinecap="round" />
          ) : mood === "sorry" ? (
            <path d="M51 72q9-8 18 0" fill="none" stroke="#713d35" strokeWidth="2.8" strokeLinecap="round" />
          ) : (
            <path d="M51 66q9 8 18 0" fill="none" stroke="#713d35" strokeWidth="2.8" strokeLinecap="round" />
          )}
          {mood === "think" && (
            <g className={!reducedMotion ? "bot-face-thinking" : ""} fill="#fff8eb">
              <circle cx="91" cy="32" r="2.2" />
              <circle className="bot-face-dot-two" cx="98" cy="32" r="2.2" />
              <circle className="bot-face-dot-three" cx="105" cy="32" r="2.2" />
            </g>
          )}
        </svg>
      )}
    </span>
  );
}
