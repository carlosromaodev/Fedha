import { useState } from "react";
import { Topbar } from "../../../layouts";
import { Field, RouteButton, Tag, useToast } from "../../../shared/ui";
import { goal } from "../../../shared/mocks/data";
import { cx, kz } from "../../../shared/lib/format";

const PAST = [
  { title: "Microfone novo", current: 45000, target: 45000, status: "concluída" },
  { title: "Viagem ao Lubango para o torneio", current: 63200, target: 150000, status: "terminada" },
  { title: "Ring light", current: 30000, target: 30000, status: "concluída" },
];
const MIN = 5000;

/** S7 — Metas (27): meta ativa, anteriores e criação com validação. A meta ativa aparece no widget W2. */
export default function Goals() {
  const toast = useToast();
  const [active, setActive] = useState<typeof goal | null>(goal);
  const [showW2, setShowW2] = useState(true);
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("");
  const [end, setEnd] = useState("");
  const [from, setFrom] = useState("agora");
  const [touched, setTouched] = useState(false);
  const t = Number(target.replace(/\D/g, "")) || 0;
  const errs = {
    title: touched && title.trim().length < 3 ? "Dá um nome com pelo menos 3 letras." : null,
    target: (touched || target) && t < MIN ? `O valor mínimo de uma meta é ${kz(MIN)}.` : null,
    end: end && new Date(end) <= new Date() ? "A data tem de ser no futuro." : null,
  };
  const valid = title.trim().length >= 3 && t >= MIN && !errs.end;
  const pct = active ? Math.round((active.current / active.target) * 100) : 0;
  const clear = () => { setTitle(""); setTarget(""); setEnd(""); setFrom("agora"); setTouched(false); };

  return (
    <>
      <Topbar title="Metas" sub="A meta ativa aparece no widget W2">
        <div style={{ width: 150 }}><RouteButton size="sm" onClick={() => document.getElementById("nova-meta")?.querySelector("input")?.focus()}>Nova meta</RouteButton></div>
      </Topbar>
      <div className="page">
        <div className="split" style={{ gridTemplateColumns: "minmax(0,1.4fr) minmax(0,1fr)" }}>
          <div className="stack" style={{ gap: 16 }}>
            {active ? (
              <div className="card verde pad-l stack" style={{ gap: 14 }}>
                <div className="row" style={{ gap: 10 }}><span className="tag ok">Ativa</span><span style={{ fontSize: 13 }}>Termina a {active.endsAt}</span></div>
                <h2 style={{ fontSize: 30, letterSpacing: "-0.03em" }}>{active.title}</h2>
                <div className="meter" style={{ height: 32 }} aria-label={`${pct}%`}>
                  {Array.from({ length: 40 }, (_, i) => <i key={i} style={{ height: `${55 + ((i * 41) % 45)}%`, background: i < (pct / 100) * 40 ? "var(--sinal)" : "rgba(255,255,255,.14)" }} />)}
                </div>
                <div className="row between" style={{ alignItems: "baseline" }}>
                  <span className="kz" style={{ fontSize: 22 }}>{kz(active.current, false)} / {kz(active.target)}</span>
                  <span className="mono" style={{ fontSize: 12 }}>{pct}% · 54 apoiantes</span>
                </div>
                <div className="row between" style={{ borderTop: "1px solid rgba(255,255,255,.15)", paddingTop: 14, gap: 12, flexWrap: "wrap" }}>
                  <label className="row" style={{ gap: 10, fontSize: 14 }}>
                    <input type="checkbox" className="selo on-verde" checked={showW2} onChange={(e) => setShowW2(e.target.checked)} /> Mostrar no widget W2
                  </label>
                  <div className="row" style={{ gap: 8 }}>
                    <button className="btn ghost-light">Editar</button>
                    <button className="btn ghost-light" onClick={() => { setActive(null); toast.show("Meta terminada"); }}>Terminar meta</button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="card pad-l"><p className="muted">Sem meta ativa. Cria uma ao lado: o progresso aparece na tua página e no widget W2.</p></div>
            )}
            <div className="card pad-l">
              <h2>Metas anteriores</h2>
              <div className="lines" style={{ marginTop: 8 }}>
                {PAST.map((g) => (
                  <div key={g.title} className="row" style={{ gap: 12, flexWrap: "wrap" }}>
                    <span className="grow">{g.title}</span>
                    <span className="kz" style={{ fontSize: 13 }}>{kz(g.current, false)} / {kz(g.target)}</span>
                    <Tag tone={g.status === "concluída" ? "ok" : undefined}>{g.status}</Tag>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <form id="nova-meta" className="card pad-l stack" style={{ gap: 12 }} onSubmit={(e) => { e.preventDefault(); setTouched(true); if (!valid) return; setActive({ title, current: 0, target: t, endsAt: end ? new Date(end).toLocaleDateString("pt-PT") : "sem data" }); clear(); toast.show("Meta criada. Já aparece no W2."); }}>
            <h2>Nova meta</h2>
            <Field label="Nome da meta" error={errs.title}><input value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: PC novo para as lives" /></Field>
            <Field label="Valor a atingir" aside="Kz" error={errs.target}><input className="mono-in" inputMode="numeric" value={t ? kz(t, false) : ""} onChange={(e) => setTarget(e.target.value)} /></Field>
            <Field label="Termina a" error={errs.end}><input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
            <Field label="Começa a contar" hint={from === "agora" ? "Só conta mensagens recebidas depois de criares a meta." : "Inclui as mensagens de hoje."}>
              <select value={from} onChange={(e) => setFrom(e.target.value)}><option value="agora">Agora</option><option value="hoje">Desde o início do dia</option></select>
            </Field>
            <div className="row" style={{ gap: 10, justifyContent: "flex-end" }}>
              <button type="button" className="btn" onClick={clear}>Cancelar</button>
              <div style={{ width: 150 }}><RouteButton type="submit" size="sm" disabled={!valid && touched} className={cx(!valid && "is-off")}>Criar meta</RouteButton></div>
            </div>
          </form>
        </div>
      </div>
      {toast.node}
    </>
  );
}
