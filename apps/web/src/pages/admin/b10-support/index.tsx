import { Topbar } from "../../../layouts";
import { Tag } from "../../../shared/ui";

/** B10 — Suporte: tickets com estado, prioridade e atribuição. */
export default function SupportDesk() {
  const tickets = [
    { id: "T-1042", from: "Kiami Gamer", subject: "Levantamento atrasado", prio: "Alta", who: "Marta S.", status: "Em análise" },
    { id: "T-1041", from: "Doador · +244 93• ••• 512", subject: "Mensagem não tocou", prio: "Média", who: "—", status: "Novo" },
    { id: "T-1039", from: "Luana Plays", subject: "Overlay não aparece no LIVE Studio", prio: "Média", who: "João P.", status: "À espera do cliente" },
  ];
  return (
    <>
      <Topbar title="Suporte" />
      <div className="page">
        <div className="card table-wrap" style={{ padding: 0 }}>
          <table className="table">
            <thead><tr><th>ID</th><th>De</th><th>Assunto</th><th>Prioridade</th><th>Atribuído</th><th>Estado</th></tr></thead>
            <tbody>{tickets.map((t) => (
              <tr key={t.id}><td className="id">{t.id}</td><td>{t.from}</td><td>{t.subject}</td><td><Tag tone={t.prio === "Alta" ? "erro" : "pend"}>{t.prio}</Tag></td><td>{t.who}</td><td><Tag>{t.status}</Tag></td></tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    </>
  );
}
