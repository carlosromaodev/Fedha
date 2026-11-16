import { copy, useToast, Copy } from "../../../shared/ui";
import { kz } from "../../../shared/lib/format";
import { useDraft } from "../../../features/composer/store";

/** P3 — Referência Multicaixa (mockup A6). Prazo predefinido de 60 min. */
export default function Reference() {
  const { draft } = useDraft();
  const toast = useToast();
  const until = new Date(Date.now() + 60 * 60 * 1000);
  const rows = [
    { label: "Entidade", value: "01055" },
    { label: "Referência", value: "923 481 207" },
    { label: "Valor", value: `${kz(draft.total || 2500, false)},00 Kz` },
  ];
  return (
    <div className="pub">
      <main className="pub-main">
        <span className="eyebrow">Passo 3 de 3</span>
        <h1>Paga no ATM ou no homebanking</h1>
        <p className="muted">Escolhe "Pagamentos → Pagamento por referência".</p>
        {rows.map((r) => (
          <div key={r.label} className="ref-talao">
            <div><div className="eyebrow">{r.label}</div><div className="val">{r.value}</div></div>
            <button onClick={() => { copy(r.value.replace(/\s/g, "")); toast.show(`${r.label} copiada`); }}><Copy size={16} aria-hidden /><br />Copiar</button>
          </div>
        ))}
        <div className="row between">
          <span className="muted">Válida até</span>
          <span className="mono" style={{ fontSize: 13 }}>
            {until.toLocaleDateString("pt-PT")} · {until.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
        <div className="card row" style={{ gap: 12, padding: 16 }} aria-live="polite">
          <span style={{ width: 18, height: 18, border: "2px solid var(--verde)", borderTopColor: "transparent", borderRadius: "50%", animation: "fl-spin 1s linear infinite", flex: "none" }} />
          <span className="muted">A aguardar o pagamento. Esta página atualiza sozinha.</span>
        </div>
        <p className="muted" style={{ fontSize: 13 }}>Se não pagares até ao fim do prazo, a referência expira e nada é cobrado.</p>
      </main>
      {toast.node}
    </div>
  );
}
