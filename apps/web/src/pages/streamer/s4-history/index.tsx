import { useMemo, useState } from "react";
import { Topbar } from "../../../layouts";
import { Empty, Tag, useToast } from "../../../shared/ui";
import { queue } from "../../../shared/mocks/data";
import { cx, kz } from "../../../shared/lib/format";

const ALL = [...queue, ...queue.map((q, i) => ({ ...q, id: q.id + "-b" + i, at: "13/11 " + q.at, status: "tocada" as const }))];

/** S4 — Histórico de mensagens (mockup E3). */
export default function History() {
  const [q, setQ] = useState("");
  const [type, setType] = useState<"todas" | "text" | "audio">("todas");
  const toast = useToast();
  const rows = useMemo(() => ALL.filter((m) =>
    (type === "todas" || m.kind === type) &&
    (!q || `${m.donor} ${m.text} ${m.id}`.toLowerCase().includes(q.toLowerCase()))), [q, type]);

  const exportCsv = () => {
    const csv = ["id;hora;doador;tipo;texto;valor", ...rows.map((r) => [r.id, r.at, r.donor, r.kind, `"${r.text}"`, r.kz].join(";"))].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "fedha-historico.csv";
    a.click();
    toast.show("CSV exportado");
  };

  return (
    <>
      <Topbar title="Histórico"><button className="btn" onClick={exportCsv}>Exportar CSV</button></Topbar>
      <div className="page">
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <input className="chip" style={{ minWidth: 260, outline: 0 }} placeholder="Procurar doador, texto ou ID" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Procurar" />
          {(["todas", "text", "audio"] as const).map((t) => (
            <button key={t} className={cx("chip", type === t && "on")} onClick={() => setType(t)}>{t === "todas" ? "Todas" : t === "text" ? "Texto" : "Áudio"}</button>
          ))}
          <button className="chip">Período: 7 dias ▾</button>
        </div>
        <div className="card table-wrap" style={{ padding: 0 }}>
          {rows.length === 0 ? <Empty title="Sem resultados">Muda a pesquisa ou os filtros.</Empty> : (
            <table className="table">
              <thead><tr><th>ID</th><th>Hora</th><th>Doador</th><th>Mensagem</th><th className="num">Valor</th><th className="num">Estado</th></tr></thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m.id}>
                    <td className="id">{m.id.slice(0, 12)}</td>
                    <td className="mono muted" style={{ fontSize: 12.5 }}>{m.at}</td>
                    <td><b style={{ fontWeight: 500 }}>{m.donor}</b></td>
                    <td className="muted" style={{ maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.kind === "audio" ? `Mensagem de voz · ${m.seconds} s` : m.text}</td>
                    <td className="num kz">{kz(m.kz)}</td>
                    <td className="num">{m.status === "tocada" ? <Tag tone="ok">Tocada</Tag> : m.status === "a_tocar" ? <Tag tone="dark">A tocar</Tag> : <Tag>Na fila</Tag>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <p className="hint">Se uma mensagem não tocou por falha técnica, o reembolso ao doador é automático. Para outro problema, abre um pedido em Ajuda.</p>
      </div>
      {toast.node}
    </>
  );
}
