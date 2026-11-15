import { useState } from "react";
import { Topbar } from "../../../layouts";
import { Field, Modal, RouteButton, Tag, useToast } from "../../../shared/ui";
import { kycQueue } from "../../../shared/mocks/data";

const DOCS = ["BI · frente", "BI · verso", "Selfie com BI"];
const REASONS = ["Foto do BI desfocada", "Selfie não mostra o documento", "Nome do IBAN diferente", "NIF inválido"];

/** B3 — Fila de verificação · Compliance (mockup D4). */
export default function KycQueue() {
  const [list, setList] = useState(kycQueue);
  const [sel, setSel] = useState(kycQueue[0]!);
  const [zoom, setZoom] = useState<string | null>(null);
  const [scale, setScale] = useState(200);
  const [reject, setReject] = useState(false);
  const [reason, setReason] = useState(REASONS[0]!);
  const [note, setNote] = useState("");
  const toast = useToast();
  const decide = (msg: string) => { const rest = list.filter((x) => x !== sel); setList(rest); if (rest[0]) setSel(rest[0]); toast.show(msg); };

  return (
    <>
      <Topbar title="Verificações" />
      <div className="page">
        <div className="split" style={{ gridTemplateColumns: "300px minmax(0,1fr)" }}>
          <div className="card lines" style={{ padding: "0 16px" }}>
            {list.map((k) => (
              <button key={k.id} onClick={() => setSel(k)} className="row between" style={{ width: "100%", border: 0, background: k === sel ? "var(--papel)" : "none", textAlign: "left", gap: 8, borderRadius: 8, padding: "12px 8px" }}>
                <span><b style={{ fontWeight: 500 }}>{k.name}</b><br /><small className="mono muted">{k.sent}</small></span>
                <Tag tone={k.status === "pendente" ? "pend" : undefined}>{k.status}</Tag>
              </button>
            ))}
            {list.length === 0 && <p className="muted">Fila vazia.</p>}
          </div>
          {list.length > 0 && (
            <div className="card pad-l">
              <div className="row between" style={{ paddingBottom: 12, borderBottom: "1px solid var(--tinta)" }}><h2 style={{ fontSize: 20 }}>Verificar streamer</h2><Tag tone="pend">Em análise</Tag></div>
              <div className="lines mono" style={{ fontSize: 13 }}>
                {[["Nome", sel.legal], ["Canal", `${sel.name} · TikTok`], ["BI", "004812337LA041"], ["NIF", "004812337LA041"], ["IBAN", "AO06 0040 •••• 0932"], ["Pedido", sel.sent]].map(([k, v]) => (
                  <div key={k} className="row between"><span style={{ fontFamily: "var(--font)" }} className="muted">{k}</span><span>{v}</span></div>
                ))}
              </div>
              <div className="grid g3" style={{ marginTop: 12 }}>
                {DOCS.map((d) => (
                  <button key={d} onClick={() => setZoom(d)} style={{ aspectRatio: "4/3", border: "1px solid var(--linha)", borderRadius: 12, background: "repeating-linear-gradient(135deg,#eef2ee 0 8px,#e6ebe7 8px 16px)", position: "relative", textAlign: "left", padding: 10 }}>
                    <span className="tag" style={{ position: "absolute", top: 8, right: 8, background: "var(--branco)" }}>Ampliar</span>
                    <span className="eyebrow" style={{ position: "absolute", bottom: 10 }}>{d}</span>
                  </button>
                ))}
              </div>
              <div className="row" style={{ gap: 8, marginTop: 16, flexWrap: "wrap" }}>
                <button className="btn danger" onClick={() => setReject(true)}>Rejeitar</button>
                <button className="btn" onClick={() => decide("Pedido de novo documento enviado")}>Pedir novo documento</button>
                <div style={{ width: 180, marginLeft: "auto" }}><RouteButton size="sm" onClick={() => decide(`${sel.name} aprovado`)}>Aprovar</RouteButton></div>
              </div>
            </div>
          )}
        </div>
      </div>
      {zoom && (
        <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && setZoom(null)}>
          <div style={{ width: "min(900px,100%)", background: "var(--tinta)", borderRadius: 24, padding: 18, color: "var(--branco)" }} role="dialog" aria-label={zoom}>
            <div className="row" style={{ gap: 8 }}>
              {DOCS.map((d) => <button key={d} className="chip" style={zoom === d ? { background: "var(--sinal)", border: 0 } : { background: "transparent", color: "var(--branco)" }} onClick={() => setZoom(d)}>{d}</button>)}
              <button className="link" style={{ marginLeft: "auto", color: "var(--branco)" }} onClick={() => setZoom(null)}>Fechar ×</button>
            </div>
            <div style={{ height: 420, marginTop: 14, borderRadius: 12, background: "repeating-linear-gradient(135deg,#1b2a24 0 12px,#18251f 12px 24px)", display: "flex", alignItems: "flex-end", padding: 14 }}>
              <span className="mono" style={{ fontSize: 12 }}>{zoom} · ampliado {scale}%</span>
            </div>
            <div className="row" style={{ gap: 8, justifyContent: "center", marginTop: 14 }}>
              <button className="btn ghost-light sm" onClick={() => setScale(Math.max(50, scale - 50))}>−</button>
              <span className="mono">{scale}%</span>
              <button className="btn ghost-light sm" onClick={() => setScale(scale + 50)}>+</button>
              <button className="btn ghost-light sm">Rodar</button>
              <button className="btn ghost-light sm" onClick={() => setScale(100)}>Ajustar ao ecrã</button>
            </div>
          </div>
        </div>
      )}
      {reject && (
        <Modal title={`Rejeitar verificação de ${sel.name}?`} onClose={() => setReject(false)}>
          <p className="muted" style={{ fontSize: 14 }}>O streamer continua a receber mensagens, mas não pode levantar até enviar documentos válidos.</p>
          <div className="stack" style={{ gap: 12, marginTop: 14 }}>
            <label className="field"><span className="lbl">Motivo</span><select value={reason} onChange={(e) => setReason(e.target.value)}>{REASONS.map((r) => <option key={r}>{r}</option>)}</select></label>
            <Field label="Nota para o streamer" error={note && note.length < 10 ? "Escreve pelo menos 10 caracteres." : null}><textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Escreve uma nota" /></Field>
          </div>
          <div className="row" style={{ gap: 10, marginTop: 16 }}>
            <button className="btn grow" onClick={() => setReject(false)}>Cancelar</button>
            <button className="btn dark grow" disabled={note.length < 10} onClick={() => { setReject(false); setNote(""); decide("Verificação rejeitada"); }}>Rejeitar</button>
          </div>
        </Modal>
      )}
      {toast.node}
    </>
  );
}
