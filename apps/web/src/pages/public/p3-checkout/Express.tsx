import { useEffect } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useCountdown } from "../../../shared/ui";
import { streamer } from "../../../shared/mocks/data";
import { kz, mmss, phone } from "../../../shared/lib/format";
import { useDraft } from "../../../features/composer/store";

const WINDOW = 5 * 60;

/** P3 — Multicaixa Express: aguardar aprovação na app (mockup A5). */
export default function Express() {
  const nav = useNavigate();
  const { draft } = useDraft();
  const left = useCountdown(WINDOW);
  const expires = new Date(Date.now() + left * 1000).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });

  // Demonstração: a confirmação chega por webhook; aqui simulamos ao fim de 6 s.
  useEffect(() => {
    const t = setTimeout(() => nav(`/r/${draft.orderId}`), 6000);
    return () => clearTimeout(t);
  }, [nav, draft.orderId]);

  // Sem pedido (ex.: link aberto diretamente): volta ao checkout, que explica o que fazer.
  if (!draft.total) return <Navigate to={`/${streamer.handle}/pagar`} replace />;

  if (left === 0) {
    return (
      <div className="pub"><main className="pub-main">
        <span className="tag erro" style={{ alignSelf: "flex-start" }}>Pedido expirou</span>
        <h1>O pagamento não foi aprovado a tempo</h1>
        <p className="muted">Nada foi cobrado. Podes tentar de novo.</p>
        <Link className="btn" to={`/${streamer.handle}/pagar`}>Tentar outra vez</Link>
      </main></div>
    );
  }

  const r = 62, c = 2 * Math.PI * r;
  return (
    <div className="pub">
      <main className="pub-main">
        <span className="eyebrow">Passo 3 de 3</span>
        <h1>Aprova o pagamento na app Multicaixa Express</h1>
        <p className="muted">Enviámos um pedido de {kz(draft.total)} para {phone(draft.phone)}.</p>
        <div className="card pad-l stack" style={{ gap: 14, alignItems: "center" }} aria-live="polite">
          <div className="ring" role="timer" aria-label={`Faltam ${mmss(left)}`}>
            <svg width="140" height="140" viewBox="0 0 140 140" aria-hidden>
              <circle cx="70" cy="70" r={r} fill="none" stroke="var(--linha)" strokeWidth="5" />
              <circle cx="70" cy="70" r={r} fill="none" stroke="var(--verde)" strokeWidth="5" strokeLinecap="round"
                strokeDasharray={c} strokeDashoffset={c * (1 - left / WINDOW)} style={{ transition: "stroke-dashoffset 1s linear" }} />
            </svg>
            <span>{mmss(left)}</span>
          </div>
          <p className="muted" style={{ fontSize: 14 }}>O pedido expira às {expires}</p>
        </div>
        <div className="trajeto" aria-hidden>
          <span className="eyebrow">Tu</span><span className="linha" /><span className="eyebrow">{streamer.name.split(" ")[0]}</span>
        </div>
        <div style={{ flex: 1 }} />
        <p className="muted" style={{ fontSize: 13, lineHeight: 1.5 }}>
          Podes mudar para a app e voltar. Se a rede cair, abre de novo fedha.live/{streamer.handle}: o estado do pagamento continua aqui.
        </p>
        <Link className="link" style={{ alignSelf: "center" }} to={`/${streamer.handle}/pagar/referencia`}>Mudar para Referência Multicaixa</Link>
      </main>
    </div>
  );
}
