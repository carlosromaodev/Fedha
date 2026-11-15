import { useState } from "react";
import { Topbar } from "../../../layouts";
import { Modal, Tag, useToast } from "../../../shared/ui";
import { streamersList } from "../../../shared/mocks/data";
import { kz } from "../../../shared/lib/format";

/** B2 — Streamers, com suspensão (mockup D4, cartão "Suspender"). */
export default function Streamers() {
  const [list, setList] = useState(streamersList);
  const [q, setQ] = useState("");
  const [sus, setSus] = useState<(typeof streamersList)[number] | null>(null);
  const [reason, setReason] = useState("Suspeita de fraude");
  const toast = useToast();
  const rows = list.filter((s) => !q || `${s.name} ${s.handle}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <Topbar title="Streamers" />
      <div className="page">
        <input className="chip" style={{ maxWidth: 320, outline: 0 }} placeholder="Procurar nome ou link" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Procurar" />
        <div className="card table-wrap" style={{ padding: 0 }}>
          <table className="table">
            <thead><tr><th>Streamer</th><th>Link</th><th>Plataforma</th><th>Verificação</th><th className="num">Este mês</th><th>Estado</th><th /></tr></thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.handle}>
                  <td><b style={{ fontWeight: 500 }}>{s.name}</b></td><td className="mono" style={{ fontSize: 12.5 }}>fedha.live/{s.handle}</td><td>{s.platform}</td>
                  <td><Tag tone={s.kyc === "aprovado" ? "ok" : "pend"}>{s.kyc}</Tag></td>
                  <td className="num kz">{kz(s.month)}</td>
                  <td><Tag tone={s.status === "ativo" ? "ok" : "erro"}>{s.status}</Tag></td>
                  <td className="num">
                    {s.status === "ativo"
                      ? <button className="btn danger sm" onClick={() => setSus(s)}>Suspender</button>
                      : <button className="btn sm" onClick={() => { setList(list.map((x) => (x === s ? { ...x, status: "ativo" } : x))); toast.show("Conta reativada"); }}>Reativar</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {sus && (
        <Modal title={`Suspender a conta de ${sus.name}?`} onClose={() => setSus(null)}>
          <p className="muted" style={{ fontSize: 14 }}>A página deixa de aceitar pagamentos de imediato e os levantamentos ficam bloqueados.</p>
          <div className="card stack mono" style={{ background: "var(--papel)", gap: 8, padding: 14, fontSize: 12.5, marginTop: 12 }}>
            <div className="row between"><span className="muted">Mensagens já pagas na fila</span><span>3 · tocam até ao fim</span></div>
            <div className="row between"><span className="muted">Saldo retido</span><span>{kz(92180)}</span></div>
            <div className="row between"><span className="muted">Levantamento em curso</span><span>{kz(82000)} · cancelado</span></div>
          </div>
          <label className="field" style={{ marginTop: 12 }}><span className="lbl">Motivo</span>
            <select value={reason} onChange={(e) => setReason(e.target.value)}><option>Suspeita de fraude</option><option>Conteúdo ilegal</option><option>Pedido do titular</option></select>
          </label>
          <div className="row" style={{ gap: 10, marginTop: 16 }}>
            <button className="btn grow" onClick={() => setSus(null)}>Cancelar</button>
            <button className="btn grow" style={{ background: "var(--erro)", borderColor: "var(--erro)", color: "var(--branco)" }} onClick={() => { setList(list.map((x) => (x === sus ? { ...x, status: "suspenso" } : x))); setSus(null); toast.show("Conta suspensa"); }}>Suspender</button>
          </div>
        </Modal>
      )}
      {toast.node}
    </>
  );
}
