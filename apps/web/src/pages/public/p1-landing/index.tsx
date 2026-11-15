import { Link } from "react-router-dom";
import { Logo, Wave } from "../../../shared/ui";
import { CyclingTalao } from "../../../layouts";

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
      {/* Telemóvel (design mobile 01): abertura com o símbolo e as duas ações. */}
      <section className="m-only land-intro">
        <div className="grow stack" style={{ justifyContent: "center", gap: 18 }}>
          <span className="land-sym big" aria-hidden />
          <p className="land-word"><b>Fedha</b> LIVE</p>
          <p style={{ fontSize: 21, fontWeight: 300, color: "rgba(255,255,255,.9)" }}>Dinheiro que se ouve.</p>
          <Wave n={14} />
        </div>
        <div className="stack" style={{ gap: 12 }}>
          <Link className="btn-route sinal" to="/auth/registo"><span className="label">Criar conta de streamer</span><span className="dot" /></Link>
          <Link className="btn ghost-light block" style={{ height: 52 }} to="/auth/entrar">Entrar</Link>
          <p style={{ textAlign: "center", fontSize: 13, color: "rgba(255,255,255,.8)", lineHeight: 1.5 }}>És espectador? Abre o link que o streamer partilhou na live.</p>
        </div>
      </section>
      <div className="d-only">
      <section className="land-hero">
        <div className="inner">
          <div className="row between">
            <Logo />
            <nav className="row" style={{ gap: 26, fontSize: 14.5 }}>
              <a className="hide-m" href="#como" style={{ color: "var(--branco)", textDecoration: "none" }}>Como funciona</a>
              <a className="hide-m" href="#apps" style={{ color: "var(--branco)", textDecoration: "none" }}>Para streamers</a>
              <a className="hide-m" href="#como" style={{ color: "var(--branco)", textDecoration: "none" }}>Preços</a>
              <Link className="hide-m" to="/auth/entrar" style={{ color: "var(--branco)", textDecoration: "none", fontWeight: 600 }}>Entrar</Link>
              <Link className="btn-route sinal sm" style={{ width: 150 }} to="/auth/registo"><span className="label">Criar conta</span><span className="dot" /></Link>
            </nav>
          </div>
          <div className="land-grid">
            <div>
              <p className="eyebrow" style={{ color: "var(--sinal)", marginTop: 56 }}>Para streamers de TikTok, YouTube e Instagram</p>
              <h1 style={{ marginTop: 18 }}>Dinheiro<br />que se ouve.</h1>
              <p style={{ maxWidth: 520, marginTop: 24, fontSize: 18, fontWeight: 300, lineHeight: 1.55, color: "rgba(255,255,255,.88)" }}>
                Os teus seguidores pagam em Kwanza e a mensagem aparece no ecrã da live, lida em voz alta. Sem app nova: funciona com o programa que já usas.
              </p>
              <div className="row" style={{ gap: 12, marginTop: 32, flexWrap: "wrap" }}>
                <Link className="btn-route sinal" style={{ width: 290 }} to="/auth/registo"><span className="label">Criar conta de streamer</span><span className="dot" /></Link>
                <Link className="btn ghost-light" style={{ height: 52, padding: "0 44px" }} to="/auth/entrar">Entrar</Link>
              </div>
              <div className="chips" style={{ marginTop: 22 }}>
                {["TikTok", "YouTube", "Instagram", "Kick", "Twitch", "Facebook"].map((p) => <span key={p} className="chip word" style={{ background: "transparent", border: "1px solid rgba(255,255,255,.35)", color: "var(--branco)" }}>{p}</span>)}
              </div>
            </div>
            <div className="land-card hide-m">
              <div className="row" style={{ gap: 14 }}>
                <span className="land-sym" aria-hidden />
                <div><small style={{ color: "rgba(255,255,255,.75)" }}>A tocar agora</small><br /><b>Kiami Gamer · TikTok LIVE</b></div>
              </div>
              <div style={{ color: "var(--tinta)" }}><CyclingTalao /></div>
              <div className="row" style={{ gap: 12, fontSize: 13 }}><Wave n={9} /> 38 lives a receber mensagens agora</div>
            </div>
          </div>
        </div>
      </section>

      <section className="land-sec" id="como">
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

      <section className="land-sec" id="apps" style={{ paddingTop: 0 }}>
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
    </div>
  );
}
