import { useState } from "react";
import { Topbar } from "../../../layouts";
import { Empty, Field, Modal, Tag, useToast } from "../../../shared/ui";
import { withdrawalsQueue } from "../../../shared/mocks/data";
import { kz } from "../../../shared/lib/format";

const REASONS = ["IBAN não corresponde ao titular", "Verificação de identidade em falta", "Suspeita de fraude", "Outro"];

/** B6 — Levantamentos por processar · rejeitar com motivo (mockup D3). */
export default function Withdrawals() {
  const [list, setList] = useState(withdrawalsQueue);
  const [rej, setRej] = useState<(typeof withdrawalsQueue)[number] | null>(null);
  const [reason, setReason] = useState(REASONS[0]!);
  const [note, setNote] = useState("");
  const toast = useToast();
  const total = list.reduce((s, w) => s + w.kz, 0);

  return (
    <>
      <Topbar title="Levantamentos">
        <button className="btn" onClick={() => toast.show("Ficheiro de pagamentos em lote gerado")}>Exportar lote</button>
      </Topbar>
      <div className="page">
        <div className="row between"><span className="eyebrow">Por processar · {list.length}</span><span className="kz">{kz(total)}</span></div>
        <div className="card table-wrap" style={{ padding: 0 }}>
          {list.length === 0 ? <Empty title="Nada por processar" /> : (
            <table className="table">
              <thead><tr><th>ID</th><th>Pedido</th><th>Streamer</th><th>Destino</th><th>Risco</th><th className="num">Valor</th><th /></tr></thead>
              <tbody>
                {list.map((w) => (
                  <tr key={w.id}>
                    <td className="id">{w.id}</td><td className="mono muted" style={{ fontSize: 12.5 }}>{w.at}</td><td>{w.streamer}</td>
                    <td className="mono" style={{ fontSize: 12.5 }}>{w.dest}</td>
                    <td><Tag tone={w.risk === "baixo" ? "ok" : "pend"}>{w.risk}</Tag></td>
                    <td className="num kz">{kz(w.kz)}</td>
                    <td className="num">
                      <div className="row" style={{ gap: 6, justifyContent: "flex-end" }}>
                        <button className="btn sm" onClick={() => setRej(w)}>Rejeitar</button>
                        <button className="btn verde sm" onClick={() => { setList(list.filter((x) => x !== w)); toast.show(`${w.id} aprovado`); }}>Aprovar</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      {rej && (
        <Modal title={`Rejeitar ${rej.id}?`} onClose={() => setRej(null)}>
          <p className="muted" style={{ fontSize: 14 }}>O valor de {kz(rej.kz)} volta ao saldo disponível de {rej.streamer}.</p>
          <div className="stack" style={{ gap: 12, marginTop: 14 }}>
            <label className="field"><span className="lbl">Motivo</span>
              <select value={reason} onChange={(e) => setReason(e.target.value)}>{REASONS.map((r) => <option key={r}>{r}</option>)}</select>
            </label>
            <Field label="Nota para o streamer" error={note && note.length < 10 ? "Escreve pelo menos 10 caracteres." : null}><textarea value={note} onChange={(e) => setNote(e.target.value)} /></Field>
          </div>
          <div className="row" style={{ gap: 10, marginTop: 16 }}>
            <button className="btn grow" onClick={() => setRej(null)}>Cancelar</button>
            <button className="btn dark grow" disabled={note.length < 10} onClick={() => { setList(list.filter((x) => x !== rej)); setRej(null); setNote(""); toast.show("Levantamento rejeitado"); }}>Rejeitar</button>
          </div>
        </Modal>
      )}
      {toast.node}
    </>
  );
}
