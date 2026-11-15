import { useState } from "react";
import { Link } from "react-router-dom";
import { Field, Logo, RouteButton, Tag } from "../../../shared/ui";
import { phone } from "../../../shared/lib/format";

/** P5 — Consulta de pedido por número e telemóvel. */
export default function OrderLookup() {
  const [id, setId] = useState("");
  const [tel, setTel] = useState("");
  const [result, setResult] = useState<null | "found" | "missing">(null);
  const idOk = /^FL-[0-9A-F]{4}-[0-9A-F]{4}$/i.test(id.trim());
  const telOk = /^9\d{8}$/.test(tel.replace(/\D/g, "").replace(/^244/, ""));

  return (
    <div className="pub">
      <header className="sp-head"><Logo /></header>
      <main className="pub-main">
        <h1>Consultar pedido</h1>
        <p className="muted">Usa o número do recibo e o telemóvel com que pagaste.</p>
        <Field label="Número do pedido" error={id && !idOk ? "Formato: FL-XXXX-XXXX" : null}>
          <input className="mono-in" value={id} placeholder="FL-8F3A-22C1" onChange={(e) => setId(e.target.value.toUpperCase())} />
        </Field>
        <Field label="Telemóvel">
          <input className="mono-in" inputMode="tel" value={tel ? phone(tel) : ""} placeholder="+244 9__ ___ ___" onChange={(e) => setTel(e.target.value)} />
        </Field>
        <RouteButton disabled={!idOk || !telOk} onClick={() => setResult(id.endsWith("22C1") ? "found" : "missing")}>Consultar</RouteButton>
        {result === "found" && (
          <div className="card stack" style={{ gap: 10 }}>
            <div className="row between"><b>Kiami Gamer</b><Tag tone="ok">Tocada</Tag></div>
            <p className="muted">"Bora Kiami! Esse clutch foi brabo demais…"</p>
            <div className="row between mono" style={{ fontSize: 13 }}><span>2.500 Kz</span><span>14/11/2026 21:06</span></div>
            <Link className="link" to={`/r/${id}`}>Ver recibo</Link>
          </div>
        )}
        {result === "missing" && <div className="aviso erro">Não encontrámos nenhum pedido com estes dados. Confirma o número no recibo.</div>}
        <p className="muted" style={{ fontSize: 13, lineHeight: 1.5 }}>
          Se a mensagem não tocar por falha técnica, o valor é devolvido automaticamente ao número que pagou.
        </p>
      </main>
    </div>
  );
}
