import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Field, LiveBadge, Logo, RouteButton, Tag, Pencil, ArrowLeft, Empty, Receipt } from "../../../shared/ui";
import { streamer } from "../../../shared/mocks/data";
import { kz, phone } from "../../../shared/lib/format";
import { useDraft, type PayMethod } from "../../../features/composer/store";

/** P3 — Checkout com aceitação obrigatória (mockup A4). */
export default function Checkout() {
  const nav = useNavigate();
  const { draft, update } = useDraft();
  const [method, setMethod] = useState<PayMethod>(draft.method);
  const [tel, setTel] = useState(draft.phone);
  const [accepted, setAccepted] = useState(false);
  const [touched, setTouched] = useState(false);
  const digits = tel.replace(/\D/g, "").replace(/^244/, "");
  const telOk = /^9\d{8}$/.test(digits);
  const telError = touched && method === "mcx" && !telOk ? "Número Multicaixa Express inválido. Usa 9 dígitos, a começar por 9." : null;

  if (!draft.total) {
    return (
      <div className="pub"><main className="pub-main" style={{ justifyContent: "center" }}>
        <Empty title="Não há nenhuma mensagem por pagar" icon={Receipt}>
          Escreve a tua mensagem na página de {streamer.name}. O valor aparece aqui antes de pagares.
        </Empty>
        <Link to={`/${streamer.handle}`} className="btn dark block"><Pencil aria-hidden />Escrever mensagem</Link>
      </main></div>
    );
  }

  const pay = () => {
    setTouched(true);
    if (!accepted || (method === "mcx" && !telOk)) return;
    update({ method, phone: digits });
    nav(method === "mcx" ? `/${streamer.handle}/pagar/express` : `/${streamer.handle}/pagar/referencia`);
  };

  return (
    <div className="pub ck">
      <header className="ck-head d-only">
        <Logo />
        <span className="row" style={{ gap: 10, fontSize: 14 }}>
          <span className="avatar" style={{ width: 28, height: 28, background: "var(--verde)", color: "var(--branco)", fontSize: 10 }}>KG</span>
          <span className="hide-m">A enviar para <b>{streamer.name}</b></span>
          <LiveBadge />
        </span>
      </header>
      <main className="pub-main ck-main">
        <div className="ck-left stack" style={{ gap: 14 }}>
        <div className="pub-top">
          <Link to={`/${streamer.handle}`} className="link" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}><ArrowLeft size={16} aria-hidden />Editar</Link>
          <span className="eyebrow">Passo 2 de 3</span>
        </div>
        <h1>Pagamento</h1>

        <div className="ck-talao">
          <div className="corpo">
            <div className="eyebrow" style={{ color: "rgba(255,255,255,.8)" }}>De {draft.name} · para {streamer.name}</div>
            <p style={{ marginTop: 8, lineHeight: 1.4 }}>
              {draft.kind === "text" ? `"${draft.text}"` : `Mensagem de voz · até ${draft.audioTier} s`}
            </p>
          </div>
          <div className="canhoto">
            <span className="eyebrow" style={{ color: "rgba(255,255,255,.8)" }}>Total</span>
            <span className="kz" style={{ fontSize: 26 }}>{kz(draft.total, false)}</span>
            <span className="eyebrow" style={{ color: "rgba(255,255,255,.8)" }}>Kz</span>
          </div>
        </div>

        <div className="card stack" style={{ gap: 8, padding: 16 }}>
          {draft.lines.map((l) => (
            <div key={l.label} className="row between mono" style={{ fontSize: 13 }}>
              <span className="muted">{l.label}</span><span>{kz(l.kz)}</span>
            </div>
          ))}
          <div className="row between mono" style={{ fontSize: 14, borderTop: "1px dashed var(--linha-forte)", paddingTop: 8 }}><span>Total</span><span>{kz(draft.total)}</span></div>
        </div>
        </div>
        <div className="ck-right stack" style={{ gap: 12 }}>
        <span className="eyebrow">Método de pagamento</span>

        <div role="radiogroup" aria-label="Método de pagamento" className="stack" style={{ gap: 10 }}>
          <div className={method === "mcx" ? "opcao on" : "opcao"} role="radio" aria-checked={method === "mcx"} tabIndex={0}
            onClick={() => setMethod("mcx")} onKeyDown={(e) => e.key === " " && setMethod("mcx")} style={{ flexDirection: "column", alignItems: "stretch" }}>
            <div className="row" style={{ gap: 14 }}>
              <span className="radio" /><b className="grow">Multicaixa Express</b><span className="eyebrow">Aprovas na app</span>
            </div>
            {method === "mcx" && (
              <div onClick={(e) => e.stopPropagation()}>
                <Field label="Número de telemóvel" error={telError}>
                  <input className="mono-in" inputMode="tel" autoComplete="tel" value={tel ? phone(tel) : ""} placeholder="+244 9__ ___ ___"
                    onChange={(e) => setTel(e.target.value)} />
                </Field>
              </div>
            )}
          </div>
          <div className={method === "referencia" ? "opcao on" : "opcao"} role="radio" aria-checked={method === "referencia"} tabIndex={0}
            onClick={() => setMethod("referencia")} onKeyDown={(e) => e.key === " " && setMethod("referencia")}>
            <span className="radio" /><b className="grow">Referência Multicaixa</b><span className="eyebrow">ATM · Homebanking</span>
          </div>
          <div className="opcao disabled" aria-disabled>
            <span className="grow">Unitel Money · Afrimoney · Cartão</span><Tag>Em breve</Tag>
          </div>
        </div>
      <div className="pub-foot ck-pay">
        <label className="row" style={{ gap: 12, alignItems: "flex-start", fontSize: 13.5, lineHeight: 1.45 }}>
          <input type="checkbox" className="selo" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
          <span>
            Aceito que a mensagem é emitida automaticamente na live após o pagamento e não pode ser cancelada.{" "}
            <a href="#regras" onClick={(e) => e.preventDefault()}>Regras de conteúdo</a>
          </span>
        </label>
        {touched && !accepted && <p className="hint erro" role="alert">Tens de aceitar para continuar.</p>}
        <RouteButton value={draft.total} disabled={!accepted} onClick={pay}>Pagar</RouteButton>
      </div>
        </div>
      </main>
    </div>
  );
}
