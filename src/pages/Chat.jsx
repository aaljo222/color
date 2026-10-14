import { useLocation, useNavigate } from "react-router-dom";
import ChatPanel from "../chat/ChatPanel.jsx";
import { useChat } from "../chat/ChatContext.jsx";
import BotFace from "../chat/BotFace.jsx";

export default function Chat() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setOpen, botMood } = useChat();

  function minimize() {
    setOpen(true);
    if ((window.history.state?.idx ?? 0) > 0) navigate(-1);
    else navigate("/", { replace: true, state: { fromChat: location.pathname } });
  }

  return (
    <section className="chat-page">
      <div className="chat-page-heading">
        <div className="bot-page-brand">
          <BotFace mood={botMood} tint="#2f5d50" size={72} />
          <div>
            <h1 className="title">색채 챗봇</h1>
            <p className="lead">기분을 나누거나 색에 관한 질문을 해 보세요. 장면과 색의 근거를 함께 찾아드려요.</p>
          </div>
        </div>
        <button className="ghost" type="button" onClick={minimize}>위젯으로 줄이기</button>
      </div>
      <ChatPanel variant="page" />
    </section>
  );
}
