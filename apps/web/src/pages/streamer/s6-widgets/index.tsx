import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Topbar } from "../../../layouts";
import { RouteButton, Tag, copy, useToast } from "../../../shared/ui";
import { PLATFORM_LABEL, streamer, type Platform } from "../../../shared/mocks/data";
import { cx } from "../../../shared/lib/format";
import { WidgetPreview } from "../../../features/overlay-setup/Previews";
import { NO_QR, WIDGETS, widgetUrl, type Conn } from "../../../features/overlay-setup/widgets";

const CONN: Record<Conn, { label: string; tone?: "ok" | "pend" | "erro" }> = {
  aberto: { label: "Aberto", tone: "ok" },
  fechado: { label: "Fechado" },
  a_religar: { label: "A religar", tone: "pend" },
  desligado: { label: "Desligado" },
};

/** S6 — Widgets (11): cada widget é um link que se cola no programa de transmissão. */
export default function Widgets() {
  const nav = useNavigate();
  const toast = useToast();
  const [dest, setDest] = useState<Platform>(streamer.platform);
  const qrOff = NO_QR.includes(dest);

  return (
    <>
      <Topbar title="Widgets" sub="Cada widget é um link que colas no programa de transmissão">
        <Link to="/painel/widgets/ajuda" className="btn hide-m">Resolver problemas</Link>
        <div style={{ width: 230 }}><RouteButton size="sm" onClick={() => toast.show("Alerta de teste enviado para o W1")}>Enviar alerta de teste</RouteButton></div>
      </Topbar>
      <div className="page">
        <div className="row between" style={{ gap: 16, flexWrap: "wrap" }}>
          <div className="dest" role="radiogroup" aria-label="Destino da live">
            <span className="eyebrow">Destino da live</span>
            {(Object.keys(PLATFORM_LABEL) as Platform[]).map((p) => (
              <button key={p} role="radio" aria-checked={dest === p} className={cx("chip", dest === p && "on")} onClick={() => setDest(p)}>{PLATFORM_LABEL[p]}</button>
            ))}
          </div>
          <p className="muted" style={{ fontSize: 13, textAlign: "right", maxWidth: 340 }}>A posição e o tamanho definem-se no programa: arrasta a camada no OBS, LIVE Studio ou CameraFi.</p>
        </div>

        <div className="aviso row between" style={{ alignItems: "center" }}>
          <span>O W1 está aberto em 2 sítios; só o último toca.{qrOff && ` · Escolheste ${PLATFORM_LABEL[dest]}: o W5 foi desligado.`}</span>
          <Link to="/painel/widgets/ajuda" style={{ whiteSpace: "nowrap" }}>Ver onde</Link>
        </div>

        <div className="wg-grid">
          {WIDGETS.map((w) => {
            const off = w.id === "w5" && qrOff;
            const st = off ? { label: `Desligado · ${PLATFORM_LABEL[dest]}` } : CONN[w.conn];
            return (
              <div key={w.id} className={cx("card wg", off && "off")}>
                <div className="hd">
                  <span className="id">W{w.n}</span><b>{w.name}</b>
                  <Tag tone={st.tone}>{st.label}{!off && w.where ? ` · ${w.where}` : ""}</Tag>
                </div>
                <WidgetPreview id={w.id} disabled={off} />
                <div className="row between">
                  <button className="btn dark sm" disabled={off} onClick={() => { copy(widgetUrl(w, { dest })); toast.show(`Link do W${w.n} copiado. Não o mostres na live.`); }}>Copiar link</button>
                  <div className="row" style={{ gap: 6 }}>
                    <a className="btn sm hide-m" href={widgetUrl(w, { dest, preview: true })} target="_blank" rel="noreferrer" aria-disabled={off} style={off ? { pointerEvents: "none", opacity: .45 } : undefined}>Abrir</a>
                    <button className="btn sm" disabled={off} onClick={() => nav(`/painel/widgets/${w.id}`)}>Personalizar</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {qrOff && <p className="hint">O {PLATFORM_LABEL[dest]} não permite QR codes nem links no ecrã. Põe fedha.live/{streamer.handle} só na bio.</p>}
      </div>
      {toast.node}
    </>
  );
}
