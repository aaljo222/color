import { useEffect, useRef, useState } from "react";
import { useChat } from "./ChatContext.jsx";
import BotFace from "./BotFace.jsx";

const COLORS = ["#2f5d50", "#7e2b35", "#d49c48", "#5b7798", "#a86d78", "#758b5c"];
const PHRASES = ["오늘은 무슨 색 기분이야?", "바나나 같은 노랑, 어때?", "파랑이 왜 인기 있게?", "같은 기억은 같은 색이 돼요", "나 좀 눌러봐!"];

function nextColor(current) {
  const options = COLORS.filter((color) => color !== current);
  return options[Math.floor(Math.random() * options.length)];
}

export default function WanderBot() {
  const { setOpen, triggerRef, botMood } = useChat();
  const [position, setPosition] = useState(null);
  const [color, setColor] = useState(COLORS[0]);
  const [bubble, setBubble] = useState("");
  const [side, setSide] = useState("left");
  const [look, setLook] = useState(0);
  const [hovered, setHovered] = useState(false);
  const hoveredRef = useRef(false);
  const positionRef = useRef(null);
  const timeoutsRef = useRef(new Set());

  function home() {
    if (positionRef.current) setColor((current) => nextColor(current));
    positionRef.current = null;
    setPosition(null);
    setLook(0);
  }

  function spot() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const edge = Math.floor(Math.random() * 3);
    const position = edge === 0
      ? { x: 12, y: 112 + Math.random() * Math.max(0, height - 230) }
      : edge === 1
        ? { x: Math.max(12, width - 104), y: 112 + Math.random() * Math.max(0, height - 230) }
        : { x: 12 + Math.random() * Math.max(0, width - 104), y: Math.max(112, height - 112) };
    const previous = positionRef.current || { x: Math.max(12, width - 104), y: Math.max(112, height - 112) };
    setLook(position.x > previous.x ? 1 : position.x < previous.x ? -1 : 0);
    positionRef.current = position;
    setPosition(position);
    setSide(position.x > width / 2 ? "right" : "left");
    setColor((current) => nextColor(current));
    if (Math.random() < 0.4) {
      setBubble(PHRASES[Math.floor(Math.random() * PHRASES.length)]);
    } else {
      setBubble("");
    }
    const timeout = window.setTimeout(() => {
      home();
      setBubble("");
      timeoutsRef.current.delete(timeout);
    }, 3000);
    timeoutsRef.current.add(timeout);
  }

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduceMotion.matches) return undefined;
    const timers = [];
    const timer = window.setInterval(() => {
      if (hoveredRef.current) return;
      spot();
    }, 7000);
    timers.push(timer);
    return () => {
      timers.forEach(window.clearInterval);
      timeoutsRef.current.forEach(window.clearTimeout);
      timeoutsRef.current.clear();
    };
  }, []);

  function onEnter() {
    hoveredRef.current = true;
    setHovered(true);
  }

  function onLeave() {
    hoveredRef.current = false;
    setHovered(false);
  }

  return (
    <button
      ref={triggerRef}
      type="button"
      className={`wbot-root${hovered ? " wbot-hover" : ""}`}
      aria-label="색채 챗봇 열기"
      onClick={() => setOpen(true)}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      style={position ? { left: `${position.x}px`, top: `${position.y}px`, right: "auto", bottom: "auto" } : undefined}
    >
      {bubble && <span className={`wbot-bubble wbot-bubble-${side}`}>{bubble}</span>}
      <BotFace mood={botMood} tint={color} size={56} look={look} />
      <span className="bot-wbot-hex">{color}</span>
    </button>
  );
}
