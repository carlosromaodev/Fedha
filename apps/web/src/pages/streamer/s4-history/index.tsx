import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Topbar } from "../../../layouts";
import { Empty, Tag, useToast, Download, MoreHorizontal, ChevronDown, ChevronLeft, ChevronRight } from "../../../shared/ui";
import { cx, kz } from "../../../shared/lib/format";

type Row = { at: string; donor: string; type: string; text: string; extras: string; kz: number; status: "emitida" | "reembolsada"; platform: string };

const ROWS: Row[] = [
  { at: "14/11 21:04", donor: "Luana", type: "Texto", text: "Kiami, manda salve pra malta do Lobito!", extras: "", kz: 500, status: "emitida", platform: "TikTok" },
  { at: "14/11 21:03", donor: "Paulo K.", type: "Áudio 10 s", text: "Mensagem de voz · 00:09", extras: "", kz: 5000, status: "emitida", platform: "TikTok" },
  { at: "14/11 21:01", donor: "Anónimo", type: "Texto", text: "Quando é que vais jogar com a malta de Benguela?", extras: "", kz: 500, status: "emitida", platform: "TikTok" },
  { at: "14/11 20:51", donor: "DJ Nelo", type: "Texto", text: "Ya mano, essa jogada foi mesmo à Kuduro 😂", extras: "Prioridade · Voz premium", kz: 2500, status: "emitida", platform: "TikTok" },
  { at: "14/11 20:40", donor: "Mauro A.", type: "Áudio 30 s", text: "Mensagem de voz · 00:27", extras: "", kz: 10000, status: "emitida", platform: "YouTube" },
  { at: "14/11 20:12", donor: "Anónimo", type: "Áudio 10 s", text: "Mensagem de voz · 00:08", extras: "", kz: 0, status: "reembolsada", platform: "TikTok" },
  { at: "12/11 22:30", donor: "Joana M.", type: "Texto", text: "Aquele clutch no fim foi brabo, mereces mais subs! 💪", extras: "Efeito · Aplausos", kz: 1500, status: "emitida", platform: "YouTube" },
  { at: "12/11 21:58", donor: "Edvaldo", type: "Áudio 20 s", text: "Mensagem de voz · 00:18", extras: "", kz: 8000, status: "emitida", platform: "TikTok" },
  { at: "12/11 21:40", donor: "Luana", type: "Texto", text: "Bora Kiami, hoje é dia de vitória!", extras: "", kz: 500, status: "emitida", platform: "TikTok" },
];
const PAGE = 8;

