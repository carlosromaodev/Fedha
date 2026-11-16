import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Topbar } from "../../../layouts";
import { Modal, Stat, Talao, Tag, Volume, Wave, useToast, Send, UserPlus } from "../../../shared/ui";
import { assistants, queue as initial, streamer, type QueueMsg } from "../../../shared/mocks/data";
import { kz, maskPhone } from "../../../shared/lib/format";
import { LinkBox } from "../../../features/queue/LinkBox";

/**
 * S2 — Fila ao vivo (mockups B1, B2, B3). Só acompanhamento: o streamer não aprova, rejeita, pausa nem salta mensagens.
 * A única ação por mensagem é bloquear o remetente para mensagens futuras.
 */
export default function LiveQueue({ readOnly = false }: { readOnly?: boolean }) {
  const [blocked, setBlocked] = useState<string[]>([]);
  const [target, setTarget] = useState<QueueMsg | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const nav = useNavigate();
  const [vol, setVol] = useState(75);
  const toast = useToast();
  const now = initial.find((q) => q.status === "a_tocar");
  const next = initial.filter((q) => q.status === "na_fila");
  const played = initial.filter((q) => q.status === "tocada");

  return (
    <>
      {!readOnly && (
        <Topbar mtitle="Fila" mActions={false} title="Fila ao vivo" sub="Tocam por ordem de chegada; prioridade passa à frente. Não é possível parar mensagens já pagas.">
          <LinkBox />
        </Topbar>
      )}
      <div className="page">
        <div className="split">
          <div className="stack" style={{ gap: 12 }}>
            {/* Telemóvel (design mobile 23): estado do Player e volume numa linha. */}
            <div className="card row m-only m-row" style={{ gap: 12, padding: "10px 14px" }}>
              <span className="tag ok">Player ligado</span>
              <div className="grow"><Volume value={vol} onChange={setVol} /></div>
            </div>
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
              <div key={m.id} style={{ position: "relative" }}>
                <Talao name={m.donor} meta={<span className="mono muted" style={{ fontSize: 12 }}>{i + 1}</span>}
                  text={m.kind === "audio" ? `Mensagem de voz · 00:${String(m.seconds).padStart(2, "0")}` : m.text} value={m.kz}
                  onMenu={readOnly ? undefined : () => setMenu(menu === m.id ? null : m.id)}>
                  {m.tags.map((t) => <Tag key={t}>{t}</Tag>)}
                  {blocked.includes(m.phone) && <Tag tone="erro">Remetente bloqueado</Tag>}
                </Talao>
                {menu === m.id && (
                  <div className="dropdown" role="menu" style={{ top: 44, right: 16 }}>
                    <button role="menuitem" onClick={() => nav(`/painel/historico?q=${encodeURIComponent(m.donor)}`)}>Ver no histórico</button>
                    <button role="menuitem" className="danger" onClick={() => { setMenu(null); setTarget(m); }}>Bloquear remetente</button>
                  </div>
                )}
              </div>
            ))}

            <span className="eyebrow d-only" style={{ marginTop: 8 }}>Já tocaram</span>
            <div className="lines d-only" style={{ padding: "0 16px" }}>
              {played.map((m) => (
                <div key={m.id} className="row" style={{ gap: 16, fontSize: 14 }}>
                  <span className="mono muted" style={{ fontSize: 12 }}>{m.at}</span>
                  <span className="grow muted" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.donor} · {m.kind === "audio" ? `Mensagem de voz · 00:0${m.seconds}` : m.text}</span>
                  <span className="kz" style={{ fontSize: 13 }}>{kz(m.kz)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="stack d-only" style={{ gap: 16 }}>
            {!readOnly && (
              <div className="grid g2" style={{ gridTemplateColumns: "1fr 1fr" }}>
                <Stat label="Recebido nesta live" value={38500} sub="21 mensagens" />
                <Stat label="Líquido (−10%)" value={34650} sub="pendente 48 h" />
              </div>
            )}
            <div className="card pad-l stack" style={{ gap: 12 }}>
              <div className="row between"><h2>Player e widgets</h2>{!readOnly && <Link to="/painel/widgets">Widgets</Link>}</div>
              <div className="lines" style={{ fontSize: 14, padding: 0 }}>
                <div className="row between"><span className="muted">W1 Alerta · TikTok LIVE Studio</span><Tag tone="ok">Ligado</Tag></div>
                <div className="row between"><span className="muted">Player · telemóvel</span><Tag tone="ok">Ligado</Tag></div>
              </div>
              <Volume value={vol} onChange={setVol} />
              <button className="btn block" onClick={() => toast.show("Alerta de teste enviado")}><Send aria-hidden />Enviar alerta de teste</button>
            </div>
            {!readOnly && (
              <div className="card pad-l">
                <div className="row between"><h2>Assistentes</h2><Link className="btn sm" to="/painel/assistentes"><UserPlus aria-hidden />Convidar</Link></div>
                <div className="lines" style={{ marginTop: 6, fontSize: 14 }}>
                  {assistants.map((a) => (
                    <div key={a.name} className="row between"><span className="muted">{a.name} · {a.contact}</span><Tag tone={a.status === "ativo" ? "ok" : "pend"}>{a.status === "ativo" ? "A ver a fila" : "Convite enviado"}</Tag></div>
                  ))}
                </div>
                <p className="hint">Acompanham a fila e controlam o som. Não veem a carteira.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {target && (
        <Modal title={`Bloquear ${target.donor}?`} onClose={() => setTarget(null)}>
          <p className="muted" style={{ lineHeight: 1.5, fontSize: 14 }}>Este número deixa de conseguir enviar mensagens para o teu canal, em todas as plataformas.</p>
          <div className="card stack mono" style={{ background: "var(--papel)", gap: 8, padding: 14, marginTop: 14, fontSize: 13 }}>
            <div className="row between"><span className="muted">Telemóvel</span><span>{maskPhone(target.phone)}</span></div>
            <div className="row between"><span className="muted">Enviado este mês</span><span>6 mensagens · {kz(7500)}</span></div>
            <div className="row between" style={{ borderTop: "1px dashed var(--linha-forte)", paddingTop: 8 }}><span>Já paga, na fila</span><b>1 · {kz(target.kz)}</b></div>
          </div>
          <p className="hint" style={{ marginTop: 12 }}>A mensagem que já está na fila foi paga e vai tocar. O bloqueio aplica-se a partir de agora. Podes desbloquear em Preços e filtros.</p>
          <div className="row" style={{ gap: 10, marginTop: 18 }}>
            <button className="btn grow" style={{ height: 52 }} onClick={() => setTarget(null)}>Cancelar</button>
            <button className="btn-route grow" style={{ background: "var(--erro)" }} onClick={() => { setBlocked((b) => [...b, target.phone]); setTarget(null); toast.show("Remetente bloqueado"); }}>
              <span className="label">Bloquear</span><span className="dot" style={{ background: "rgba(255,255,255,.35)" }} />
            </button>
          </div>
        </Modal>
      )}
      {toast.node}
    </>
  );
}
