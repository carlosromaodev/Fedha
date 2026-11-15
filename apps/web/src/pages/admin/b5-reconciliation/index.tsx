import { useState } from "react";
import { Topbar } from "../../../layouts";
import { Stat, Tag, useToast } from "../../../shared/ui";
import { kz } from "../../../shared/lib/format";

const DIFFS = [
  { id: "GW-55102", type: "Pago no gateway sem pedido", kz: 2500, at: "14/11 20:12" },
  { id: "FL-7B01-9C2A", type: "Valor diferente (gateway 1.000 · pedido 1.500)", kz: 500, at: "14/11 17:48" },
];

/** B5 — Reconciliação diária: extrato do gateway × pedidos × ledger (fluxo F7). */
export default function Reconciliation() {
  const [diffs, setDiffs] = useState(DIFFS);
  const toast = useToast();
  return (
    <>
      <Topbar title="Reconciliação"><button className="btn" onClick={() => toast.show("Extrato de hoje pedido ao gateway")}>Obter extrato</button></Topbar>
      <div className="page">
        <div className="grid g3">
          <Stat label="Execução de 14/11" value="06:00" sub="Automática · EMIS / ProxyPay" />
          <Stat label="Transações cruzadas" value="612" sub="610 iguais" />
          <Stat label="Diferenças abertas" value={String(diffs.length)} sub={kz(diffs.reduce((s, d) => s + d.kz, 0))} />
        </div>
        <div className="card table-wrap" style={{ padding: 0 }}>
          <table className="table">
            <thead><tr><th>Referência</th><th>Data</th><th>Diferença</th><th className="num">Valor</th><th /></tr></thead>
            <tbody>
              {diffs.map((d) => (
                <tr key={d.id}>
                  <td className="id">{d.id}</td><td className="mono muted" style={{ fontSize: 12.5 }}>{d.at}</td><td><Tag tone="pend">{d.type}</Tag></td>
                  <td className="num kz">{kz(d.kz)}</td>
                  <td className="num"><button className="btn sm" onClick={() => { setDiffs(diffs.filter((x) => x !== d)); toast.show("Diferença resolvida e registada"); }}>Resolver</button></td>
                </tr>
              ))}
              {diffs.length === 0 && <tr><td colSpan={5} className="muted">Tudo reconciliado.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      {toast.node}
    </>
  );
}
