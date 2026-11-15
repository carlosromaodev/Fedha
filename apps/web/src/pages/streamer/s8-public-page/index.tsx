import { useState } from "react";
import { Topbar } from "../../../layouts";
import { Field, LiveBadge, RouteButton, Tag, useToast } from "../../../shared/ui";
import { streamer } from "../../../shared/mocks/data";

/** S8 — Página pública: edição com pré-visualização (mockup E6). */
export default function PublicPage() {
  const [name, setName] = useState(streamer.name);
  const [bio, setBio] = useState(streamer.bio);
  const [thanks, setThanks] = useState("Obrigado pelo apoio, a tua mensagem vai tocar já!");
  const [showTop, setShowTop] = useState(true);
  const [showLast, setShowLast] = useState(true);
  const [offline, setOffline] = useState<"aceitar" | "fechar">("aceitar");
  const toast = useToast();

  return (
    <>
      <Topbar title="Página pública">
        <a className="btn hide-m" href={`/${streamer.handle}`} target="_blank" rel="noreferrer">Abrir página</a>
      </Topbar>
      <div className="page">
        <div className="split" style={{ gridTemplateColumns: "minmax(0,1fr) 380px" }}>
          <div className="card pad-l stack" style={{ gap: 14 }}>
            <div className="row" style={{ gap: 14 }}><span className="avatar l">KG</span><button className="btn sm">Mudar foto</button><button className="btn sm">Mudar capa</button></div>
            <Field label="Nome artístico"><input value={name} maxLength={30} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label="Bio" aside={`${bio.length}/160`}><textarea maxLength={160} value={bio} onChange={(e) => setBio(e.target.value)} /></Field>
            <Field label="Mensagem de agradecimento" aside={`${thanks.length}/120`} hint="Aparece ao doador depois de pagar."><textarea maxLength={120} value={thanks} onChange={(e) => setThanks(e.target.value)} /></Field>
            <div className="lines" style={{ fontSize: 14 }}>
              <label className="row between">Mostrar top doadores<input type="checkbox" className="toggle" checked={showTop} onChange={(e) => setShowTop(e.target.checked)} /></label>
              <label className="row between">Mostrar últimas mensagens<input type="checkbox" className="toggle" checked={showLast} onChange={(e) => setShowLast(e.target.checked)} /></label>
              <div className="row between" style={{ gap: 12 }}>
                <span>Quando não estás em direto</span>
                <div className="seg" style={{ width: 240 }}>
                  <button className={offline === "aceitar" ? "on" : ""} onClick={() => setOffline("aceitar")}>Aceitar</button>
                  <button className={offline === "fechar" ? "on" : ""} onClick={() => setOffline("fechar")}>Fechar</button>
                </div>
              </div>
            </div>
            <p className="hint">Não ponhas links nem QR na bio se fazes live no TikTok ou Instagram: põe o link Fedha só na bio da plataforma.</p>
            <div style={{ width: 180, alignSelf: "flex-end" }}><RouteButton size="sm" onClick={() => toast.show("Página atualizada")}>Guardar</RouteButton></div>
          </div>

          <div className="card" style={{ padding: 0, overflow: "hidden", position: "sticky", top: 90 }} aria-label="Pré-visualização">
            <div style={{ height: 70, background: "var(--verde)" }} />
            <div style={{ padding: 18, marginTop: -40 }}>
              <span className="avatar l" style={{ border: "3px solid var(--branco)" }}>KG</span>
              <div className="row" style={{ gap: 8, marginTop: 10 }}><Tag>TikTok live</Tag>{offline === "aceitar" ? <LiveBadge /> : <Tag>Offline</Tag>}</div>
              <h2 style={{ fontSize: 20, marginTop: 8 }}>{name || "—"}</h2>
              <p className="muted" style={{ fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>{bio}</p>
              {showLast && <div className="card" style={{ background: "var(--papel)", padding: 12, marginTop: 12, fontSize: 13 }}><b>Luana</b> · "Kiami, manda salve pra malta do Lobito!"</div>}
              {showTop && <p className="mono muted" style={{ fontSize: 12, marginTop: 10 }}>TOP · DJ Nelo · Edvaldo · Mauro A.</p>}
              <div className="btn-route sm" style={{ marginTop: 14 }}><span className="label">Enviar mensagem</span><span className="dot" /></div>
            </div>
          </div>
        </div>
      </div>
      {toast.node}
    </>
  );
}
