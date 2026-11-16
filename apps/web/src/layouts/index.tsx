import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import {
  Activity, AlertTriangle, ArrowLeftRight, Banknote, Bell, Flag, Globe, Grid2x2, History, KeyRound, Layers, LayoutDashboard,
  LifeBuoy, ListMusic, LiveBadge, Logo, Menu, Scale, Settings, ShieldAlert, ShieldCheck, Speaker, Store, Tags, Talao, Target,
  Undo2, UserCog, Users, Wallet, Wave, X, Check, haptic, type LucideIcon,
} from "../shared/ui";
import { PLATFORM_LABEL, queue, streamer } from "../shared/mocks/data";

/** Mensagens a subir em ciclo (página inicial e login). */
export function CyclingTalao() {
  const [i, setI] = useState(0);
  useEffect(() => { const t = setInterval(() => setI((n) => (n + 1) % 5), 3200); return () => clearInterval(t); }, []);
  const m = queue[i]!;
  return <div key={i} style={{ animation: "fl-in .4s" }}><Talao tone="sinal" name={m.donor} text={m.text} value={m.kz} /></div>;
}

type NavItem = { to: string; label: string; icon: LucideIcon; n?: number; end?: boolean };
type NavGroup = { title?: string; items: NavItem[] };

const STREAMER_NAV: NavGroup[] = [
  { items: [{ to: "/painel", label: "Dashboard", icon: LayoutDashboard, end: true }] },
  { title: "Ao vivo", items: [{ to: "/painel/fila", label: "Fila", icon: ListMusic, n: 5 }, { to: "/painel/player", label: "Player", icon: Speaker }] },
  { title: "Preparar", items: [
    { to: "/painel/pagina", label: "Página pública", icon: Globe },
    { to: "/painel/precos", label: "Preços e filtros", icon: Tags },
    { to: "/painel/widgets", label: "Widgets", icon: Layers },
    { to: "/painel/metas", label: "Metas", icon: Target },
  ] },
  { title: "Dinheiro", items: [{ to: "/painel/carteira", label: "Carteira", icon: Wallet }, { to: "/painel/historico", label: "Histórico", icon: History }] },
  { title: "Conta", items: [{ to: "/painel/assistentes", label: "Assistentes", icon: Users }, { to: "/painel/conta", label: "Conta", icon: UserCog }] },
];

const ADMIN_NAV: NavGroup[] = [
  { items: [{ to: "/admin", label: "Visão geral", icon: Activity, end: true }] },
  { title: "Operações", items: [{ to: "/admin/transacoes", label: "Transações", icon: ArrowLeftRight }, { to: "/admin/falhas", label: "Falhas técnicas", icon: AlertTriangle, n: 3 }, { to: "/admin/suporte", label: "Suporte", icon: LifeBuoy }] },
  { title: "Finanças", items: [{ to: "/admin/levantamentos", label: "Levantamentos", icon: Banknote, n: 4 }, { to: "/admin/reembolsos", label: "Reembolsos", icon: Undo2 }, { to: "/admin/reconciliacao", label: "Reconciliação", icon: Scale }] },
  { title: "Compliance", items: [{ to: "/admin/verificacoes", label: "Verificações", icon: ShieldCheck, n: 7 }, { to: "/admin/streamers", label: "Streamers", icon: Store }, { to: "/admin/antifraude", label: "Antifraude", icon: ShieldAlert }, { to: "/admin/moderacao", label: "Moderação", icon: Flag }] },
  { title: "Super admin", items: [{ to: "/admin/papeis", label: "Papéis", icon: KeyRound }, { to: "/admin/configuracoes", label: "Configurações", icon: Settings }] },
];

