import { Link } from "react-router-dom";
import { Topbar } from "../../../layouts";
import { Stat, Talao, Tag, Banknote, Speaker, ArrowRight } from "../../../shared/ui";
import { goal, last14, queue, streamer, wallet } from "../../../shared/mocks/data";
import { kz } from "../../../shared/lib/format";
import { LinkBox } from "../../../features/queue/LinkBox";

/** S1 — Dashboard (mockups E1 e E2). */
export default function Dashboard() {
  const max = Math.max(...last14.flat());
  const pct = Math.round((goal.current / goal.target) * 100);
  const recent = queue.filter((q) => q.status !== "na_fila").concat(queue.filter((q) => q.status === "na_fila")).slice(0, 4);
  return (
    <>
      <Topbar mtitle="Painel" mActions={false} title={`Olá, ${streamer.name.split(" ")[0]}`} sub={`${new Date().toLocaleDateString("pt-PT", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })} · hora de Luanda`}>
        <LinkBox />
        <Link className="btn hide-m" to="/painel/player"><Speaker aria-hidden />Abrir Player</Link>
      </Topbar>
      <div className="page">
        {/* Telemóvel (design mobile 08): resumo 2×2, levantar, meta e as duas últimas mensagens. */}
        <div className="m-only m-dash">
          <h1 className="page-h">Olá, {streamer.name.split(" ")[0]}</h1>
          <div className="m-grid">
            <Link to="/painel/historico" className="card stat"><div className="eyebrow">Hoje</div><div className="big">{kz(38500)}</div></Link>
            <Link to="/painel/carteira" className="card stat verde"><div className="eyebrow">Disponível</div><div className="big">{kz(wallet.available)}</div></Link>
            <Link to="/painel/carteira" className="card stat"><div className="eyebrow">Pendente</div><div className="big">{kz(wallet.pending)}</div></Link>
            <Link to="/painel/historico" className="card stat"><div className="eyebrow">Semana</div><div className="big">{kz(186000)}</div></Link>
          </div>
          <Link to="/painel/carteira" className="btn-route"><span className="label">Levantar</span><span className="dot" aria-hidden><ArrowRight strokeWidth={2.4} /></span></Link>
          <Link to="/painel/metas" className="card" style={{ display: "block", color: "inherit", textDecoration: "none" }}>
            <div className="row between"><b style={{ fontSize: 14 }}>{goal.title}</b><span className="mono muted" style={{ fontSize: 11 }}>{pct}%</span></div>
            <div className="meter" style={{ marginTop: 10, height: 20 }}>{Array.from({ length: 36 }, (_, i) => <i key={i} className={i < (pct / 100) * 36 ? "on" : ""} style={{ height: `${40 + ((i * 41) % 60)}%` }} />)}</div>
            <div className="mono" style={{ fontSize: 12, marginTop: 8 }}>{kz(goal.current, false)} / {kz(goal.target)}</div>
          </Link>
          {recent.slice(0, 2).map((m) => <Talao key={m.id} name={m.donor} text={m.text} value={m.kz} />)}
          <div className="m-sticky"><LinkBox mobile /></div>
        </div>
        <div className="grid g4 d-only">
          <Stat label="Hoje" value={38500} sub={`21 mensagens · líquido ${kz(34650)}`} />
          <Stat label="Esta semana" value={186000} sub="+12% que a anterior" />
          <Stat label="Disponível" value={wallet.available} tone="verde">
            <div className="row between" style={{ marginTop: 8 }}>
              <span className="sub" style={{ marginTop: 0 }}>Pronto a levantar</span>
              <Link to="/painel/carteira" className="btn sm" style={{ background: "var(--sinal)", border: 0, color: "var(--tinta)" }}><Banknote aria-hidden />Levantar</Link>
            </div>
          </Stat>
          <Stat label="Pendente · 48 h" value={wallet.pending} sub={`Liberta ${wallet.releaseAt.replace("/2026", "")}`} />
        </div>

        <div className="split d-only" style={{ gridTemplateColumns: "minmax(0,1.5fr) minmax(0,1fr)" }}>
          <div className="card pad-l">
            <div className="row between"><h2>Recebido nos últimos 14 dias</h2><span className="mono muted" style={{ fontSize: 12 }}>Total {kz(642300)}</span></div>
            <div className="bars14" style={{ marginTop: 20 }} role="img" aria-label="Receitas por dia nos últimos 14 dias">
              {last14.map((d, i) => (
                <div key={i} className={i === 13 ? "today" : ""}>
                  <div className="trio">{d.map((v, k) => <i key={k} style={{ height: `${Math.max(2, (v / max) * 100)}%` }} />)}</div>
                  <small>{String(i + 1).padStart(2, "0")}/11</small>
                </div>
              ))}
            </div>
          </div>
          <div className="stack" style={{ gap: 16 }}>
            <div className="card pad-l">
              <div className="row between"><h2>Meta ativa</h2><Link to="/painel/metas">Ver metas</Link></div>
              <p style={{ marginTop: 10 }}>{goal.title}</p>
              <div className="meter" style={{ marginTop: 12, height: 22 }}>
                {Array.from({ length: 36 }, (_, i) => <i key={i} className={i < (pct / 100) * 36 ? "on" : ""} style={{ height: `${40 + ((i * 41) % 60)}%` }} />)}
              </div>
              <div className="row between mono" style={{ marginTop: 10, fontSize: 13 }}><span>{kz(goal.current, false)} / {kz(goal.target)}</span><span className="muted">{pct}%</span></div>
            </div>
            <div className="card pad-l">
              <div className="row between"><h2>Saídas para a live</h2><Link to="/painel/widgets">Widgets</Link></div>
              <div className="lines" style={{ marginTop: 8, fontSize: 14 }}>
                <div className="row between"><span>W1 Alerta · TikTok LIVE Studio</span><Tag tone="ok">Ligado</Tag></div>
                <div className="row between"><span>Player · telemóvel</span><Tag tone="ok">Ligado</Tag></div>
                <div className="row between"><span>W2 Meta</span><Tag tone="pend">A religar</Tag></div>
              </div>
            </div>
          </div>
        </div>

        <div className="row between d-only"><span className="eyebrow">Últimas mensagens</span><Link to="/painel/historico">Ver histórico</Link></div>
        <div className="grid g2 d-only">
          {recent.map((m) => (
            <Talao key={m.id} name={m.donor} text={m.text} value={m.kz} meta={<span className="mono muted" style={{ fontSize: 12 }}>{m.at}</span>}>
              {m.tags[0] && <Tag>{m.tags[0]}</Tag>}
            </Talao>
          ))}
        </div>
      </div>
    </>
  );
}
