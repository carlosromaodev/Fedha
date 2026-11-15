import { Link } from "react-router-dom";
import { Topbar } from "../../../layouts";
import { Stat, Tag } from "../../../shared/ui";
import { last14 } from "../../../shared/mocks/data";
import { kz } from "../../../shared/lib/format";

/** B1 — Visão geral da plataforma. */
export default function Overview() {
  const max = Math.max(...last14.flat());
  return (
    <>
      <Topbar title="Visão geral" />
      <div className="page">
        <div className="grid g4">
          <Stat label="GMV hoje" value={1284500} sub="598 mensagens" />
          <Stat label="Receita (10%)" value={128450} sub="+8% que ontem" tone="verde" />
          <Stat label="Streamers ativos" value="214" sub="38 em direto agora" />
          <Stat label="Sucesso de pagamento" value="94,2%" sub="MCX 96,1% · Ref. 88,4%" />
        </div>
        <div className="split">
          <div className="card pad-l">
            <h2>Mensagens por dia</h2>
            <div className="bars14" style={{ marginTop: 20 }}>
              {last14.map((d, i) => <div key={i} className={i === 13 ? "today" : ""}><div className="trio"><i style={{ height: `${(d[0]! / max) * 100}%` }} /></div><small>{String(i + 1).padStart(2, "0")}</small></div>)}
            </div>
          </div>
          <div className="card pad-l">
            <h2>Precisa de atenção</h2>
            <div className="lines" style={{ marginTop: 8, fontSize: 14 }}>
              <Link to="/admin/falhas" className="row between" style={{ color: "inherit", textDecoration: "none" }}><span>Falhas técnicas por reembolsar</span><Tag tone="erro">3 · {kz(14500)}</Tag></Link>
              <Link to="/admin/levantamentos" className="row between" style={{ color: "inherit", textDecoration: "none" }}><span>Levantamentos pendentes</span><Tag tone="pend">4 · {kz(590500)}</Tag></Link>
              <Link to="/admin/verificacoes" className="row between" style={{ color: "inherit", textDecoration: "none" }}><span>Verificações por analisar</span><Tag tone="pend">3</Tag></Link>
              <Link to="/admin/antifraude" className="row between" style={{ color: "inherit", textDecoration: "none" }}><span>Alertas de fraude</span><Tag tone="erro">2</Tag></Link>
              <Link to="/admin/reconciliacao" className="row between" style={{ color: "inherit", textDecoration: "none" }}><span>Diferenças na reconciliação</span><Tag>1</Tag></Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