/** Barra de separadores no telemóvel (comportamento de app nativa): 4 destinos + "Mais" abre o menu completo. */
const STREAMER_TABS: NavItem[] = [
  { to: "/painel", label: "Início", icon: LayoutDashboard, end: true },
  { to: "/painel/fila", label: "Fila", icon: ListMusic, n: 5 },
  { to: "/painel/player", label: "Player", icon: Speaker },
  { to: "/painel/carteira", label: "Carteira", icon: Wallet },
];
const ADMIN_TABS: NavItem[] = [
  { to: "/admin", label: "Geral", icon: Activity, end: true },
  { to: "/admin/transacoes", label: "Transações", icon: ArrowLeftRight },
  { to: "/admin/levantamentos", label: "Saídas", icon: Banknote, n: 4 },
  { to: "/admin/verificacoes", label: "KYC", icon: ShieldCheck, n: 7 },
];

const MenuContext = createContext<{ open: () => void; admin: boolean }>({ open: () => {}, admin: false });

function Shell({ nav, tabs, head, foot, admin = false }: { nav: NavGroup[]; tabs: NavItem[]; head: ReactNode; foot: ReactNode; admin?: boolean }) {
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => { setOpen(false); window.scrollTo({ top: 0 }); }, [loc.pathname]);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", k);
    document.body.classList.add("no-scroll");
    return () => { window.removeEventListener("keydown", k); document.body.classList.remove("no-scroll"); };
  }, [open]);
  const openMenu = () => { haptic(8); setOpen(true); };
  return (
    <div className={open ? "shell open" : "shell"}>
      <div className="scrim" aria-hidden onClick={() => setOpen(false)} />
      <aside className="side">
        <div className="side-head">
          {head}
          <button className="side-x" aria-label="Fechar menu" onClick={() => setOpen(false)}><X size={20} /></button>
        </div>
        <nav aria-label="Navegação principal">
          {nav.map((g, gi) => (
            <div key={gi} className="grp">
              {g.title && <span className="grp-t">{g.title}</span>}
              {g.items.map((i) => (
                <NavLink key={i.to} to={i.to} end={i.end}>
                  <i.icon className="ni" size={18} strokeWidth={1.9} aria-hidden />
                  <span className="grow">{i.label}</span>
                  {i.n ? <span className="n">{i.n}</span> : null}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        {foot}
      </aside>
      <div className="content">
        <MenuContext.Provider value={{ open: openMenu, admin }}>
          <div key={loc.pathname} className="route-in">
            <Outlet />
          </div>
        </MenuContext.Provider>
      </div>
      <nav className="tabbar" aria-label="Separadores">
        {tabs.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end} onClick={() => haptic(6)}>
            <span className="ti"><t.icon size={22} strokeWidth={1.9} aria-hidden />{t.n ? <b className="badge">{t.n}</b> : null}</span>
            <span>{t.label}</span>
          </NavLink>
        ))}
        <button type="button" onClick={openMenu} className={open ? "active" : ""}>
          <span className="ti"><Grid2x2 size={22} strokeWidth={1.9} aria-hidden /></span>
          <span>Mais</span>
        </button>
      </nav>
    </div>
  );
}

/** Barra de topo: título e subtítulo à esquerda, ações, estado "Ao vivo" e avisos à direita. */
export function Topbar({ title, sub, mtitle, mActions = true, children }: { title: string; sub?: ReactNode; mtitle?: string; mActions?: boolean; children?: ReactNode }) {
  const { open, admin } = useContext(MenuContext);
  const now = new Date().toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Luanda" });
  return (
    <>
    {/* Telemóvel: barra verde com o título, "Ao vivo" e o menu à direita (design mobile 08/23). */}
    <header className="mbar">
      <b>{mtitle ?? title}</b>
      {!admin && streamer.live && <LiveBadge />}
      <button className="mburger" aria-label="Abrir menu" onClick={open}>
        <Menu size={22} aria-hidden />
      </button>
    </header>
    {mActions && children && <div className="m-actions">{children}</div>}
    <header className="topbar">
      <button className="burger" aria-label="Abrir menu" onClick={open}>
        <Menu size={22} aria-hidden />
      </button>
      <div className="tb-title">
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      <div className="tb-actions">{children}</div>
      {admin ? (
        <span className="mono muted hide-m" style={{ fontSize: 12 }}>Hora de Luanda · {now}</span>
      ) : (
        <div className="tb-status hide-m">
          {streamer.live && <LiveBadge>Ao vivo · {PLATFORM_LABEL[streamer.platform]}</LiveBadge>}
          <Link to="/painel/conta?avisos=1" className="avisos"><Bell size={15} aria-hidden />Avisos <span>2</span></Link>
        </div>
      )}
    </header>
    </>
  );
}

export function StreamerLayout() {
  return (
    <Shell
      nav={STREAMER_NAV}
      tabs={STREAMER_TABS}
      head={<Logo to="/painel" />}
      foot={
        <div className="who">
          <span className="avatar">KG</span>
          <div><b>{streamer.name}</b><small>{streamer.verified ? "Conta verificada" : "Por verificar"}</small></div>
        </div>
      }
    />
  );
}

export function AdminLayout() {
  return (
    <Shell
      admin
      nav={ADMIN_NAV}
      tabs={ADMIN_TABS}
      head={<Link to="/admin" className="logo"><b>Fedha</b><span>ADMIN</span></Link>}
      foot={<div className="who" style={{ display: "block" }}><b>Marta Sebastião</b><small>Papel · Finanças</small></div>}
    />
  );
}

/* ------------------------------------------------------------------ Registo: painel verde com os 5 passos */

export const SIGNUP_STEPS = [
  { key: "conta", label: "Conta", to: "/auth/registo" },
  { key: "telemovel", label: "Telemóvel", to: "/auth/verificar" },
  { key: "link", label: "Link", to: "/auth/link" },
  { key: "plataformas", label: "Plataformas", to: "/boas-vindas" },
  { key: "identidade", label: "Identidade", to: "/verificacao" },
] as const;

/** Layout de duas colunas: painel verde com título, texto e passos clicáveis; formulário à direita. */
export function StepsLayout({ step, title, text, foot, headLink, children }: { step?: number; title: ReactNode; text: ReactNode; foot?: ReactNode; headLink?: ReactNode; children: ReactNode }) {
  return (
    <div className="auth">
      <aside className="auth-side">
        <Logo to="/" />
        <div>
          <h2 className="auth-h">{title}</h2>
          <p className="auth-p">{text}</p>
          {step !== undefined && (
            <ol className="auth-steps">
              {SIGNUP_STEPS.map((s, i) => (
                <li key={s.key} className={i < step ? "done" : i === step ? "now" : ""}>
                  {i < step ? <Link to={s.to}><i aria-hidden><Check size={15} strokeWidth={3} /></i>{s.label}</Link> : <span><i aria-hidden>{i + 1}</i>{s.label}</span>}
                </li>
              ))}
            </ol>
          )}
        </div>
        <span />
      </aside>
      <div className="auth-right">
        <div className="auth-head"><Logo to="/" />{headLink}</div>
        {step !== undefined && (
          <div className="auth-steps-m">
            <div className="steps">{SIGNUP_STEPS.map((s, i) => <i key={s.key} className={i <= step ? "on" : ""} />)}</div>
            <span className="eyebrow">Passo {step + 1} de 5 · {SIGNUP_STEPS[step]!.label}</span>
          </div>
        )}
        <main className="auth-main">
          {children}
          {foot && <div className="auth-foot">{foot}</div>}
        </main>
      </div>
    </div>
  );
}

/** Login e recuperação: painel verde com a mensagem da marca. */
export function AuthLayout() {
  return (
    <div className="auth">
      <aside className="auth-side">
        <Logo to="/" />
        <div>
          <p style={{ fontSize: 52, fontWeight: 300, letterSpacing: "-0.04em", lineHeight: 1.05 }}>Dinheiro<br />que se ouve.</p>
          <div style={{ marginTop: 32, maxWidth: 420, color: "var(--tinta)" }}><CyclingTalao /></div>
        </div>
        <div className="row" style={{ gap: 12, fontSize: 13 }}><Wave n={8} /> 38 lives a receber mensagens agora</div>
      </aside>
      <div className="auth-right">
        <div className="auth-head"><Logo to="/" /></div>
        <main className="auth-main"><Outlet /></main>
      </div>
    </div>
  );
}
