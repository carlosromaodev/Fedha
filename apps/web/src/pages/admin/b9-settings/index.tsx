import { Topbar } from "../../../layouts";
import { Field, RouteButton } from "../../../shared/ui";

/** B9 — Configurações da plataforma. */
export default function PlatformSettings() {
  return (
    <>
      <Topbar title="Configurações" />
      <div className="page" style={{ maxWidth: 820 }}>
        <div className="card pad-l stack" style={{ gap: 12 }}>
          <h2>Taxas e prazos</h2>
          <div className="grid g2">
            <Field label="Taxa da plataforma (%)"><input className="mono-in" defaultValue="10" /></Field>
            <Field label="Retenção (horas)"><input className="mono-in" defaultValue="48" /></Field>
            <Field label="Taxa de levantamento (Kz)"><input className="mono-in" defaultValue="300" /></Field>
            <Field label="Levantamento mínimo (Kz)"><input className="mono-in" defaultValue="5.000" /></Field>
            <Field label="Prazo da Referência (min)"><input className="mono-in" defaultValue="60" /></Field>
            <Field label="Reembolso se não tocar em (dias)"><input className="mono-in" defaultValue="7" /></Field>
          </div>
        </div>
        <div className="card pad-l stack" style={{ gap: 4 }}>
          <h2>Métodos de pagamento</h2>
          <div className="lines" style={{ fontSize: 14 }}>
            {[["Multicaixa Express", true], ["Referência Multicaixa", true], ["Unitel Money", false], ["Afrimoney", false], ["Cartão Visa/Mastercard (fase 2)", false]].map(([n, on]) => (
              <label key={n as string} className="row between">{n}<input type="checkbox" className="toggle" defaultChecked={on as boolean} /></label>
            ))}
          </div>
        </div>
        <div style={{ width: 200, alignSelf: "flex-end" }}><RouteButton size="sm">Guardar</RouteButton></div>
      </div>
    </>
  );
}
