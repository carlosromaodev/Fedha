import { useState } from "react";
import { Topbar } from "../../../layouts";
import { Empty, Field, RouteButton, Tag, useToast } from "../../../shared/ui";
import { kz } from "../../../shared/lib/format";

const QUEUE = [
  { id: "LV-2201", streamer: "Kiami Gamer", kyc: "verificado", bank: "BAI AO06 •••• 4471", at: "14/11 21:10", kz: 150000 },
  { id: "LV-2200", streamer: "DJ Nelo", kyc: "verificado", bank: "BFA AO06 •••• 0932", at: "14/11 18:22", kz: 284000 },
  { id: "LV-2199", streamer: "Luana Plays", kyc: "verificado", bank: "BIC AO06 •••• 7710", at: "14/11 11:05", kz: 96400 },
  { id: "LV-2197", streamer: "Mano Zé TV", kyc: "doc. expirado", bank: "ATL AO06 •••• 2208", at: "13/11 23:40", kz: 82000 },
];
const REASONS = ["Documento de identidade expirado", "IBAN não corresponde ao titular", "Suspeita de fraude", "Outro"];

/** B6 — Levantamentos por processar (30). Rejeitar pede motivo e nota para o streamer. */
export default function Withdrawals() {
  const toast = useToast();
  const [list, setList] = useState(QUEUE);
  const [rej, setRej] = useState<string | null>("LV-2197");
  const [reason, setReason] = useState(REASONS[0]!);
  const [note, setNote] = useState("Envia um BI válido em Conta → Verificação.");
  const total = list.reduce((s, w) => s + w.kz, 0);
  const target = list.find((w) => w.id === rej);

  return (
    <>
      <Topbar title="Levantamentos" sub={`${list.length} por processar · ${kz(total)}`}>
        <button className="btn" onClick={() => toast.show("Ficheiro de pagamentos em lote gerado")}>Exportar lote</button>
      </Topbar>
      <div className="page" style={{ maxWidth: 900 }}>
        <div className="card" style={{ padding: "6px 20px" }}>
          {list.length === 0 && <Empty title="Nada por processar" />}
          <div className="lines">
            {list.map((w) => (
              <div key={w.id}>
                <div className="row" style={{ gap: 16, flexWrap: "wrap" }}>
                  <div className="grow">
                    <div className="row" style={{ gap: 8 }}><b>{w.streamer}</b><Tag tone={w.kyc === "verificado" ? "ok" : "pend"}>{w.kyc}</Tag></div>
                    <div className="mono muted" style={{ fontSize: 12, marginTop: 4 }}>{w.bank} · pedido {w.at}</div>
                  </div>
                  <span className="kz">{kz(w.kz)}</span>
                  <button className="btn sm" onClick={() => setRej(rej === w.id ? null : w.id)}>Rejeitar</button>
                  <div style={{ width: 150 }}>
                    <RouteButton size="sm" disabled={w.kyc !== "verificado"} onClick={() => { setList(list.filter((x) => x !== w)); toast.show(`${w.id} em pagamento · comprovativo enviado por SMS`); }}>Processar</RouteButton>
                  </div>
                </div>
                {target && rej === w.id && (
                  <div className="card stack" style={{ background: "var(--papel)", gap: 12, marginTop: 14 }}>
                    <b>Rejeitar levantamento</b>
                    <div className="grid g2">
                      <label className="field"><span className="lbl">Motivo</span><select value={reason} onChange={(e) => setReason(e.target.value)}>{REASONS.map((r) => <option key={r}>{r}</option>)}</select></label>
                      <Field label="Nota para o streamer" error={note.trim().length < 10 ? "Escreve pelo menos 10 caracteres." : null}><input value={note} onChange={(e) => setNote(e.target.value)} /></Field>
                    </div>
                    <p className="muted" style={{ fontSize: 13 }}>{kz(w.kz)} voltam ao saldo disponível de {w.streamer}. O streamer recebe o motivo por SMS e no painel.</p>
                    <div className="row" style={{ gap: 10, justifyContent: "flex-end" }}>
                      <button className="btn" onClick={() => setRej(null)}>Cancelar</button>
                      <button className="btn" style={{ background: "var(--erro)", borderColor: "var(--erro)", color: "var(--branco)" }} disabled={note.trim().length < 10}
                        onClick={() => { setList(list.filter((x) => x !== w)); setRej(null); toast.show("Levantamento rejeitado"); }}>Rejeitar</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      {toast.node}
    </>
  );
}
