import type { CSSProperties } from "react";
import { goal } from "../../shared/mocks/data";
import { cx, kz } from "../../shared/lib/format";
import type { WidgetId, WidgetTheme } from "./widgets";

/**
 * Pré-visualizações estáticas dos widgets para o painel (sobre fundo transparente em xadrez).
 * O aspeto segue o overlay real (apps/overlay); a versão animada abre-se em "Abrir".
 */
export function AlertCard({ theme = "claro", level = "destaque", name = "Luana", text = "Feliz aniversário DJ Nelo, és o maior!", value = 3000, accent, karaoke = true, showName = true, showValue = true, size = "m", progress = 34 }: {
  theme?: WidgetTheme; level?: "normal" | "destaque" | "super"; name?: string; text?: string; value?: number; accent?: string; karaoke?: boolean; showName?: boolean; showValue?: boolean; size?: "p" | "m" | "g"; progress?: number;
}) {
  const words = text.split(" ");
  return (
    <div className={cx("pv-w1", `th-${theme}`, `lv-${level}`, `sz-${size}`)} style={accent ? ({ "--accent": accent } as CSSProperties) : undefined}>
      <div className="hd">
        <span className="brand"><b>Fedha</b> LIVE</span>
        {level !== "normal" && <span className="lvl">{level === "super" ? "Super" : "Destaque"}</span>}
        {showValue && <span className="val">{kz(value)}</span>}
      </div>
      <div className="bd">
        {showName && <b className="who">{name}</b>}
        <div className="meta"><span>Voz premium · Nzinga</span><span className="prio">Prioridade</span><span className="q">1 na fila</span></div>
        <p className="txt">{words.map((w, i) => <span key={i} className={karaoke && i === 2 ? "on" : ""}>{w} </span>)}</p>
        <div className="bar"><i style={{ width: `${progress}%` }} /></div>
      </div>
    </div>
  );
}

export function WidgetPreview({ id, theme = "claro", disabled }: { id: WidgetId; theme?: WidgetTheme; disabled?: boolean }) {
  const pct = Math.round((goal.current / goal.target) * 100);
  return (
    <div className={cx("pv-stage", disabled && "off")} aria-hidden>
      {id === "w1" && <div style={{ width: "88%" }}><AlertCard theme={theme} /></div>}
      {id === "w2" && (
        <div className={cx("pv-card", `th-${theme}`)} style={{ width: "88%" }}>
          <div className="pv-hd"><span className="brand"><b>Fedha</b> LIVE</span><span className="tag sinal">{pct}%</span></div>
          <div style={{ padding: "8px 12px 10px" }}>
            <small className="eyebrow">Meta</small>
            <b style={{ display: "block", fontSize: 14 }}>{goal.title}</b>
            <div className="mono" style={{ fontSize: 20 }}>{kz(goal.current, false)} <small style={{ fontSize: 11 }}>/ {kz(goal.target)}</small></div>
            <div className="meter" style={{ height: 14, marginTop: 4 }}>{Array.from({ length: 34 }, (_, i) => <i key={i} className={i < (pct / 100) * 34 ? "on" : ""} style={{ height: `${40 + ((i * 41) % 60)}%` }} />)}</div>
          </div>
        </div>
      )}
      {id === "w3" && (
        <div className={cx("pv-card", `th-${theme}`)} style={{ width: "60%", fontSize: 11 }}>
          <div className="pv-hd"><span className="brand"><b>Fedha</b> LIVE</span><span className="eyebrow" style={{ color: "rgba(255,255,255,.7)", fontSize: 8 }}>Top 5 · esta live</span></div>
          <div style={{ padding: 6 }}>
            {[["Edvaldo", 19000], ["DJ Nelo", 18500], ["Luana", 9000], ["Mauro A.", 6500], ["Anónimo", 5000]].map(([n, v], i) => (
              <div key={n as string} className="row between" style={{ padding: "3px 6px", borderRadius: 4, background: i === 0 ? "var(--sinal)" : undefined, fontWeight: i === 0 ? 600 : 400 }}>
                <span><span className="mono" style={{ marginRight: 8 }}>{i + 1}</span>{n}</span><span className="mono">{kz(v as number)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {id === "w4" && (
        <div className="pv-ticker"><span className="lab"><b>Fedha</b> LIVE</span><span className="it"><b>DJ Nelo</b> <em>2.500 Kz</em> Ya mano, essa jogada foi mesmo à Kuduro 😂</span></div>
      )}
      {id === "w5" && (
        <div className={cx("pv-card", `th-${theme}`)} style={{ width: 110, textAlign: "center" }}>
          <div className="pv-hd" style={{ justifyContent: "center" }}><span className="brand"><b>Fedha</b> LIVE</span></div>
          <div className="pv-qr">{Array.from({ length: 49 }, (_, i) => <i key={i} className={(i * 37 + (i % 5)) % 3 === 0 || [0, 1, 7, 8, 5, 6, 12, 13, 35, 36, 42, 43].includes(i) ? "on" : ""} />)}</div>
          <small style={{ display: "block", fontSize: 9, padding: "0 6px 2px" }}>Manda a tua mensagem!</small>
          <small className="mono muted" style={{ display: "block", fontSize: 8, paddingBottom: 6 }}>fedha.live/kiami</small>
        </div>
      )}
      {id === "w6" && (
        <div className="stack" style={{ width: "78%", gap: 6, fontSize: 9 }}>
          <AlertCard theme={theme} size="p" />
          <div className={cx("pv-card", `th-${theme}`)}><div style={{ padding: "6px 10px" }}><small className="eyebrow" style={{ fontSize: 8 }}>Meta</small><b style={{ display: "block" }}>{goal.title}</b><span className="mono">{kz(goal.current, false)} / {kz(goal.target)}</span></div></div>
        </div>
      )}
    </div>
  );
}
