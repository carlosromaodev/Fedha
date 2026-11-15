import { useState } from "react";
import { Topbar } from "../../../layouts";
import { Empty, Modal, RouteButton, Tag, useToast } from "../../../shared/ui";
import { kz, maskPhone } from "../../../shared/lib/format";

const FAILS = [
  { id: "FL-7C10-9AE4", streamer: "DJ Nelo", donor: "924000118", kz: 10000, reason: "Erro na geração de voz (TTS)", at: "14/11 21:01" },
  { id: "FL-7A02-11C8", streamer: "Luana Plays", donor: "936112512", kz: 3000, reason: "Áudio gravado corrompido", at: "14/11 19:40" },
  { id: "FL-7911-0F3B", streamer: "Kiami Gamer", donor: "927700774", kz: 1500, reason: "Pagamento duplicado", at: "14/11 18:12" },
];

/** Falhas técnicas e reembolso · Finanças (mockup D2). Reembolso só por falha técnica. */
export default function Failures() {
  const [list, setList] = useState(FAILS);
  const [sel, setSel] = useState<(typeof FAILS)[number] | null>(null);
  const toast = useToast();
  return (
    <>
      <Topbar title="Falhas técnicas" />
      <div className="page">
        <p className="muted">Mensagens pagas que não puderam ser emitidas, ou que não tocaram em 7 dias. O reembolso devolve o valor ao número que pagou e retira-o do saldo pendente do streamer.</p>
        <div className="card table-wrap" style={{ padding: 0 }}>
          {list.length === 0 ? <Empty title="Sem falhas por resolver" /> : (
            <table className="table">
              <thead><tr><th>ID</th><th>Data</th><th>Streamer</th><th>Doador</th><th>Motivo</th><th className="num">Valor</th><th /></tr></thead>
              <tbody>
                {list.map((f) => (
                  <tr key={f.id}>
                    <td className="id">{f.id}</td><td className="mono muted" style={{ fontSize: 12.5 }}>{f.at}</td><td>{f.streamer}</td>
                    <td className="mono" style={{ fontSize: 12.5 }}>{maskPhone(f.donor)}</td><td><Tag tone="erro">{f.reason}</Tag></td>
                    <td className="num kz">{kz(f.kz)}</td>
                    <td className="num"><button className="btn sm" onClick={() => setSel(f)}>Reembolsar</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      {sel && (
        <Modal title="Reembolsar por falha técnica" onClose={() => setSel(null)}>
          <div className="lines" style={{ fontSize: 14 }}>
            <div className="row between"><span className="muted">Pedido</span><span className="mono">{sel.id}</span></div>
            <div className="row between"><span className="muted">Motivo</span><span>{sel.reason}</span></div>
            <div className="row between"><span className="muted">Devolver a</span><span className="mono">{maskPhone(sel.donor)} · Multicaixa Express</span></div>
            <div className="row between"><span className="muted">Retirado do pendente de</span><span>{sel.streamer}</span></div>
          </div>
          <div className="aviso" style={{ marginTop: 14 }}>Fica registado na auditoria com o teu nome. O doador recebe SMS com o recibo.</div>
          <div className="row" style={{ gap: 10, marginTop: 16 }}>
            <button className="btn" style={{ height: 52, flex: "0 0 38%" }} onClick={() => setSel(null)}>Cancelar</button>
            <RouteButton value={sel.kz} onClick={() => { setList(list.filter((x) => x !== sel)); setSel(null); toast.show("Reembolso enviado"); }}>Reembolsar</RouteButton>
          </div>
        </Modal>
      )}
      {toast.node}
    </>
  );
}
