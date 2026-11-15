import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Field, Logo, RouteButton, copy, useToast } from "../../../shared/ui";
import { PLATFORM_LABEL, pricing, type Device, type Platform } from "../../../shared/mocks/data";
import { cx, kz } from "../../../shared/lib/format";

type Step = 1 | 2 | 3 | 4 | 5;

/** Recomendação de saída por plataforma e dispositivo (estratégia do overlay único). */
export function recommend(platform: Platform, device: Device) {
  if (device === "pc") {
    if (platform === "tiktok") return { visual: true, how: "TikTok LIVE Studio → Adicionar fonte → Link Source, ou OBS com stream key.", mode: "overlay" as const };
    if (platform === "instagram") return { visual: true, how: "OBS a transmitir pelo Instagram Live Producer, com o link como Browser Source.", mode: "overlay" as const };
    return { visual: true, how: "OBS ou Streamlabs → Fontes → Navegador → cola o link do overlay.", mode: "overlay" as const };
  }
  if (platform === "tiktok" || platform === "instagram")
    return { visual: false, how: "Na app nativa não é possível desenhar sobre o vídeo. Usa o Player só-áudio numa coluna perto do microfone, ou transmite com PRISM / CameraFi Live.", mode: "audio_only" as const };
  return { visual: true, how: "PRISM Live Studio ou CameraFi Live → widget Web → cola o link do overlay.", mode: "overlay" as const };
}

