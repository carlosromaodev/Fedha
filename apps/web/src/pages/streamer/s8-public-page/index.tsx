import { useState } from "react";
import { Topbar } from "../../../layouts";
import { Field, LiveBadge, RouteButton, Tag, useToast, ExternalLink, Camera } from "../../../shared/ui";
import { streamer } from "../../../shared/mocks/data";
import { initials } from "../../../shared/lib/format";

/** S8 — Página pública (09): o que os doadores veem em fedha.live/<nome>, com pré-visualização ao lado. */
export default function PublicPage() {
  const toast = useToast();
  const [name, setName] = useState(streamer.name);
  const [handle, setHandle] = useState(streamer.handle);
  const [bio, setBio] = useState("Free Fire e FIFA todas as noites a partir das 20h. Bora rir, malta!");
  const [offline, setOffline] = useState("Volto hoje às 20h no TikTok. Até já!");
  const [platforms] = useState([{ n: "TikTok", h: "@kiamigamer" }, { n: "YouTube", h: "@KiamiGamerAO" }]);
  const slug = handle.toLowerCase().replace(/[^a-z0-9_.]/g, "");
  const slugErr = slug.length < 3 ? "Pelo menos 3 caracteres." : null;

  return (
    <>
      <Topbar title="Página pública" sub={`fedha.live/${slug}`}>
        <a className="btn hide-m" href={`/${streamer.handle}`} target="_blank" rel="noreferrer"><ExternalLink aria-hidden />Ver página</a>
        <div style={{ width: 220 }}><RouteButton size="sm" disabled={!!slugErr || !name.trim()} onClick={() => toast.show("Alterações publicadas")}>Publicar alterações</RouteButton></div>
      </Topbar>
      <div className="page">
        <div className="split" style={{ gridTemplateColumns: "minmax(0,1fr) 320px" }}>
          <div className="card pad-l stack" style={{ gap: 14 }}>
            <div className="row" style={{ gap: 14 }}>
              <span className="avatar l" style={{ width: 64, height: 64, fontSize: 20 }}>{initials(name || "?")}</span>
              <label className="btn sm" style={{ cursor: "pointer" }}><Camera aria-hidden />Alterar foto<input type="file" accept="image/png,image/jpeg" className="sr-only" onChange={() => toast.show("Foto carregada")} /></label>
              <span className="muted" style={{ fontSize: 13 }}>JPG ou PNG, até 2 MB</span>
            </div>
            <div className="grid g2">
              <Field label="Nome público"><input value={name} maxLength={30} onChange={(e) => setName(e.target.value)} /></Field>
              <Field label="Endereço" error={slugErr} aside={!slugErr ? <Tag tone="ok">Disponível</Tag> : undefined}>
                <span className="row mono" style={{ paddingTop: 4, fontSize: 16 }}><span className="muted">fedha.live/</span><input className="mono-in" style={{ padding: 0 }} value={handle} onChange={(e) => setHandle(e.target.value)} /></span>
              </Field>
            </div>
            <Field label="Bio" aside={`${bio.length}/160`}><textarea maxLength={160} value={bio} onChange={(e) => setBio(e.target.value)} /></Field>
            <div>
              <span className="eyebrow">Plataformas</span>
              <div className="stack" style={{ gap: 8, marginTop: 8 }}>
                {platforms.map((p) => (
                  <div key={p.n} className="talao" style={{ background: "var(--papel)", minHeight: 48 }}>
                    <div className="corpo row" style={{ gap: 28 }}><b style={{ width: 80 }}>{p.n}</b><span className="mono muted" style={{ fontSize: 13 }}>{p.h}</span><button className="link" style={{ marginLeft: "auto", fontSize: 13 }}>Alterar</button></div>
                    <div className="canhoto" style={{ minWidth: 92 }}><Tag tone="ok">Ligada</Tag></div>
                  </div>
                ))}
              </div>
            </div>
            <Field label="Mensagem quando estás offline" hint="Aparece no lugar do formulário quando não estás em direto."><input value={offline} maxLength={80} onChange={(e) => setOffline(e.target.value)} /></Field>
            <p className="hint">Se fazes live no TikTok ou no Instagram, não ponhas links nem QR na bio da Fedha: põe fedha.live/{slug} só na bio da plataforma.</p>
          </div>

          <div style={{ position: "sticky", top: 90 }} aria-label="Pré-visualização">
            <div className="eyebrow" style={{ textAlign: "center", marginBottom: 12 }}>Pré-visualização</div>
            <div className="phone-frame">
              <div style={{ margin: 10, padding: "6px 10px", borderRadius: 999, background: "#e9eee9", textAlign: "center", fontSize: 11 }} className="mono">fedha.live/{slug}</div>
              <div style={{ padding: "8px 16px 18px" }}>
                <div className="row" style={{ gap: 6 }}><Tag>TikTok live</Tag><LiveBadge /></div>
                <div className="row" style={{ gap: 10, marginTop: 12 }}>
                  <span className="avatar" style={{ width: 38, height: 38, background: "var(--verde)", color: "var(--branco)" }}>{initials(name || "?")}</span>
                  <div><b>{name || "—"}</b><div className="mono muted" style={{ fontSize: 10 }}>@{slug}gamer</div></div>
                </div>
                <p className="muted" style={{ fontSize: 12, marginTop: 10, lineHeight: 1.45 }}>{bio}</p>
                <div style={{ height: 90, borderRadius: 14, background: "var(--verde)", marginTop: 12 }} />
                <div style={{ height: 36, borderRadius: 10, background: "var(--branco)", marginTop: 10 }} />
                <div style={{ height: 56, borderRadius: 10, background: "var(--branco)", marginTop: 8 }} />
                <div className="meter" style={{ height: 16, marginTop: 10 }}>{Array.from({ length: 30 }, (_, i) => <i key={i} className={i < 9 ? "on" : ""} style={{ height: `${40 + ((i * 41) % 60)}%` }} />)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {toast.node}
    </>
  );
}
