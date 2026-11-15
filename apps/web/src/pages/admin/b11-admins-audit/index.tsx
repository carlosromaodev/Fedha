import { Topbar } from "../../../layouts";
import { Tag } from "../../../shared/ui";

/** B11 — Administradores, papéis e auditoria. */
export default function AdminsAudit() {
  const admins = [["Marta Sebastião", "Finanças"], ["João Pedro", "Operações"], ["Ana Mavinga", "Compliance"], ["Carlos Romão", "Super Admin"]];
  const log = [
    ["21:06", "Marta S.", "Reembolso FL-7C10-9AE4 · 10.000 Kz"],
    ["20:40", "Ana M.", "Aprovou verificação de Luana Plays"],
    ["19:12", "João P.", "Respondeu ao ticket T-1039"],
    ["18:02", "Carlos R.", "Alterou taxa de levantamento: 250 → 300 Kz"],
  ];
  return (
    <>
      <Topbar title="Papéis e auditoria" />
      <div className="page">
        <div className="split" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,1.3fr)" }}>
          <div className="card pad-l">
            <h2>Administradores</h2>
            <div className="lines" style={{ marginTop: 8, fontSize: 14 }}>{admins.map(([n, r]) => <div key={n} className="row between"><span>{n}</span><Tag tone={r === "Super Admin" ? "dark" : undefined}>{r}</Tag></div>)}</div>
          </div>
          <div className="card pad-l">
            <h2>Registo de auditoria</h2>
            <div className="lines" style={{ marginTop: 8, fontSize: 14 }}>{log.map(([t, w, a]) => <div key={t + a} className="row" style={{ gap: 14 }}><span className="mono muted" style={{ fontSize: 12 }}>{t}</span><b style={{ fontWeight: 500, minWidth: 80 }}>{w}</b><span className="muted">{a}</span></div>)}</div>
          </div>
        </div>
      </div>
    </>
  );
}
