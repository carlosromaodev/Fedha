import { useState } from "react";
import { Link } from "react-router-dom";
import { LiveBadge, Talao, Tag, Volume, Wave, useToast, Volume2 } from "../../../shared/ui";
import { queue, streamer } from "../../../shared/mocks/data";
import { kz } from "../../../shared/lib/format";

/** AS2 — Assistente: fila e Player no telemóvel (mockup C1). Só acompanha; não aprova nem rejeita. */
export default function AssistantQueue() {
  const [tab, setTab] = useState<"fila" | "player">("fila");
  const [vol, setVol] = useState(75);
  const toast = useToast();
  const now = queue.find((q) => q.status === "a_tocar")!;
  const next = queue.filter((q) => q.status === "na_fila");
  return (
    <div className="pub">
      <header className="sp-head">
        <span>Assistente de <b>{streamer.name}</b></span>
        <LiveBadge />
      </header>
      <main className="pub-main">
        <div className="seg">
          <button className={tab === "fila" ? "on" : ""} onClick={() => setTab("fila")}>Fila</button>
          <button className={tab === "player" ? "on" : ""} onClick={() => setTab("player")}>Player</button>
        </div>
        <div className="card verde" aria-live="polite">
          <div className="row between"><span className="eyebrow" style={{ color: "rgba(255,255,255,.8)" }}>A tocar · {now.donor}</span><span className="kz">{kz(now.kz)}</span></div>
          <div className="row" style={{ gap: 10, marginTop: 10 }}><Wave n={8} /><b>Voz padrão</b></div>
          <p style={{ marginTop: 8, lineHeight: 1.4 }}>"{now.text}"</p>
          <div className="progress" style={{ marginTop: 12 }}><i style={{ width: "18%" }} /></div>
          <div className="row" style={{ gap: 12, marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,.15)" }}>
            <div className="grow"><Volume value={vol} onChange={setVol} dark /></div>
            <button className="btn ghost-light sm" onClick={() => toast.show("Som de teste enviado")}><Volume2 aria-hidden />Testar</button>
          </div>
        </div>
        {tab === "fila" ? (
          <>
            <span className="eyebrow">A seguir · {next.length}</span>
            {next.map((m, i) => (
              <Talao key={m.id} name={m.donor} meta={<span className="mono muted" style={{ fontSize: 12 }}>{i + 1}</span>}
                text={m.kind === "audio" ? `Mensagem de voz · 00:${m.seconds}` : m.text} value={kz(m.kz)}>
                {m.tags.map((t) => <Tag key={t}>{t}</Tag>)}
              </Talao>
            ))}
          </>
        ) : (
          <div className="card stack" style={{ gap: 10 }}>
            <p className="muted" style={{ fontSize: 14 }}>Se o streamer usa o modo só-áudio, abre o Player neste aparelho e liga-o à coluna.</p>
            <Link className="btn block" to="/assistente/player">Abrir Player só-áudio</Link>
          </div>
        )}
      </main>
      {toast.node}
    </div>
  );
}
