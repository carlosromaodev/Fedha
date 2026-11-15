import { useState } from "react";
import { Topbar } from "../../../layouts";
import { RouteButton, useToast } from "../../../shared/ui";
import { pricing } from "../../../shared/mocks/data";
import { kz } from "../../../shared/lib/format";

type Row = { key: string; label: string; group: "Texto · voz padrão" | "Áudio gravado" | "Extras"; value: number };

const DEFAULT: Row[] = [
  ...pricing.text.map((t) => ({ key: `t${t.max}`, label: `${t.min}–${t.max} caracteres`, group: "Texto · voz padrão" as const, value: t.kz })),
  ...pricing.audio.map((a) => ({ key: `a${a.seconds}`, label: `Até ${a.seconds} s`, group: "Áudio gravado" as const, value: a.kz })),
  { key: "voz", label: "Voz premium", group: "Extras", value: pricing.extras.premiumVoice },
  { key: "efeito", label: "Efeito sonoro", group: "Extras", value: pricing.extras.effect },
  { key: "prio", label: "Prioridade na fila", group: "Extras", value: pricing.extras.priority },
];

/** S5 — Preços (mockup B6, coluna Preços). */
export default function Pricing() {
  const [rows, setRows] = useState(DEFAULT);
  const [saved, setSaved] = useState(DEFAULT);
  const toast = useToast();
  const errors: Record<string, string> = {};
  (["Texto · voz padrão", "Áudio gravado"] as const).forEach((g) => {
    const list = rows.filter((r) => r.group === g);
    list.forEach((r, i) => {
      if (r.value < 100) errors[r.key] = "O mínimo é 100 Kz.";
      else if (i > 0 && r.value < list[i - 1]!.value) errors[r.key] = `Não pode ser inferior ao escalão anterior (${kz(list[i - 1]!.value)}).`;
    });
  });
  rows.filter((r) => r.group === "Extras").forEach((r) => { if (r.value < 0) errors[r.key] = "Valor inválido."; });
  const dirty = JSON.stringify(rows) !== JSON.stringify(saved);
  const ok = Object.keys(errors).length === 0;

  return (
    <>
      <Topbar title="Preços" />
      <div className="page" style={{ maxWidth: 720 }}>
        <div className="card pad-l">
          <p className="muted">Aparecem na tua página. A plataforma retém {pricing.platformFeePct}%.</p>
          {(["Texto · voz padrão", "Áudio gravado", "Extras"] as const).map((g) => (
            <div key={g} style={{ marginTop: 20 }}>
              <div className="eyebrow" style={{ paddingBottom: 8, borderBottom: "1px solid var(--tinta)" }}>{g}</div>
              <div className="lines">
                {rows.filter((r) => r.group === g).map((r) => (
                  <div key={r.key}>
                    <div className="row between" style={{ gap: 12 }}>
                      <label htmlFor={r.key}>{r.label}</label>
                      <span className={errors[r.key] ? "field erro" : "field"} style={{ width: 150, padding: "6px 12px", display: "flex", alignItems: "center" }}>
                        <input id={r.key} className="mono-in" inputMode="numeric" style={{ padding: 0 }} value={r.value ? kz(r.value, false) : ""}
                          onChange={(e) => setRows((rs) => rs.map((x) => (x.key === r.key ? { ...x, value: Number(e.target.value.replace(/\D/g, "")) || 0 } : x)))} />
                        <span className="muted" style={{ fontSize: 13 }}>Kz</span>
                      </span>
                    </div>
                    {errors[r.key] && <p className="hint erro" style={{ textAlign: "right" }}>{errors[r.key]}</p>}
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className="row" style={{ justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
            <button className="btn" onClick={() => setRows(DEFAULT)}>Repor padrão</button>
            <div style={{ width: 160 }}><RouteButton size="sm" disabled={!dirty || !ok} onClick={() => { setSaved(rows); toast.show("Preços guardados"); }}>Guardar</RouteButton></div>
          </div>
        </div>
      </div>
      {toast.node}
    </>
  );
}
