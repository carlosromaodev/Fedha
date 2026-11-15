import { useState } from "react";
import { Topbar } from "../../../layouts";
import { Field, RouteButton, useToast } from "../../../shared/ui";
import { blockedSenders, blockedWords, pricing } from "../../../shared/mocks/data";
import { kz, maskPhone } from "../../../shared/lib/format";

type Row = { key: string; label: string; group: "text" | "audio" | "extra"; value: number };
const DEFAULT: Row[] = [
  ...pricing.text.map((t) => ({ key: `t${t.max}`, label: `${t.min}–${t.max}${t.min === 1 ? " caracteres" : ""}`, group: "text" as const, value: t.kz })),
  ...pricing.audio.map((a) => ({ key: `a${a.seconds}`, label: `Até ${a.seconds} s`, group: "audio" as const, value: a.kz })),
  { key: "voz", label: "Voz premium", group: "extra", value: pricing.extras.premiumVoice },
  { key: "efeito", label: "Efeito sonoro", group: "extra", value: pricing.extras.effect },
  { key: "prio", label: "Prioridade na fila", group: "extra", value: pricing.extras.priority },
];

/** S5 + S9 — Preços e filtros (10): valores por escalão e filtros antes de pagar, com validação por campo. */
export default function PricingAndFilters() {
  const toast = useToast();
  const [rows, setRows] = useState(DEFAULT);
  const [saved, setSaved] = useState(DEFAULT);
  const [words, setWords] = useState(blockedWords);
  const [senders, setSenders] = useState(blockedSenders);
  const [word, setWord] = useState("");

  const errors: Record<string, string> = {};
  (["text", "audio"] as const).forEach((g) => {
    const list = rows.filter((r) => r.group === g);
    list.forEach((r, i) => {
      if (r.value < 100) errors[r.key] = "O mínimo é 100 Kz.";
      else if (i > 0 && r.value < list[i - 1]!.value) errors[r.key] = `Não pode ser inferior ao escalão anterior (${kz(list[i - 1]!.value)}).`;
    });
  });
  const dirty = JSON.stringify(rows) !== JSON.stringify(saved);
  const ok = Object.keys(errors).length === 0;
  const w = word.trim().toLowerCase();
  const wordErr = w && words.includes(w) ? `"${w}" já está na lista.` : null;
  const get = (k: string) => rows.find((r) => r.key === k)!.value;
  const exText = get("t100"); const exExtras = get("efeito") + get("prio");
  const exNet = Math.round((exText + exExtras) * (1 - pricing.platformFeePct / 100));

  const input = (r: Row) => (
    <div key={r.key} className="lines" style={{ padding: 0 }}>
      <div>
        <div className="row between" style={{ gap: 10 }}>
          <label htmlFor={r.key} style={{ fontSize: 14.5 }}>{r.label}</label>
          <span className={errors[r.key] ? "mini-num erro" : "mini-num"} style={{ width: 140 }}>
            <input id={r.key} inputMode="numeric" value={r.value ? kz(r.value, false) : ""} onChange={(e) => setRows((rs) => rs.map((x) => (x.key === r.key ? { ...x, value: Number(e.target.value.replace(/\D/g, "")) || 0 } : x)))} />
            <span>Kz</span>
          </span>
        </div>
        {errors[r.key] && <p className="hint erro" style={{ textAlign: "right" }}>{errors[r.key]}</p>}
      </div>
    </div>
  );

  return (
    <>
      <Topbar title="Preços e filtros" sub={`A plataforma retém ${pricing.platformFeePct}% de cada mensagem`}>
        <button className="btn" onClick={() => setRows(DEFAULT)}>Repor padrão</button>
        <div style={{ width: 140 }}><RouteButton size="sm" disabled={!dirty || !ok} onClick={() => { setSaved(rows); toast.show("Preços guardados. A tua página já mostra os novos valores."); }}>Guardar</RouteButton></div>
      </Topbar>
      <div className="page">
        <div className="split" style={{ gridTemplateColumns: "minmax(0,1.2fr) minmax(0,1fr)" }}>
          <div className="card pad-l">
            <h2>Preços</h2>
            <div className="grid g2" style={{ gap: 24, marginTop: 14 }}>
              <div>
                <div className="eyebrow" style={{ paddingBottom: 8, borderBottom: "1px solid var(--tinta)" }}>Texto · voz padrão</div>
                <div className="stack" style={{ gap: 10, marginTop: 10 }}>{rows.filter((r) => r.group === "text").map((r) => input(r))}</div>
                <div className="eyebrow" style={{ paddingBottom: 8, borderBottom: "1px solid var(--tinta)", marginTop: 22 }}>Extras</div>
                <div className="stack" style={{ gap: 10, marginTop: 10 }}>{rows.filter((r) => r.group === "extra").map((r) => input(r))}</div>
              </div>
              <div>
                <div className="eyebrow" style={{ paddingBottom: 8, borderBottom: "1px solid var(--tinta)" }}>Áudio gravado</div>
                <div className="stack" style={{ gap: 10, marginTop: 10 }}>{rows.filter((r) => r.group === "audio").map((r) => input(r))}</div>
                <div className="card" style={{ background: "var(--papel)", marginTop: 18, padding: 14 }}>
                  <span className="eyebrow">Exemplo</span>
                  <div className="card stack mono" style={{ gap: 8, padding: 14, marginTop: 8, fontSize: 13 }}>
                    <div className="row between"><span className="muted">Texto 61 caracteres</span><span>{kz(exText)}</span></div>
                    <div className="row between"><span className="muted">Efeito + prioridade</span><span>{kz(exExtras)}</span></div>
                    <div className="row between" style={{ borderTop: "1px dashed var(--linha-forte)", paddingTop: 8 }}><span>Recebes (−{pricing.platformFeePct}%)</span><b>{kz(exNet)}</b></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="card pad-l">
            <h2>Filtros automáticos</h2>
            <p className="muted" style={{ marginTop: 6, fontSize: 14 }}>Correm antes do pagamento. Uma mensagem bloqueada nunca é cobrada.</p>
            <div className="eyebrow" style={{ marginTop: 18, paddingBottom: 8, borderBottom: "1px solid var(--tinta)" }}>Sempre ativos</div>
            <div className="lines" style={{ fontSize: 14 }}>
              <div>Links, emails, QR e números de telefone</div>
              <div>Insultos e discurso de ódio</div>
            </div>
            <div className="eyebrow" style={{ marginTop: 18, paddingBottom: 8, borderBottom: "1px solid var(--tinta)" }}>As tuas palavras proibidas · {words.length}</div>
            <div className="chips" style={{ marginTop: 12 }}>
              {words.map((x) => <span key={x} className="chip word">{x}<button aria-label={`Remover ${x}`} onClick={() => setWords(words.filter((y) => y !== x))}>×</button></span>)}
            </div>
            <form style={{ marginTop: 12 }} onSubmit={(e) => { e.preventDefault(); if (w && !wordErr) { setWords([...words, w]); setWord(""); } }}>
              <Field label="Nova palavra" error={wordErr} hint={!wordErr ? "Carrega Enter para adicionar." : undefined}><input value={word} onChange={(e) => setWord(e.target.value)} /></Field>
            </form>
            <div className="eyebrow" style={{ marginTop: 18, paddingBottom: 8, borderBottom: "1px solid var(--tinta)" }}>Remetentes bloqueados · {senders.length}</div>
            <div className="lines">
              {senders.map((s) => (
                <div key={s} className="row between"><span className="mono">{maskPhone(s)}</span><button className="link" onClick={() => { setSenders(senders.filter((x) => x !== s)); toast.show("Remetente desbloqueado"); }}>Desbloquear</button></div>
              ))}
              {senders.length === 0 && <p className="muted">Ninguém bloqueado.</p>}
            </div>
          </div>
        </div>
      </div>
      {toast.node}
    </>
  );
}
