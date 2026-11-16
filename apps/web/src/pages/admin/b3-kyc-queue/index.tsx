import { useState } from "react";
import { Topbar } from "../../../layouts";
import { Field, Modal, RouteButton, Tag, useToast, Search } from "../../../shared/ui";
import { kycQueue } from "../../../shared/mocks/data";
import { cx, kz } from "../../../shared/lib/format";

const DOCS = ["BI · frente", "BI · verso", "Selfie"];
const REASONS = ["Foto do BI desfocada", "Selfie não mostra o documento", "Nome do IBAN diferente", "NIF inválido"];

/** B3 — Verificação e suspensão (31): dados, documento ampliado, rejeição com motivo e suspensão com impacto. */
export default function KycQueue() {
  const toast = useToast();
  const [list, setList] = useState(kycQueue);
  const [sel, setSel] = useState(kycQueue[0]!);
  const [doc, setDoc] = useState(DOCS[0]!);
  const [scale, setScale] = useState(200);
  const [rot, setRot] = useState(0);
  const [reject, setReject] = useState(false);
  const [suspend, setSuspend] = useState(false);
  const [reason, setReason] = useState(REASONS[0]!);
  const [note, setNote] = useState("");
  const [susReason, setSusReason] = useState("Suspeita de fraude");
  const decide = (msg: string) => { const rest = list.filter((x) => x !== sel); setList(rest); if (rest[0]) setSel(rest[0]); toast.show(msg); };

  return (
    <>
      <Topbar title="Verificar streamer" sub={list.length ? `${sel.name} · pedido de ${sel.sent}` : "Fila vazia"}>
        {list.length > 0 && <button className="btn danger" onClick={() => setSuspend(true)}>Suspender conta</button>}
      </Topbar>
      <div className="page">
        {list.length > 1 && (
          <div className="chips" aria-label="Fila de verificação">
            {list.map((k) => <button key={k.id} className={cx("chip", k === sel && "on")} onClick={() => setSel(k)}>{k.name} · {k.status}</button>)}
          </div>
        )}
        {list.length === 0 ? <div className="card pad-l"><p className="muted">Não há verificações por analisar.</p></div> : (
          <div className="split" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,1.05fr)" }}>
            <div className="card pad-l">
              <div className="row between" style={{ paddingBottom: 10, borderBottom: "1px solid var(--tinta)" }}><h2>Dados</h2><Tag tone="pend">Em análise</Tag></div>
              <div className="lines kv">
                <div><span>Nome</span><span className="mono">{sel.legal}</span></div>
                <div><span>Canal</span><span className="mono">{sel.name} · TikTok, YouTube</span></div>
                <div><span>BI</span><span className="mono">004812337LA041</span></div>
                <div><span>NIF</span><span className="mono">004812337LA041</span></div>
                <div><span>IBAN</span><span className="mono">AO06 0040 •••• 0932</span></div>
              </div>
              <div className="grid g3" style={{ marginTop: 14, gridTemplateColumns: "repeat(3,1fr)" }}>
                {DOCS.map((d) => (
                  <button key={d} onClick={() => setDoc(d)} className={cx("doc-thumb", doc === d && "on")}>
                    <span className="tag"><Search size={11} />Ampliar</span><span className="eyebrow">{d === "Selfie" ? "Selfie com BI" : d}</span>
                  </button>
                ))}
              </div>
              <div className="row" style={{ gap: 8, marginTop: 16, flexWrap: "wrap" }}>
                <button className="btn danger" onClick={() => setReject(true)}>Rejeitar</button>
                <button className="btn" onClick={() => decide("Pedido de novo documento enviado ao streamer")}>Pedir novo documento</button>
                <div style={{ width: 160, marginLeft: "auto" }}><RouteButton size="sm" onClick={() => decide(`${sel.name} aprovado`)}>Aprovar</RouteButton></div>
              </div>
            </div>
            <div className="doc-viewer" role="region" aria-label={`Documento ${doc}`}>
              <div className="row" style={{ gap: 8 }}>
                {DOCS.map((d) => <button key={d} className={cx("chip", "dv-chip", doc === d && "on")} onClick={() => setDoc(d)}>{d}</button>)}
                <span className="grow" />
              </div>
              <div className="dv-canvas" style={{ transform: `rotate(${rot}deg)` }}>
                <span className="mono">{doc} · ampliado {scale}%</span>
              </div>
              <div className="row" style={{ gap: 8, justifyContent: "center" }}>
                <button className="btn ghost-light sm" onClick={() => setScale(Math.max(50, scale - 50))} aria-label="Reduzir">−</button>
                <span className="btn ghost-light sm mono" style={{ pointerEvents: "none" }}>{scale}%</span>
                <button className="btn ghost-light sm" onClick={() => setScale(scale + 50)} aria-label="Ampliar">+</button>
                <button className="btn ghost-light sm" onClick={() => setRot((rot + 90) % 360)}>Rodar</button>
                <button className="btn ghost-light sm" onClick={() => { setScale(100); setRot(0); }}>Ajustar ao ecrã</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {reject && (
        <Modal title={`Rejeitar verificação de ${sel.name}?`} onClose={() => setReject(false)}>
          <p className="muted" style={{ fontSize: 14 }}>O streamer continua a receber mensagens, mas não pode levantar até enviar documentos válidos.</p>
          <div className="stack" style={{ gap: 12, marginTop: 14 }}>
            <label className="field"><span className="lbl">Motivo</span><select value={reason} onChange={(e) => setReason(e.target.value)}>{REASONS.map((r) => <option key={r}>{r}</option>)}</select></label>
            <Field label="Nota para o streamer" error={note && note.length < 10 ? "Escreve pelo menos 10 caracteres." : null}><textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Escreve uma nota" /></Field>
          </div>
          <div className="row" style={{ gap: 10, marginTop: 16 }}>
            <button className="btn grow" style={{ height: 52 }} onClick={() => setReject(false)}>Cancelar</button>
            <RouteButton disabled={note.length < 10} onClick={() => { setReject(false); setNote(""); decide("Verificação rejeitada"); }}>Rejeitar</RouteButton>
          </div>
        </Modal>
      )}
      {suspend && (
        <Modal title={`Suspender a conta de ${sel.name}?`} onClose={() => setSuspend(false)}>
          <p className="muted" style={{ fontSize: 14 }}>A página deixa de aceitar pagamentos de imediato e os levantamentos ficam bloqueados.</p>
          <div className="card stack mono" style={{ background: "var(--papel)", gap: 8, padding: 14, fontSize: 12.5, marginTop: 12 }}>
            <div className="row between"><span className="muted">Mensagens já pagas na fila</span><span>3 · tocam até ao fim</span></div>
            <div className="row between"><span className="muted">Saldo retido</span><span>{kz(92180)}</span></div>
            <div className="row between"><span className="muted">Levantamento em curso</span><span>{kz(82000)} · cancelado</span></div>
          </div>
          <label className="field" style={{ marginTop: 12 }}><span className="lbl">Motivo</span>
            <select value={susReason} onChange={(e) => setSusReason(e.target.value)}><option>Suspeita de fraude</option><option>Conteúdo ilegal</option><option>Pedido do titular</option></select>
          </label>
          <div className="row" style={{ gap: 10, marginTop: 16 }}>
            <button className="btn grow" style={{ height: 52 }} onClick={() => setSuspend(false)}>Cancelar</button>
            <button className="btn-route grow" style={{ background: "var(--erro)" }} onClick={() => { setSuspend(false); toast.show("Conta suspensa"); }}><span className="label">Suspender</span><span className="dot" style={{ background: "rgba(255,255,255,.35)" }} /></button>
          </div>
        </Modal>
      )}
      {toast.node}
    </>
  );
}
