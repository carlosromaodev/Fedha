import { useState } from "react";
import { Topbar } from "../../../layouts";
import { Field, RouteButton, Tag, useToast } from "../../../shared/ui";

const FAQ = [
  ["Posso rejeitar uma mensagem?", "Não. As mensagens pagas tocam automaticamente. Usa os filtros e o bloqueio de remetentes para impedir mensagens antes do pagamento."],
  ["Quando é reembolsado um doador?", "Só por falha técnica: erro na voz, áudio corrompido, pagamento duplicado ou mensagem que não tocou em 7 dias."],
  ["O overlay não aparece no TikTok LIVE Studio", "É um problema conhecido do Link Source (fonte a 0×0 px). O contorno é usar o OBS como câmara virtual. Vê o guia na página Overlay e alertas."],
  ["Quanto tempo demora um levantamento?", "Até 2 dias úteis depois da aprovação. Precisas da verificação de identidade concluída."],
];

/** S15 — Ajuda e suporte. */
export default function Support() {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const toast = useToast();
  return (
    <>
      <Topbar title="Ajuda" />
      <div className="page">
        <div className="split" style={{ gridTemplateColumns: "minmax(0,1.2fr) minmax(0,1fr)" }}>
          <div className="card pad-l">
            <h2>Perguntas frequentes</h2>
            <div className="lines" style={{ marginTop: 8 }}>
              {FAQ.map(([q, a]) => (
                <details key={q}><summary style={{ cursor: "pointer", fontWeight: 500 }}>{q}</summary><p className="muted" style={{ marginTop: 8, lineHeight: 1.5, fontSize: 14 }}>{a}</p></details>
              ))}
            </div>
          </div>
          <div className="stack" style={{ gap: 16 }}>
            <div className="card pad-l stack" style={{ gap: 12 }}>
              <h2>Abrir pedido</h2>
              <Field label="Assunto"><input value={subject} onChange={(e) => setSubject(e.target.value)} /></Field>
              <Field label="Descrição" hint="Inclui o ID da mensagem ou do levantamento, se tiveres."><textarea value={body} onChange={(e) => setBody(e.target.value)} /></Field>
              <RouteButton disabled={subject.length < 4 || body.length < 10} onClick={() => { setSubject(""); setBody(""); toast.show("Pedido enviado · respondemos em até 24 h"); }}>Enviar</RouteButton>
            </div>
            <div className="card pad-l">
              <h2>Os teus pedidos</h2>
              <div className="lines" style={{ marginTop: 8, fontSize: 14 }}>
                <div className="row between"><span>#T-1042 · Levantamento atrasado</span><Tag tone="pend">Em análise</Tag></div>
                <div className="row between"><span>#T-0987 · Mudar IBAN</span><Tag tone="ok">Resolvido</Tag></div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {toast.node}
    </>
  );
}
