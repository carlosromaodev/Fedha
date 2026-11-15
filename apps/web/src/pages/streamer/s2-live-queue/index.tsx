import { useState } from "react";
import { Link } from "react-router-dom";
import { Topbar } from "../../../layouts";
import { LiveBadge, Modal, Stat, Talao, Tag, Volume, Wave, useToast } from "../../../shared/ui";
import { queue as initial, streamer, type QueueMsg } from "../../../shared/mocks/data";
import { kz, maskPhone } from "../../../shared/lib/format";
import { LinkBox } from "../../../features/queue/LinkBox";

/**
 * S2 — Fila ao vivo (mockups B1, B2, B3). Só acompanhamento: o streamer não aprova, rejeita, pausa nem salta mensagens.
 * A única ação por mensagem é bloquear o remetente para mensagens futuras.
 */
export default function LiveQueue({ readOnly = false }: { readOnly?: boolean }) {
  const [blocked, setBlocked] = useState<string[]>([]);
  const [target, setTarget] = useState<QueueMsg | null>(null);
  const [vol, setVol] = useState(75);
  const toast = useToast();
  const now = initial.find((q) => q.status === "a_tocar");
  const next = initial.filter((q) => q.status === "na_fila");
  const played = initial.filter((q) => q.status === "tocada");

  return (
    <>
      {!readOnly && (
        <Topbar title="Fila">
          <span className="hide-m"><LiveBadge>Ao vivo · 01:42:10</LiveBadge></span>
          <span className="hide-m"><Tag tone="ok">Overlay ligado · OBS</Tag></span>
          <LinkBox />
        </Topbar>
      )}
      <div className="page">
        <div className="split">
          <div className="stack" style={{ gap: 12 }}>
            {now ? (
              <div className="card verde pad-l" aria-live="polite">
                <div className="row between">
                  <span className="eyebrow" style={{ color: "rgba(255,255,255,.8)" }}>A tocar agora · voz padrão</span>
                  <span className="kz">{kz(now.kz)}</span>
                </div>
                <div className="row" style={{ gap: 12, marginTop: 12 }}><Wave n={9} /><b>{now.donor}</b></div>
                <p style={{ fontSize: 20, marginTop: 10, lineHeight: 1.35 }}>"{now.text}"</p>
                <div className="progress" style={{ marginTop: 16 }}><i style={{ width: "82%" }} /></div>
              </div>
            ) : (
              <div className="card"><p className="muted">Nada a tocar. As mensagens pagas tocam assim que chegam.</p></div>
            )}

            <div className="row between"><span className="eyebrow">A seguir · {next.length}</span><span className="mono muted" style={{ fontSize: 12 }}>≈ 1 min 10 s de fila</span></div>
            {next.length === 0 && <div className="card"><p className="muted">A fila está vazia. Partilha fedha.live/{streamer.handle} no chat.</p></div>}
            {next.map((m, i) => (
              <Talao key={m.id} name={m.donor} meta={<span className="mono muted" style={{ fontSize: 12 }}>{i + 1}</span>}
                text={m.kind === "audio" ? `Mensagem de voz · 00:${String(m.seconds).padStart(2, "0")}` : m.text} value={m.kz}
                onMenu={readOnly ? undefined : () => setTarget(m)}>
                {m.tags.map((t) => <Tag key={t}>{t}</Tag>)}
                {blocked.includes(m.phone) && <Tag tone="erro">Remetente bloqueado</Tag>}
              </Talao>
            ))}

            <span className="eyebrow" style={{ marginTop: 8 }}>Já tocaram</span>
            <div className="lines" style={{ padding: "0 16px" }}>
              {played.map((m) => (
                <div key={m.id} className="row" style={{ gap: 16, fontSize: 14 }}>
                  <span className="mono muted" style={{ fontSize: 12 }}>{m.at}</span>
                  <span className="grow muted" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.donor} · {m.kind === "audio" ? `Mensagem de voz · 00:0${m.seconds}` : m.text}</span>
                  <span className="kz" style={{ fontSize: 13 }}>{kz(m.kz)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="stack" style={{ gap: 16 }}>
            {!readOnly && (
              <div className="grid g2" style={{ gridTemplateColumns: "1fr 1fr" }}>
                <Stat label="Recebido nesta live" value={38500} sub="21 mensagens" />
                <Stat label="Líquido (−10%)" value={34650} sub="pendente 48 h" />
              </div>
            )}
            <div className="card pad-l stack" style={{ gap: 12 }}>
              <div className="row between"><h2>Saída</h2><Tag tone="ok">Overlay</Tag></div>
              <div className="row between" style={{ fontSize: 14 }}><span>Overlay · OBS</span><span className="mono muted" style={{ fontSize: 12 }}>PC · ligado há 1 h 42</span></div>
              <div className="row between" style={{ fontSize: 14 }}><span>Player só-áudio</span><span className="mono muted" style={{ fontSize: 12 }}>não usado</span></div>
              <p className="hint">Cada mensagem toca numa só saída. Com o overlay ligado, o Player não toca.</p>
              <Volume value={vol} onChange={setVol} />
              <button className="btn block" onClick={() => toast.show("Alerta de teste enviado para o overlay")}>Enviar alerta de teste</button>
            </div>
            {!readOnly && (
              <div className="card pad-l">
                <div className="row between"><h2>Filtro automático</h2><span className="kz" style={{ fontSize: 20 }}>4</span></div>
                <p className="muted" style={{ marginTop: 10, lineHeight: 1.5, fontSize: 14 }}>Mensagens travadas antes do pagamento nesta live: 2 com links, 1 com número de telefone, 1 com palavra proibida.</p>
                <Link to="/painel/filtros" style={{ display: "inline-block", marginTop: 12, fontSize: 14 }}>Editar palavras proibidas</Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {target && (
        <Modal title="Bloquear remetente?" onClose={() => setTarget(null)}>
          <p className="muted" style={{ lineHeight: 1.5 }}>
            <b style={{ color: "var(--tinta)" }}>{target.donor}</b> · <span className="mono">{maskPhone(target.phone)}</span>
          </p>
          <p style={{ marginTop: 12, lineHeight: 1.5, fontSize: 14 }}>
            As próximas mensagens deste número são barradas antes do pagamento. Esta mensagem já foi paga e vai tocar na mesma.
          </p>
          <div className="row" style={{ gap: 10, marginTop: 20 }}>
            <button className="btn grow" onClick={() => setTarget(null)}>Cancelar</button>
            <button className="btn dark grow" onClick={() => { setBlocked((b) => [...b, target.phone]); setTarget(null); toast.show("Remetente bloqueado"); }}>Bloquear</button>
          </div>
        </Modal>
      )}
      {toast.node}
    </>
  );
}
