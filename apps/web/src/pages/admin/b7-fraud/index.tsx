import { Topbar } from "../../../layouts";
import { Tag } from "../../../shared/ui";
import { kz } from "../../../shared/lib/format";

/** B7 — Antifraude e compliance: regras, limites, alertas e relatórios UIF. */
export default function Fraud() {
  const alerts = [
    { t: "Autodoação provável", d: "Mano Zé TV recebeu 6 mensagens do número associado à conta", sev: "erro" as const },
    { t: "Muitos pagamentos do mesmo número", d: "+244 92• ••• 881 · 14 pagamentos em 30 min", sev: "pend" as const },
  ];
  const limits = [
    ["Sem verificação · recebido por mês", kz(150000)],
    ["Verificado · levantamento por dia", kz(1000000)],
    ["Mensagem única · valor máximo", kz(50000)],
    ["Pagamentos por número · por hora", "10"],
  ];
  return (
    <>
      <Topbar title="Antifraude" />
      <div className="page">
        <div className="split" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)" }}>
          <div className="card pad-l">
            <h2>Alertas abertos</h2>
            <div className="lines" style={{ marginTop: 8 }}>
              {alerts.map((a) => <div key={a.t} className="stack" style={{ gap: 4 }}><div className="row between"><b style={{ fontWeight: 500 }}>{a.t}</b><Tag tone={a.sev}>{a.sev === "erro" ? "Alta" : "Média"}</Tag></div><span className="muted" style={{ fontSize: 13 }}>{a.d}</span></div>)}
            </div>
          </div>
          <div className="card pad-l">
            <h2>Limites</h2>
            <div className="lines mono" style={{ marginTop: 8, fontSize: 13 }}>
              {limits.map(([k, v]) => <div key={k} className="row between"><span style={{ fontFamily: "var(--font)" }}>{k}</span><span>{v}</span></div>)}
            </div>
            <button className="btn" style={{ marginTop: 12 }}>Gerar relatório para a UIF</button>
          </div>
        </div>
      </div>
    </>
  );
}
