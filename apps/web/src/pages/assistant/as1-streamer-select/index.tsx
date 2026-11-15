import { useNavigate, useParams } from "react-router-dom";
import { Logo, RouteButton } from "../../../shared/ui";
import { streamer } from "../../../shared/mocks/data";

/** AS1 — Aceitar convite de assistente · convite expirado (mockup C2). */
export default function AcceptInvite() {
  const { token = "" } = useParams();
  const nav = useNavigate();
  const expired = token.toLowerCase().includes("exp");
  return (
    <div className="pub">
      <header className="sp-head"><Logo /></header>
      <main className="pub-main" style={{ justifyContent: "center", gap: 16 }}>
        {expired ? (
          <>
            <span className="tag erro" style={{ alignSelf: "flex-start" }}>Convite expirado</span>
            <h1>Este convite já não é válido</h1>
            <p className="muted">Os convites duram 48 h. Pede ao {streamer.name} para te enviar um novo.</p>
          </>
        ) : (
          <>
            <span className="avatar l">KG</span>
            <h1>{streamer.name} convidou-te para assistente</h1>
            <div className="card lines" style={{ fontSize: 14 }}>
              <div className="row" style={{ gap: 10 }}><span className="tag ok">Podes</span> Acompanhar a fila em direto</div>
              <div className="row" style={{ gap: 10 }}><span className="tag ok">Podes</span> Controlar o volume e testar o som</div>
              <div className="row" style={{ gap: 10 }}><span className="tag">Não podes</span> Ver a carteira nem as definições</div>
              <div className="row" style={{ gap: 10 }}><span className="tag">Não podes</span> Aprovar ou rejeitar mensagens</div>
            </div>
          </>
        )}
      </main>
      <footer className="pub-foot">
        {expired ? <button className="btn block" onClick={() => nav("/")}>Voltar ao início</button>
          : <RouteButton onClick={() => nav("/assistente")}>Aceitar convite</RouteButton>}
      </footer>
    </div>
  );
}
