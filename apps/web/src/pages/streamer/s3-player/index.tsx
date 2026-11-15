import { useState } from "react";
import { Link } from "react-router-dom";
import { Topbar } from "../../../layouts";
import { Tag, Volume, useToast } from "../../../shared/ui";
import { queue } from "../../../shared/mocks/data";
import { kz } from "../../../shared/lib/format";

/** S3 — Player no painel (13): para lives sem widget ou para tocar numa coluna. No telemóvel abre /player. */
export default function PlayerPage() {
  const toast = useToast();
  const [vol, setVol] = useState(75);
  const now = queue.find((q) => q.status === "a_tocar")!;
  const next = queue.filter((q) => q.status === "na_fila").slice(0, 3);
  return (
    <>
      <Topbar title="Player" sub="Para lives sem widget ou para tocar numa coluna">
        <Link to="/player" className="btn hide-m">Abrir no telemóvel</Link>
        <button className="btn" onClick={() => toast.show("Som de teste a tocar em todas as saídas")}>Testar som</button>
      </Topbar>
      <div className="page">
        <div className="split">
          <div className="card verde pad-l stack" style={{ gap: 16, minHeight: 420 }} aria-live="polite">
            <div className="row between"><span className="eyebrow" style={{ color: "rgba(255,255,255,.8)" }}>A tocar agora · voz padrão</span><span className="tag ok">Ligado</span></div>
            <p style={{ fontSize: 36, lineHeight: 1.2, letterSpacing: "-0.02em" }}>"{now.text}"</p>
            <p><b>{now.donor}</b> <span className="kz" style={{ marginLeft: 8 }}>{kz(now.kz)}</span></p>
            <div className="row" style={{ gap: 4, height: 64, alignItems: "center" }} aria-hidden>
              {Array.from({ length: 36 }, (_, i) => <i key={i} style={{ flex: 1, height: `${25 + ((i * 47) % 75)}%`, background: "var(--sinal)", borderRadius: 2, animation: `fl-bars 1s ${(i * 113) % 900}ms ease-in-out infinite` }} />)}
            </div>
            <div className="progress"><i style={{ width: "32%" }} /></div>
            <div className="row" style={{ gap: 16 }}>
              <button className="btn ghost-light" onClick={() => toast.show("A repetir a última mensagem só neste Player")}>Repetir a última</button>
              <div className="grow"><Volume value={vol} onChange={setVol} dark /></div>
            </div>
          </div>
          <div className="stack" style={{ gap: 16 }}>
            <div className="card pad-l">
              <h2>Saídas</h2>
              <div className="lines" style={{ marginTop: 6, fontSize: 14 }}>
                <div className="row between"><span className="muted">Este computador</span><Tag tone="ok">A tocar</Tag></div>
                <div className="row between"><span className="muted">Telemóvel · coluna Bluetooth</span><Tag tone="ok">Ligado</Tag></div>
                <div className="row between"><span className="muted">W1 Alerta no LIVE Studio</span><Tag tone="ok">Ligado</Tag></div>
              </div>
              <p className="hint">Cada mensagem toca uma vez. Com o W1 ligado, o som sai pelo widget; o Player serve de coluna extra ou de plano B.</p>
            </div>
            <div className="card pad-l">
              <h2>A seguir</h2>
              <div className="lines" style={{ marginTop: 6, fontSize: 14 }}>
                {next.map((m) => <div key={m.id} className="row between"><span className="muted">{m.donor}</span><span className="kz">{kz(m.kz)}</span></div>)}
              </div>
            </div>
          </div>
        </div>
      </div>
      {toast.node}
    </>
  );
}
