import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useChat } from "./ChatContext.jsx";
import WanderBot from "./WanderBot.jsx";
import ChatPanel from "./ChatPanel.jsx";

export default function ChatWidget() {
  const { pathname } = useLocation();
  const { open, setOpen, triggerRef } = useChat();
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (wasOpenRef.current && !open) {
      const timer = window.setTimeout(() => triggerRef.current?.focus(), 0);
      wasOpenRef.current = open;
      return () => window.clearTimeout(timer);
    }
    wasOpenRef.current = open;
    return undefined;
  }, [open, triggerRef]);
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, setOpen]);
  if (pathname === "/chat" || pathname === "/astral") return null;
  return open ? (
    <div className="chat-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <div className="chat-modal" role="dialog" aria-modal="true" aria-label="색채 챗봇">
        <ChatPanel variant="widget" onClose={() => setOpen(false)} />
      </div>
    </div>
  ) : <WanderBot />;
}
