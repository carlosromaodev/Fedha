import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { RouteButton, copy, useToast } from "../../../shared/ui";
import { streamer } from "../../../shared/mocks/data";
import { kz } from "../../../shared/lib/format";
import { useDraft } from "../../../features/composer/store";

type Stage = "fila" | "a_tocar" | "tocada";

/** P4 — Confirmação: acompanha a mensagem até tocar (mockup A7). */
export default function Confirmation() {
  const { id = "FL-8F3A-22C1" } = useParams();
  const nav = useNavigate();
  const { draft, reset } = useDraft();
  const toast = useToast();
  const [stage, setStage] = useState<Stage>("fila");
  const paidAt = new Date().toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });

  // Demonstração do ciclo: na fila → a tocar → tocada (na app real vem por tempo real).
  useEffect(() => {
    const a = setTimeout(() => setStage("a_tocar"), 5000);
    const b = setTimeout(() => setStage("tocada"), 11000);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, []);

  const total = draft.total || 2500;
  const steps = [
    { label: "Pago", right: paidAt, state: "done" },
    { label: stage === "fila" ? `Na fila · 2.º${draft.extras.priority ? " com prioridade" : ""}` : "Saiu da fila", right: stage === "fila" ? "~1 min" : "", state: stage === "fila" ? "now" : "done" },
    { label: stage === "tocada" ? "Tocou na live" : "A tocar na live", right: stage === "tocada" ? "agora" : stage === "a_tocar" ? "a tocar" : "a seguir", state: stage === "tocada" ? "done" : stage === "a_tocar" ? "now" : "next" },
  ];

  return (
    <div className="pub verde">
      <main className="pub-main" style={{ gap: 18 }}>
        <span className="tag" style={{ alignSelf: "flex-start", background: "var(--verde-claro)", color: "var(--verde)" }}>Pagamento confirmado</span>
        <div style={{ marginTop: 32 }}>
          <div className="kz" style={{ fontSize: 52, letterSpacing: "-0.03em" }}>{kz(total)}</div>
          <p style={{ fontSize: 21, fontWeight: 300, lineHeight: 1.35, marginTop: 8 }}>
            {stage === "tocada" ? `A tua mensagem tocou na live do ${streamer.name}.` : `A tua mensagem vai tocar na live do ${streamer.name}.`}
          </p>
        </div>
        <div className="track" aria-live="polite">
          {steps.map((s) => (
            <div key={s.label}>
              <span className={`b ${s.state}`} aria-hidden />
              <b className="grow" style={{ fontWeight: 500 }}>{s.label}</b>
              <span className="mono" style={{ fontSize: 12 }}>{s.right}</span>
            </div>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <div className="row between mono" style={{ fontSize: 12 }}>
          <span>Recibo {id}</span><span>{new Date().toLocaleDateString("pt-PT")}</span>
        </div>
      </main>
      <footer className="pub-foot">
        <div className="grid g2" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <button className="btn ghost-light block" onClick={() => toast.show("O recibo PDF fica disponível quando a API estiver ligada")}>Descarregar recibo</button>
          <button className="btn ghost-light block" onClick={() => { copy(`https://fedha.live/r/${id}`); toast.show("Link do recibo copiado"); }}>Partilhar</button>
        </div>
        <RouteButton tone="sinal" onClick={() => { reset(); nav(`/${streamer.handle}`); }}>Enviar outra mensagem</RouteButton>
      </footer>
      {toast.node}
    </div>
  );
}
