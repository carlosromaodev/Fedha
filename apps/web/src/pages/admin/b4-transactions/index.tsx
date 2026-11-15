import { useMemo, useState } from "react";
import { Topbar } from "../../../layouts";
import { Empty, Modal, Tag, useToast } from "../../../shared/ui";
import { transactions, type TxStatus } from "../../../shared/mocks/data";
import { cx, kz, maskPhone } from "../../../shared/lib/format";

export const TX_TAG: Record<TxStatus, { label: string; tone?: "ok" | "pend" | "erro" | "dark" }> = {
  na_fila: { label: "Na fila", tone: "dark" },
  emitida: { label: "Emitida", tone: "ok" },
  falha: { label: "Falha técnica", tone: "erro" },
  aguarda: { label: "A aguardar pag.", tone: "pend" },
  reembolsada: { label: "Reembolsada" },
  expirada: { label: "Expirada" },
};

/** B4 — Transações · Finanças (mockups D1 e D5). */
export default function Transactions() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<TxStatus | "todos">("todos");
  const [method, setMethod] = useState<"todos" | "Multicaixa Express" | "Referência">("todos");
  const [detail, setDetail] = useState<(typeof transactions)[number] | null>(null);
  const [view, setView] = useState<"dados" | "carregar" | "erro">("dados");
  const toast = useToast();

  const rows = useMemo(() => transactions.filter((t) =>
    (status === "todos" || t.status === status) && (method === "todos" || t.method === method) &&
    (!q || `${t.id} ${t.donor} ${t.streamer}`.toLowerCase().includes(q.toLowerCase()))), [q, status, method]);

  return (
    <>
      <Topbar title="Transações">
        <span className="mono muted hide-m" style={{ fontSize: 12 }}>Atualizado 21:06 · hora de Luanda</span>
        <button className="btn" onClick={() => toast.show("Exportação CSV pedida")}>Exportar CSV</button>
      </Topbar>
      <div className="page" style={{ gap: 0, padding: 0 }}>
        <div className="row" style={{ gap: 8, flexWrap: "wrap", padding: "16px 24px", background: "var(--branco)", borderBottom: "1px solid var(--linha)" }}>
          <input className="chip" style={{ minWidth: 250, outline: 0 }} placeholder="Procurar ID, telemóvel ou streamer" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Procurar" />
          <select className="chip" value={status} onChange={(e) => setStatus(e.target.value as TxStatus | "todos")} aria-label="Estado">
            <option value="todos">Estado: todos</option>
            {Object.entries(TX_TAG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select className="chip" value={method} onChange={(e) => setMethod(e.target.value as typeof method)} aria-label="Método">
            <option value="todos">Método: todos</option><option>Multicaixa Express</option><option>Referência</option>
          </select>
          <select className="chip" value={view} onChange={(e) => setView(e.target.value as typeof view)} aria-label="Simular estado da tabela">
            <option value="dados">Ver: dados</option><option value="carregar">Ver: a carregar</option><option value="erro">Ver: erro</option>
          </select>
          <button className="link" style={{ marginLeft: "auto" }} onClick={() => { setQ(""); setStatus("todos"); setMethod("todos"); }}>Limpar filtros</button>
        </div>
        <div className="grid g4" style={{ gap: 0, background: "var(--branco)", borderBottom: "1px solid var(--linha)" }}>
          {[["Volume hoje", kz(1284500)], ["Receita (10%)", kz(128450)], ["Mensagens emitidas", "598"], ["Falhas técnicas", `3 · ${kz(14500)}`]].map(([l, v], i) => (
            <div key={l} className="stat" style={{ padding: "16px 24px", borderLeft: i ? "1px solid var(--linha)" : undefined }}>
              <div className="eyebrow">{l}</div><div className="big" style={{ fontSize: 21, marginTop: 6 }}>{v}</div>
            </div>
          ))}
        </div>
        <div className="table-wrap" style={{ background: "var(--branco)", flex: 1 }}>
          {view === "carregar" ? (
            <div className="stack" style={{ gap: 14, padding: 24 }}>{Array.from({ length: 6 }, (_, i) => <div key={i} className="skel" style={{ height: 18 }} />)}</div>
          ) : view === "erro" ? (
            <div className="vazio"><span className="tag erro">Erro</span><b style={{ color: "var(--tinta)" }}>Não foi possível carregar as transações</b><button className="btn" onClick={() => setView("dados")}>Tentar de novo</button></div>
          ) : rows.length === 0 ? (
            <Empty title="Nenhuma transação com estes filtros">Muda o período ou limpa os filtros.</Empty>
          ) : (
            <table className="table">
              <thead><tr><th>ID</th><th>Data</th><th>Doador</th><th>Streamer</th><th>Método</th><th className="num">Valor</th><th className="num">Estado</th><th /></tr></thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.id} onClick={() => setDetail(t)} style={{ cursor: "pointer" }}>
                    <td className="id">{t.id}</td>
                    <td className="mono muted" style={{ fontSize: 12.5 }}>{t.at}</td>
                    <td className="mono" style={{ fontSize: 12.5 }}>{maskPhone(t.donor)}</td>
                    <td>{t.streamer}</td>
                    <td>{t.method}</td>
                    <td className="num kz">{kz(t.kz)}</td>
                    <td className="num"><Tag tone={TX_TAG[t.status].tone}>{TX_TAG[t.status].label}</Tag></td>
                    <td>{t.status === "falha" && <a href="/admin/falhas" onClick={(e) => e.stopPropagation()}>Reembolsar</a>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="row between" style={{ padding: "14px 24px", fontSize: 13 }}>
          <span className="mono muted">1–{rows.length} de 612</span>
          <div className="row" style={{ gap: 6 }}>{["‹", "1", "2", "3", "…", "77", "›"].map((p, i) => <button key={i} className={cx("chip", p === "1" && "on")} style={{ height: 32, minWidth: 32, justifyContent: "center", padding: 0 }}>{p}</button>)}</div>
        </div>
      </div>
      {detail && (
        <Modal title={detail.id} onClose={() => setDetail(null)}>
          <div className="lines" style={{ fontSize: 14 }}>
            <div className="row between"><span className="muted">Estado</span><Tag tone={TX_TAG[detail.status].tone}>{TX_TAG[detail.status].label}</Tag></div>
            <div className="row between"><span className="muted">Streamer</span><span>{detail.streamer}</span></div>
            <div className="row between"><span className="muted">Método</span><span>{detail.method}</span></div>
            <div className="row between"><span className="muted">Valor</span><span className="kz">{kz(detail.kz)}</span></div>
          </div>
          <div className="eyebrow" style={{ marginTop: 14 }}>Payload do gateway</div>
          <pre className="mono" style={{ background: "var(--papel)", padding: 12, borderRadius: 8, fontSize: 12, overflow: "auto" }}>{JSON.stringify({ reference: detail.id, amount: detail.kz * 100, currency: "AOA", status: detail.status === "aguarda" ? "PENDING" : "ACCEPTED", channel: detail.method === "Referência" ? "REF" : "MCX" }, null, 2)}</pre>
          <div className="row" style={{ gap: 10, marginTop: 14 }}>
            <button className="btn grow" onClick={() => { setDetail(null); toast.show("Marcada como disputa"); }}>Marcar disputa</button>
            <button className="btn dark grow" onClick={() => setDetail(null)}>Fechar</button>
          </div>
        </Modal>
      )}
      {toast.node}
    </>
  );
}
