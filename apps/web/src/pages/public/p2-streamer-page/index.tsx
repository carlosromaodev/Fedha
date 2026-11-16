import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Field, LiveBadge, RouteButton, Tag, VoiceMeter, Wave, Logo } from "../../../shared/ui";
import { PLATFORM_LABEL, effects, pricing, queue, streamer, voices } from "../../../shared/mocks/data";
import { FILTER_MSG, checkMessage, priceText, textTier } from "../../../shared/lib/rules";
import { cx, kz, mmss } from "../../../shared/lib/format";
import { useDraft } from "../../../features/composer/store";

const MAX = 200;

/** P2 — Página do streamer e compositor (mockups A1, A2, A3, A8). */
export default function StreamerPage() {
  const nav = useNavigate();
  const { draft, update } = useDraft();
  const [mode, setMode] = useState<"text" | "audio">(draft.kind);
  const [name, setName] = useState(draft.name);
  const [anon, setAnon] = useState(draft.anonymous);
  const [text, setText] = useState(draft.text);
  const [voice, setVoice] = useState(draft.voice);
  const [effect, setEffect] = useState<string | null>(draft.effect);
  const [priority, setPriority] = useState(draft.extras.priority);
  const [touched, setTouched] = useState(false);
  const playing = queue.find((q) => q.status === "a_tocar")!;
  const waiting = queue.filter((q) => q.status === "na_fila").length;

  const premium = voices.find((v) => v.id === voice)?.premium ?? false;
  const hit = useMemo(() => checkMessage(text), [text]);
  const price = priceText(text.length, { premiumVoice: premium, effect: !!effect, priority });
  const tier = text.length ? textTier(text.length) : null;
  const nameError = touched && !anon && name.trim().length < 2 ? "Escreve o teu nome ou envia como anónimo." : null;
  const textError = hit ? FILTER_MSG[hit.kind] : touched && text.trim().length === 0 ? "Escreve a mensagem." : null;

  // Áudio
  const audio = useRecorder();
  const [audioTier, setAudioTier] = useState(draft.audioTier || 20);
  const audioPrice = pricing.audio.find((a) => a.seconds === audioTier)!.kz;

  const canText = !hit && text.trim().length > 0 && (anon || name.trim().length >= 2);
  const canAudio = audio.seconds > 0 && !audio.recording && (anon || name.trim().length >= 2);

  const go = () => {
    setTouched(true);
    if (mode === "text" && !canText) return;
    if (mode === "audio" && !canAudio) return;
    const lines = mode === "text" ? price.lines : [{ label: `Áudio até ${audioTier} s · ${mmss(audio.seconds)}`, kz: audioPrice }, ...(priority ? [{ label: "Prioridade na fila", kz: pricing.extras.priority }] : [])];
    update({
      name: anon ? "Anónimo" : name.trim(), anonymous: anon, kind: mode, text, voice, effect,
      audioSeconds: audio.seconds, audioTier,
      extras: { premiumVoice: premium, effect: !!effect, priority }, lines, total: lines.reduce((s, l) => s + l.kz, 0),
    });
    nav(`/${streamer.handle}/pagar`);
  };

  const errorCount = [nameError, mode === "text" ? textError : audio.seconds ? null : "sem áudio"].filter(Boolean).length;
  const total = mode === "text" ? price.total : audioPrice + (priority ? pricing.extras.priority : 0);

  return (
    <div className="pub sp-wrap">
      <header className="sp-head">
        <Logo />
        <nav className="row d-only" style={{ gap: 18, fontSize: 14 }}>
          <a href="/#como" style={{ color: "var(--branco)", textDecoration: "none" }}>Como funciona</a>
          <a href="/auth/registo" className="btn ghost-light sm">Sou streamer</a>
        </nav>
        <span className="row m-only m-who"><span className="avatar" style={{ width: 24, height: 24, fontSize: 9 }}>KG</span><b>{streamer.name}</b>{streamer.live && <i className="live-dot" aria-label="Ao vivo" />}</span>
      </header>
      <div className="sp-grid">
        <section className="sp-profile">
          <div className="row" style={{ gap: 14 }}>
            <span className="avatar l sp-av">KG</span>
            <div>
              <h1 className="sp-name">{streamer.name}</h1>
              <div className="row" style={{ gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                <Tag>{PLATFORM_LABEL[streamer.platform]} live</Tag>
                {streamer.live ? <LiveBadge /> : <Tag>Offline</Tag>}
                <span className="mono muted" style={{ fontSize: 12 }}>{streamer.viewers} · 01:42:10</span>
              </div>
            </div>
          </div>
          <p className="muted light sp-bio d-only" style={{ marginTop: 12, fontSize: 14, lineHeight: 1.5 }}>{streamer.bio}</p>

          <div className="card verde" style={{ marginTop: 16 }} aria-live="polite">
            <div className="row between">
              <span className="eyebrow" style={{ color: "rgba(255,255,255,.8)" }}>A tocar agora na live</span>
              <span className="kz" style={{ fontSize: 13 }}>{kz(playing.kz)}</span>
            </div>
            <div className="row" style={{ gap: 10, marginTop: 10 }}><Wave n={8} /><b>{playing.donor}</b></div>
            <p style={{ marginTop: 8, fontSize: 16, lineHeight: 1.4 }}>"{playing.text}"</p>
            <div className="progress" style={{ marginTop: 14 }}><i style={{ width: "24%" }} /></div>
            <p style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,.15)", fontSize: 13 }}>
              {waiting} na fila · a tua toca em cerca de {Math.max(1, Math.round(waiting * 0.4))} min
            </p>
          </div>
          <div className="sp-next d-only">
            <span className="eyebrow">A seguir na live</span>
            {queue.filter((q) => q.status === "na_fila").slice(0, 3).map((m, i) => (
              <div key={m.id} className="row" style={{ gap: 12, padding: "14px 16px", fontSize: 14 }}>
                <span className="mono muted" style={{ fontSize: 12 }}>{i + 1}</span>
                <b style={{ fontWeight: 600 }}>{m.donor}</b>
                {m.tags[0] && <Tag>{m.tags[0].split(" ")[0]}</Tag>}
                <span className="muted" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.kind === "audio" ? `Mensagem de voz · 00:${m.seconds}` : m.text}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="sp-compose stack" style={{ gap: 12 }}>
          {touched && errorCount > 0 && (
            <div className="aviso erro" role="alert">Corrige {errorCount} {errorCount > 1 ? "campos" : "campo"} para continuar.</div>
          )}
          <div className="seg" role="tablist">
            <button role="tab" aria-selected={mode === "text"} className={mode === "text" ? "on" : ""} onClick={() => setMode("text")}>Texto</button>
            <button role="tab" aria-selected={mode === "audio"} className={mode === "audio" ? "on" : ""} onClick={() => setMode("audio")}>Áudio gravado</button>
          </div>

          <Field label="O teu nome" error={nameError} aside={
            <span className="row" style={{ gap: 8, whiteSpace: "nowrap", textTransform: "none", letterSpacing: 0, fontFamily: "var(--font)", fontSize: 13, color: "var(--tinta-2)" }}>
              Enviar como anónimo <input type="checkbox" className="selo" checked={anon} onChange={(e) => setAnon(e.target.checked)} />
            </span>
          }>
            <input value={anon ? "Anónimo" : name} disabled={anon} maxLength={30} onChange={(e) => setName(e.target.value)} placeholder="Como queres aparecer" autoComplete="nickname" />
          </Field>

          {mode === "text" ? (
            <>
              <Field label="Mensagem" aside={`${text.length}/${MAX}`} error={textError} ok={!!text && !hit}
                hint="Links, emails e números de telefone são bloqueados antes de pagares.">
                <textarea value={text} maxLength={MAX} onChange={(e) => setText(e.target.value)} placeholder="Escreve o que queres que toque na live" />
              </Field>
              <div className={hit ? "meter-bad" : ""}>
                <VoiceMeter ratio={text.length / MAX} bars={44} />
                <div className="sp-tiers">
                  {pricing.text.map((t) => (
                    <div key={t.max} className={cx(tier === t && "on")}>
                      <span className="kz">{kz(t.kz)}</span>
                      <small>{t.min}–{t.max}{t.max === 200 ? " caracteres" : ""}</small>
                    </div>
                  ))}
                </div>
              </div>

              <button className="sp-listen" onClick={() => speak(text || "Escreve a mensagem para ouvires como vai soar.")}>
                <span className="play" aria-hidden>▶</span>
                <span className="grow" style={{ textAlign: "left" }}>Ouvir como vai soar</span>
                <Wave n={14} tone="verde" still />
              </button>

              <div className="card sp-extras">
                <label className="sp-x">
                  <input type="checkbox" className="selo" checked={premium} onChange={(e) => setVoice(e.target.checked ? "ngola" : "nzinga")} />
                  <span className="grow"><b>Voz premium</b><small>Voz mais natural</small></span>
                  <span className="kz">+{kz(pricing.extras.premiumVoice)}</span>
                </label>
                <label className="sp-x">
                  <input type="checkbox" className="selo" checked={!!effect} onChange={(e) => setEffect(e.target.checked ? effects[0]!.id : null)} />
                  <span className="grow"><b>Efeito sonoro</b><small>Toca antes da mensagem</small></span>
                  <span className="kz">+{kz(pricing.extras.effect)}</span>
                </label>
                {effect && (
                  <div className="sp-fx" role="radiogroup" aria-label="Efeito">
                    {effects.slice(0, 2).map((fx) => (
                      <label key={fx.id} className="row" style={{ gap: 10 }}>
                        <input type="radio" name="fx" className="selo round" checked={effect === fx.id} onChange={() => setEffect(fx.id)} />
                        <span className="grow">{fx.name} <small className="muted">1 s</small></span>
                        <button type="button" className="row link" style={{ gap: 6, textDecoration: "none", color: "var(--tinta)" }} onClick={() => speak(fx.name)}><span className="play-mini" style={{ width: 22, height: 22, fontSize: 8, background: "var(--tinta)" }}>▶</span>Ouvir exemplo</button>
                      </label>
                    ))}
                  </div>
                )}
                <label className="sp-x">
                  <input type="checkbox" className="selo" checked={priority} onChange={(e) => setPriority(e.target.checked)} />
                  <span className="grow"><b>Prioridade</b><small>Passa à frente na fila</small></span>
                  <span className="kz">+{kz(pricing.extras.priority)}</span>
                </label>
              </div>
            </>
          ) : (
            <AudioComposer rec={audio} tier={audioTier} setTier={setAudioTier} />
          )}
        </section>
      </div>

      <footer className="pub-foot sp-foot">
        <div className="row between" style={{ gap: 16 }}>
          <div>
            <small className="muted" style={{ fontSize: 12 }}>
              {mode === "text" && hit ? "Mensagem inválida" : mode === "text"
                ? price.lines.filter((l) => l.kz).map((l) => l.label.split(" · ")[0]).join(" + ") || "Texto a partir de " + kz(500)
                : `Áudio até ${audioTier} s`}
            </small>
            <div className="kz" style={{ fontSize: 22, color: mode === "text" && hit ? "var(--tinta-3)" : undefined }}>{mode === "text" && hit ? "— Kz" : kz(total)}</div>
          </div>
          <div style={{ width: 170 }}>
            <RouteButton onClick={go} disabled={mode === "text" ? !canText && touched : !canAudio}>Continuar</RouteButton>
          </div>
        </div>
      </footer>
    </div>
  );
}

function speak(text: string) {
  // Pré-escuta local. Na live, o TTS é gerado no servidor (ver docs/outputs).
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "pt-PT";
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch { /* sem TTS no navegador */ }
}

function useRecorder() {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mr = useRef<MediaRecorder | null>(null);
  const timer = useRef<number>();
  const limit = useRef(20);

  const stop = () => {
    window.clearInterval(timer.current);
    if (mr.current && mr.current.state !== "inactive") mr.current.stop();
    setRecording(false);
  };
  const start = async (max: number) => {
    setError(null); setUrl(null); setSeconds(0); limit.current = max;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = () => { setUrl(URL.createObjectURL(new Blob(chunks, { type: rec.mimeType }))); stream.getTracks().forEach((t) => t.stop()); };
      rec.start();
      mr.current = rec;
      setRecording(true);
      const t0 = Date.now();
      timer.current = window.setInterval(() => {
        const s = (Date.now() - t0) / 1000;
        setSeconds(Math.min(s, limit.current));
        if (s >= limit.current) stop();
      }, 200);
    } catch {
      setError("Não foi possível usar o microfone. Dá permissão no navegador e tenta de novo.");
    }
  };
  const clear = () => { stop(); setSeconds(0); setUrl(null); };
  useEffect(() => () => window.clearInterval(timer.current), []);
  return { recording, seconds, url, error, start, stop, clear };
}

function AudioComposer({ rec, tier, setTier }: { rec: ReturnType<typeof useRecorder>; tier: number; setTier: (n: number) => void }) {
  return (
    <>
      <div className="eyebrow">1 · Escolhe a duração máxima</div>
      <div className="grid g3" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
        {pricing.audio.map((a) => (
          <button key={a.seconds} className={cx("sp-tierbtn", tier === a.seconds && "on")} onClick={() => { rec.clear(); setTier(a.seconds); }}>
            <b>{a.seconds} s</b><span className="kz">{kz(a.kz)}</span>
          </button>
        ))}
      </div>
      <div className="eyebrow" style={{ marginTop: 6 }}>2 · Grava</div>
      <div className="card stack" style={{ gap: 14 }}>
        <div className="sp-bigwave" aria-hidden>
          {Array.from({ length: 34 }, (_, i) => (
            <i key={i} style={{ height: `${rec.recording || rec.seconds ? 20 + ((i * 47) % 80) : 8}%`, animationDelay: `${(i * 97) % 800}ms` }} className={rec.recording ? "rec" : ""} />
          ))}
        </div>
        <div className="row between">
          <span className="row" style={{ gap: 10 }}>
            {rec.recording ? <span className="live">A gravar</span> : rec.seconds ? <span className="tag ok">Gravado</span> : <span className="tag">Pronto</span>}
            <span className="mono">{mmss(rec.seconds)}</span>
          </span>
          <span className="mono muted" style={{ fontSize: 12 }}>máx. {mmss(tier)}</span>
        </div>
        <div className="progress claro"><i style={{ width: `${(rec.seconds / tier) * 100}%` }} /></div>
        <div className="row" style={{ justifyContent: "center", gap: 20 }}>
          <button className="sp-round" onClick={rec.clear} disabled={!rec.seconds}>Apagar</button>
          <button className="sp-rec" aria-label={rec.recording ? "Parar gravação" : "Começar a gravar"} onClick={() => (rec.recording ? rec.stop() : rec.start(tier))}>
            <i className={rec.recording ? "stop" : "dot"} />
          </button>
          <button className="sp-round" disabled={!rec.url} onClick={() => rec.url && new Audio(rec.url).play()}>Ouvir</button>
        </div>
      </div>
      {rec.error && <p className="hint erro">{rec.error}</p>}
      <p className="muted" style={{ fontSize: 13, lineHeight: 1.5 }}>
        O navegador vai pedir acesso ao microfone. O áudio toca na live logo após o pagamento e não pode ser cancelado.
      </p>
    </>
  );
}