/** A6 — Onboarding guiado (mockup F7 + passo "Onde fazes live?" da estratégia). */
export default function Onboarding() {
  const nav = useNavigate();
  const toast = useToast();
  const [step, setStep] = useState<Step>(1);
  const [bio, setBio] = useState("");
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [device, setDevice] = useState<Device | null>(null);
  const [tested, setTested] = useState(false);
  const rec = platform && device ? recommend(platform, device) : null;
  const next = () => setStep((s) => (s + 1) as Step);

  if (step === 5) {
    return (
      <div className="pub verde">
        <main className="pub-main" style={{ justifyContent: "center", gap: 18 }}>
          <h1>Está tudo pronto</h1>
          <p style={{ fontWeight: 300, lineHeight: 1.5 }}>Partilha fedha.live/kiami na tua próxima live. As mensagens aparecem e tocam assim que forem pagas.</p>
          <div className="track">
            {["Perfil e link", "Onde fazes live", "Preços", rec?.mode === "audio_only" ? "Player só-áudio" : "Overlay ligado"].map((t) => (
              <div key={t}><span className="b done" /><b className="grow" style={{ fontWeight: 500 }}>{t}</b></div>
            ))}
            <div><span className="b next" /><b className="grow" style={{ fontWeight: 500 }}>Verificação de identidade</b><span className="tag pend">Para levantar</span></div>
          </div>
        </main>
        <footer className="pub-foot">
          <RouteButton tone="sinal" onClick={() => nav("/verificacao")}>Enviar documentos agora</RouteButton>
          <button className="btn ghost-light block" onClick={() => nav("/painel")}>Ir para o painel</button>
        </footer>
      </div>
    );
  }

  return (
    <div className="pub">
      <header className="sp-head"><Logo /></header>
      <main className="pub-main">
        <div className="steps">{[1, 2, 3, 4].map((i) => <i key={i} className={i <= step ? "on" : ""} />)}</div>

        {step === 1 && (
          <>
            <span className="eyebrow">Passo 1 de 4 · Perfil</span>
            <h1>Como te apresentas</h1>
            <div className="row" style={{ gap: 14 }}>
              <span className="avatar l">KG</span>
              <button className="btn sm">Escolher foto</button>
            </div>
            <Field label="Bio" aside={`${bio.length}/160`} hint="Aparece na tua página, por cima do compositor.">
              <textarea maxLength={160} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="O que fazes nas tuas lives e quando" />
            </Field>
          </>
        )}

        {step === 2 && (
          <>
            <span className="eyebrow">Passo 2 de 4 · Onde fazes live?</span>
            <h1>Onde fazes as tuas lives?</h1>
            <p className="muted">Usamos isto para te mostrar como ligar o overlay e para desligar o que a plataforma não permite.</p>
            <div className="chips">
              {(Object.keys(PLATFORM_LABEL) as Platform[]).map((p) => (
                <button key={p} className={cx("chip", platform === p && "on")} onClick={() => setPlatform(p)}>{PLATFORM_LABEL[p]}</button>
              ))}
            </div>
            <div className="eyebrow" style={{ marginTop: 6 }}>Transmites a partir de</div>
            <div className="grid g2" style={{ gridTemplateColumns: "1fr 1fr" }}>
              {([["pc", "Computador", "OBS, Streamlabs, LIVE Studio"], ["telemovel", "Telemóvel", "App nativa, PRISM, CameraFi"]] as const).map(([d, t, s]) => (
                <button key={d} className={cx("opcao", device === d && "on")} onClick={() => setDevice(d)} style={{ flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
                  <b>{t}</b><small className="muted">{s}</small>
                </button>
              ))}
            </div>
            {rec && (
              <div className={rec.visual ? "aviso info" : "aviso"} style={{ flexDirection: "column", gap: 6 }}>
                <b>{rec.visual ? "A mensagem aparece no ecrã e toca na live" : "Só áudio nesta configuração"}</b>
                <span>{rec.how}</span>
                {(platform === "tiktok" || platform === "instagram") && <span>O QR code (W5) fica desligado: o {PLATFORM_LABEL[platform]} não permite links nem QR no ecrã. Põe o teu link Fedha só na bio.</span>}
              </div>
            )}
          </>
        )}

        {step === 3 && (
          <>
            <span className="eyebrow">Passo 3 de 4 · Preços</span>
            <h1>Preços sugeridos</h1>
            <p className="muted">Podes mudar depois em Preços. A plataforma retém {pricing.platformFeePct}%.</p>
            <div className="card lines">
              {pricing.text.map((t) => <div key={t.max} className="row between"><span>Texto {t.min}–{t.max} caracteres</span><span className="kz">{kz(t.kz)}</span></div>)}
              {pricing.audio.map((a) => <div key={a.seconds} className="row between"><span>Áudio até {a.seconds} s</span><span className="kz">{kz(a.kz)}</span></div>)}
            </div>
          </>
        )}

        {step === 4 && rec && (
          <>
            <span className="eyebrow">Passo 4 de 4 · {rec.mode === "overlay" ? "Overlay" : "Player"}</span>
            <h1>{rec.mode === "overlay" ? "Liga o overlay e faz um teste" : "Abre o Player e faz um teste"}</h1>
            <p className="muted">{rec.how}</p>
            {rec.mode === "overlay" ? (
              <div className="card stack" style={{ gap: 10 }}>
                <span className="eyebrow">O teu link secreto do overlay</span>
                <div className="row" style={{ gap: 8 }}>
                  <span className="mono grow" style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis" }}>fedha.live/o/8F3A2C71E6…</span>
                  <button className="btn dark sm" onClick={() => { copy("https://fedha.live/o/8F3A2C71E6"); toast.show("Link copiado"); }}>Copiar</button>
                </div>
                <p className="hint">Não mostres este link na live: quem o tiver vê os teus alertas.</p>
              </div>
            ) : (
              <div className="card"><b>painel.fedha.live/player</b><p className="hint">Abre num telemóvel ou tablet ligado a uma coluna Bluetooth.</p></div>
            )}
            <button className="btn block" onClick={() => { setTested(true); toast.show("Alerta de teste enviado"); }}>Enviar alerta de teste</button>
            {tested && <div className="aviso info">Viste e ouviste o alerta? Se não, confirma que o volume da fonte está ligado no programa de transmissão.</div>}
          </>
        )}
      </main>
      <footer className="pub-foot">
        <RouteButton disabled={step === 2 && !rec} onClick={next}>Continuar</RouteButton>
        <button className="link" style={{ alignSelf: "center", fontSize: 14 }} onClick={() => nav("/painel")}>Saltar por agora</button>
      </footer>
      {toast.node}
    </div>
  );
}
