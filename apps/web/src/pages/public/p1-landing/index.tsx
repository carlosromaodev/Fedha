import { Link } from "react-router-dom";
import { Logo } from "../../../shared/ui";

const SCENARIOS = [
  { t: "PC com OBS ou Streamlabs", d: "Cola o link do overlay como Browser Source. YouTube, Twitch, Kick, Facebook e TikTok com stream key." },
  { t: "PC com TikTok LIVE Studio", d: "Adiciona o link como Link Source. A mensagem aparece e toca na live." },
  { t: "Telemóvel com PRISM ou CameraFi Live", d: "Adiciona o link como fonte web e transmite a partir do telemóvel." },
  { t: "Só a app no telemóvel", d: "Abre o Player noutro aparelho ou numa coluna: as mensagens tocam em voz alta." },
];

/** P1 — Página inicial. */
export default function Landing() {
  return (
    <div>
      <section className="land-hero">
        <div className="inner">
          <div className="row between">
            <Logo />
            <div className="row" style={{ gap: 8 }}>
              <Link className="btn ghost-light sm" to="/auth/entrar">Entrar</Link>
              <Link className="btn sm" style={{ background: "var(--sinal)", borderColor: "var(--sinal)" }} to="/auth/registo">Criar conta</Link>
            </div>
          </div>
          <h1>Dinheiro<br />que se ouve.</h1>
          <p style={{ maxWidth: 520, marginTop: 24, fontSize: 18, fontWeight: 300, lineHeight: 1.55, color: "rgba(255,255,255,.88)" }}>
            Os teus seguidores pagam em Kwanza e a mensagem aparece no ecrã e toca na tua live, seja qual for a app. Tu não aprovas nada: toca sozinha.
          </p>
          <div className="row" style={{ gap: 12, marginTop: 32, flexWrap: "wrap" }}>
            <Link className="btn-route sinal" style={{ width: 240 }} to="/auth/registo"><span className="label">Começar agora</span><span className="dot" /></Link>
            <Link className="btn ghost-light" to="/kiami">Ver uma página de exemplo</Link>
          </div>
        </div>
      </section>

      <section className="land-sec">
        <span className="eyebrow">Como funciona</span>
        <div className="land-steps" style={{ marginTop: 16 }}>
          {[
            ["01", "Partilha o teu link", "fedha.live/o-teu-nome na bio. O espectador escreve ou grava e vê o preço na hora."],
            ["02", "Paga em Kwanza", "Multicaixa Express ou Referência Multicaixa. Sem conta, sem cartão estrangeiro."],
            ["03", "Toca na live", "A mensagem entra na fila, aparece no ecrã e é lida em voz alta. 90% do valor é teu."],
          ].map(([n, t, d]) => (
            <div key={n} className="card pad-l stack" style={{ gap: 10 }}>
              <span className="n">{n}</span><h3 style={{ fontSize: 18 }}>{t}</h3><p className="muted" style={{ lineHeight: 1.5 }}>{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="land-sec" style={{ paddingTop: 0 }}>
        <span className="eyebrow">Um só link, qualquer app</span>
        <div className="grid g2" style={{ marginTop: 16 }}>
          {SCENARIOS.map((s) => (
            <div key={s.t} className="card"><b>{s.t}</b><p className="muted" style={{ marginTop: 6, lineHeight: 1.5 }}>{s.d}</p></div>
          ))}
        </div>
      </section>

      <footer className="land-sec row between" style={{ borderTop: "1px solid var(--linha)", fontSize: 13 }}>
        <span className="muted">© 2026 Fedha LIVE · Luanda</span>
        <Link to="/pedido" className="link">Consultar um pedido</Link>
      </footer>
    </div>
  );
}