/** S4 — Histórico (26): todas as mensagens com filtros e paginação. Reembolsadas mostram 0 Kz. */
export default function History() {
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [type, setType] = useState("todos");
  const [platform, setPlatform] = useState("todas");
  const [status, setStatus] = useState("todos");
  const [page, setPage] = useState(1);
  const [menu, setMenu] = useState<number | null>(null);
  const toast = useToast();

  const rows = useMemo(() => ROWS.filter((r) =>
    (type === "todos" || (type === "texto" ? r.type === "Texto" : r.type.startsWith("Áudio"))) &&
    (platform === "todas" || r.platform === platform) &&
    (status === "todos" || r.status === status) &&
    (!q || `${r.donor} ${r.text}`.toLowerCase().includes(q.toLowerCase()))), [q, type, platform, status]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const view = rows.slice((page - 1) * PAGE, page * PAGE);

  const exportCsv = () => {
    const csv = ["data;remetente;tipo;mensagem;extras;valor;estado", ...rows.map((r) => [r.at, r.donor, r.type, `"${r.text}"`, r.extras, r.kz, r.status].join(";"))].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "fedha-historico.csv";
    a.click();
    toast.show("CSV exportado");
  };
  const clear = () => { setQ(""); setType("todos"); setPlatform("todas"); setStatus("todos"); setPage(1); };

  return (
    <>
      <Topbar title="Histórico" sub={`214 mensagens em novembro · ${kz(412650)} líquido`}>
        <button className="btn" onClick={exportCsv}><Download aria-hidden />Exportar CSV</button>
      </Topbar>
      <div className="page">
        <div className="filters">
          <input className="chip search" placeholder="Procurar remetente ou mensagem" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} aria-label="Procurar" />
          <button className="chip on">Novembro 2026 <i className="caret" /></button>
          <label className="chip sel">Tipo: <select value={type} onChange={(e) => setType(e.target.value)}><option value="todos">todos</option><option value="texto">texto</option><option value="audio">áudio</option></select></label>
          <label className="chip sel">Plataforma: <select value={platform} onChange={(e) => setPlatform(e.target.value)}><option value="todas">todas</option><option>TikTok</option><option>YouTube</option></select></label>
          <label className="chip sel">Estado: <select value={status} onChange={(e) => setStatus(e.target.value)}><option value="todos">todos</option><option value="emitida">emitida</option><option value="reembolsada">reembolsada</option></select></label>
          <button className="link push" onClick={clear}>Limpar filtros</button>
        </div>
        <div className="card table-wrap" style={{ padding: "4px 20px" }}>
          {view.length === 0 ? <Empty title="Sem mensagens com estes filtros">Muda o período ou limpa os filtros.</Empty> : (
            <table className="table">
              <thead><tr><th>Data</th><th>Remetente</th><th>Tipo</th><th>Mensagem</th><th>Extras</th><th className="num">Valor</th><th className="num">Estado</th><th /></tr></thead>
              <tbody>
                {view.map((r, i) => (
                  <tr key={r.at + r.donor}>
                    <td className="mono muted" style={{ fontSize: 12.5, whiteSpace: "nowrap" }}>{r.at}</td>
                    <td><b style={{ fontWeight: 600 }}>{r.donor}</b></td>
                    <td style={{ whiteSpace: "nowrap" }}>{r.type}</td>
                    <td className="ellipsis" style={{ maxWidth: 230 }}>{r.text}</td>
                    <td className="eyebrow" style={{ whiteSpace: "nowrap" }}>{r.extras || "–"}</td>
                    <td className="num kz">{kz(r.kz)}</td>
                    <td className="num">{r.status === "emitida" ? <Tag tone="ok">Emitida</Tag> : <Tag tone="erro">Reembolsada</Tag>}</td>
                    <td style={{ position: "relative", width: 28 }}>
                      <button className="icon-btn" aria-label="Mais ações" onClick={() => setMenu(menu === i ? null : i)}><MoreHorizontal size={18} /></button>
                      {menu === i && (
                        <div className="dropdown" role="menu" style={{ top: 34, right: 0 }}>
                          <button onClick={() => { setMenu(null); toast.show("Pedido de suporte aberto com esta mensagem"); }}>Pedir ajuda ao suporte</button>
                          <button onClick={() => { setMenu(null); toast.show("Remetente bloqueado"); }} className="danger">Bloquear remetente</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="pager">
            <span className="mono muted">{rows.length ? `${(page - 1) * PAGE + 1}–${Math.min(page * PAGE, rows.length)}` : 0} de 214</span>
            <div className="row" style={{ gap: 6 }}>
              <button className="chip pg" disabled={page === 1} onClick={() => setPage(page - 1)} aria-label="Anterior"><ChevronLeft size={16} /></button>
              {[1, 2, 3].map((n) => <button key={n} className={cx("chip pg", page === n && "on")} disabled={n > pages} onClick={() => setPage(n)}>{n}</button>)}
              <button className="chip pg" disabled>…</button>
              <button className="chip pg" disabled>24</button>
              <button className="chip pg" disabled={page >= pages} onClick={() => setPage(page + 1)} aria-label="Seguinte"><ChevronRight size={16} /></button>
            </div>
            <span className="muted" style={{ fontSize: 13 }}>8 por página <ChevronDown size={14} /></span>
          </div>
        </div>
      </div>
      {toast.node}
    </>
  );
}
