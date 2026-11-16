import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { RouteButton, Volume, useToast, RotateCcw, Volume2, ChevronLeft } from "../../shared/ui";
import { queue } from "../../shared/mocks/data";
import { kz } from "../../shared/lib/format";

/**
 * Player só-áudio (S3, mockup B4). Plano B para quem transmite pela app nativa no telemóvel.
 * Recebe o mesmo AlertEvent do overlay e nunca toca ao mesmo tempo que ele.
 * O áudio vem do servidor (TTS gerado lá); aqui, sem API, a demonstração usa a voz do navegador.
 */
export function Player({ backTo, title = "Player" }: { backTo: string; title?: string }) {
  const [enabled, setEnabled] = useState(false);
  const [vol, setVol] = useState(75);
  const [wake, setWake] = useState(true);
  const [idx, setIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const toast = useToast();
  const items = queue.filter((q) => q.status !== "tocada");
  const cur = items[idx % items.length]!;
  const lock = useRef<{ release: () => Promise<void> } | null>(null);

  const say = (text: string) => {
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "pt-PT";
      u.volume = vol / 100;
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    } catch { /* sem TTS */ }
  };

  useEffect(() => {
    if (!enabled) return;
    setProgress(0);
    say(cur.kind === "audio" ? `Mensagem de voz de ${cur.donor}` : `${cur.donor} diz: ${cur.text}`);
    const t = setInterval(() => setProgress((p) => {
      if (p >= 100) { setIdx((i) => i + 1); return 0; }
      return p + 2;
    }), 120);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, idx]);

  useEffect(() => {
    if (!enabled || !wake) return;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
    nav.wakeLock?.request("screen").then((l) => { lock.current = l; }).catch(() => {});
    return () => { void lock.current?.release(); };
  }, [enabled, wake]);

  return (
    <div className="player">
      <div className="row between">
        <Link to={backTo} style={{ color: "var(--branco)", textDecoration: "none", fontWeight: 600, fontSize: 18, display: "inline-flex", alignItems: "center", gap: 4 }}><ChevronLeft size={22} aria-hidden />{title}</Link>
        <span className={enabled ? "tag ok" : "tag pend"}>{enabled ? "Ligado" : "Som desativado"}</span>
      </div>

      {!enabled ? (
        <>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 12 }}>
            <h1 style={{ fontSize: 32, lineHeight: 1.15 }}>Ativa o som para as mensagens tocarem</h1>
            <p style={{ fontWeight: 300, lineHeight: 1.5, color: "rgba(255,255,255,.85)" }}>O navegador só reproduz áudio depois de tocares no ecrã. {items.length} mensagens pagas estão à espera.</p>
          </div>
          <RouteButton tone="sinal" onClick={() => setEnabled(true)}>Ativar som</RouteButton>
          <button className="btn ghost-light block" onClick={() => say("Teste de som do Fedha Live.")}><Volume2 aria-hidden />Testar som</button>
          <p style={{ textAlign: "center", fontSize: 13, color: "rgba(255,255,255,.8)" }}>Usa o Player só se transmites pela app nativa. Com o overlay ligado, as mensagens tocam lá.</p>
        </>
      ) : (
        <>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 14 }} aria-live="polite">
            <span className="eyebrow" style={{ color: "rgba(255,255,255,.75)" }}>A tocar · voz padrão</span>
            <p style={{ fontSize: 26, lineHeight: 1.3 }}>{cur.kind === "audio" ? "Mensagem de voz" : `"${cur.text}"`}</p>
            <p><b>{cur.donor}</b> <span className="kz" style={{ marginLeft: 6 }}>{kz(cur.kz)}</span></p>
            <div className="bigbars" aria-hidden>
              {Array.from({ length: 30 }, (_, i) => <i key={i} style={{ animationDelay: `${(i * 113) % 900}ms`, height: `${30 + ((i * 47) % 70)}%` }} />)}
            </div>
            <div className="progress"><i style={{ width: `${progress}%` }} /></div>
          </div>
          <div className="panel">
            <Volume value={vol} onChange={setVol} dark />
            <div className="grid g2" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <button className="btn ghost-light" onClick={() => setIdx((i) => Math.max(0, i - 1))}><RotateCcw aria-hidden />Repetir a última</button>
              <button className="btn ghost-light" onClick={() => { say("Teste de som do Fedha Live."); toast.show("Som de teste a tocar"); }}><Volume2 aria-hidden />Testar som</button>
            </div>
            <label className="row between" style={{ fontSize: 14, borderTop: "1px solid rgba(255,255,255,.15)", paddingTop: 12 }}>
              Manter ecrã ligado
              <input type="checkbox" className="toggle" style={wake ? { background: "var(--sinal)" } : undefined} checked={wake} onChange={(e) => setWake(e.target.checked)} />
            </label>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,.8)" }}>O som sai pelo dispositivo Bluetooth ligado a este telemóvel.</p>
          </div>
        </>
      )}
      {toast.node}
    </div>
  );
}
