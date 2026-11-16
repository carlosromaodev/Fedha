import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { StepsLayout } from "../../../layouts";
import { LiveBadge, RouteButton, Tag } from "../../../shared/ui";
import { initials } from "../../../shared/lib/format";

const TAKEN = ["kiami", "djnelo", "luanaplays", "admin", "fedha", "painel", "auth", "pedido", "r", "o"];

/** 04 — Escolher o link: o endereço público reservado na hora. */
export default function ChooseLink() {
  const nav = useNavigate();
  const state = (useLocation().state ?? {}) as { name?: string };
  const display = state.name?.split(" ")[0] ?? "Kiami";
  const [value, setValue] = useState("kiami");
  const slug = value.toLowerCase().replace(/[^a-z0-9_.]/g, "");
  const err = slug.length < 3 ? "Pelo menos 3 letras ou números." : slug.length > 24 ? "No máximo 24 caracteres." : TAKEN.includes(slug) && slug !== "kiami" ? `fedha.live/${slug} já está ocupado.` : null;
  const suggestions = [`${slug}gamer`, `${slug}.ao`, `${slug}_live`].filter((s) => s.length > 3);

  return (
    <StepsLayout step={2} title="Escolhe o teu link" text="É o endereço que partilhas no chat da live. Podes mudá-lo mais tarde."
      foot={<RouteButton disabled={!!err} onClick={() => nav("/boas-vindas")}>Criar conta</RouteButton>}>
      <h1>O teu link</h1>
      <div>
        <label className={err ? "field erro" : "field ok"}>
          <span className="lbl"><span>Endereço</span>{!err && <Tag tone="ok">Disponível</Tag>}</span>
          <span className="row mono" style={{ paddingTop: 4, fontSize: 16 }}>
            <span className="muted">fedha.live/</span>
            <input className="mono-in" style={{ padding: 0 }} value={value} onChange={(e) => setValue(e.target.value)} autoCapitalize="off" autoFocus aria-label="Endereço" />
          </span>
        </label>
        {err && <p className="hint erro" role="alert">{err}</p>}
      </div>
      <div className="chips">{suggestions.map((s) => <button key={s} className="chip word" onClick={() => setValue(s)}>{s}</button>)}</div>
      <span className="eyebrow">É assim que a malta te vai ver</span>
      <div className="talao" style={{ minHeight: 68 }}>
        <div className="corpo row" style={{ gap: 12 }}>
          <span className="avatar" style={{ width: 40, height: 40, background: "var(--verde)", color: "var(--branco)" }}>{initials(`${display} Gamer`)}</span>
          <div><b>{display} Gamer</b><div className="mono muted" style={{ fontSize: 12 }}>fedha.live/{slug || "…"}</div></div>
        </div>
        <div className="canhoto" style={{ minWidth: 110 }}><LiveBadge /></div>
      </div>
    </StepsLayout>
  );
}
