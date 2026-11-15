import { useState } from "react";
import { Topbar } from "../../../layouts";
import { Field, Modal, RouteButton, Tag, useToast } from "../../../shared/ui";
import { goal, pastGoals } from "../../../shared/mocks/data";
import { kz } from "../../../shared/lib/format";

/** S7 — Metas (mockup E5). */
export default function Goals() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<typeof goal | null>(goal);
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("");
  const [end, setEnd] = useState("");
  const toast = useToast();
  const t = Number(target.replace(/\D/g, "")) || 0;
  const errs = { title: title && title.length < 3 ? "Pelo menos 3 caracteres." : null, target: target && t < 1000 ? `O mínimo é ${kz(1000)}.` : null, end: end && new Date(end) < new Date() ? "A data tem de ser no futuro." : null };
  const valid = title.length >= 3 && t >= 1000 && !!end && !errs.end;
  const pct = active ? Math.round((active.current / active.target) * 100) : 0;

  return (
    <>
      <Topbar title="Metas">
        <div style={{ width: 160 }}><RouteButton size="sm" onClick={() => setOpen(true)} disabled={!!active}>Nova meta</RouteButton></div>
      </Topbar>
      <div className="page" style={{ maxWidth: 860 }}>
        {active ? (
          <div className="card verde pad-l stack" style={{ gap: 12 }}>
            <div className="row between"><span className="eyebrow" style={{ color: "rgba(255,255,255,.8)" }}>Meta ativa · termina {active.endsAt}</span><Tag tone="sinal">{pct}%</Tag></div>
            <h2 style={{ fontSize: 26 }}>{active.title}</h2>
            <div className="progress" style={{ height: 10, borderRadius: 4 }}><i style={{ width: `${pct}%` }} /></div>
            <div className="row between kz"><span>{kz(active.current)}</span><span style={{ opacity: .8 }}>de {kz(active.target)}</span></div>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,.8)" }}>Aparece na tua página e no widget de meta do overlay.</p>
            <button className="btn ghost-light" style={{ alignSelf: "flex-start" }} onClick={() => { setActive(null); toast.show("Meta encerrada"); }}>Encerrar meta</button>
          </div>
        ) : (
          <div className="card"><p className="muted">Sem meta ativa. Cria uma para mostrar o progresso na página e na live.</p></div>
        )}
        <span className="eyebrow">Anteriores</span>
        <div className="card lines" style={{ padding: "0 20px" }}>
          {pastGoals.map((g) => (
            <div key={g.title} className="row between" style={{ gap: 12 }}>
              <div><b style={{ fontWeight: 500 }}>{g.title}</b><br /><small className="mono muted">{g.endedAt}</small></div>
              <span className="kz" style={{ fontSize: 13 }}>{kz(g.current)} / {kz(g.target)}</span>
              <Tag tone={g.done ? "ok" : undefined}>{g.done ? "Atingida" : "Não atingida"}</Tag>
            </div>
          ))}
        </div>
      </div>
      {open && (
        <Modal title="Nova meta" onClose={() => setOpen(false)}>
          <div className="stack" style={{ gap: 12 }}>
            <Field label="Título" error={errs.title}><input value={title} maxLength={40} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Microfone novo" /></Field>
            <Field label="Valor" error={errs.target}><input className="mono-in" inputMode="numeric" value={t ? kz(t) : ""} onChange={(e) => setTarget(e.target.value)} /></Field>
            <Field label="Termina em" error={errs.end}><input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
            <RouteButton disabled={!valid} onClick={() => { setActive({ title, current: 0, target: t, endsAt: new Date(end).toLocaleDateString("pt-PT") }); setOpen(false); toast.show("Meta criada"); }}>Criar meta</RouteButton>
          </div>
        </Modal>
      )}
      {toast.node}
    </>
  );
}
