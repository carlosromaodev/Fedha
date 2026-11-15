import { createContext, useContext, useState, type ReactNode } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Logo, Talao, Wave } from "../shared/ui";
import { queue, streamer } from "../shared/mocks/data";
import { useEffect } from "react";

/** Mensagens a subir em ciclo (mockup F5). */
function CyclingTalao() {
  const [i, setI] = useState(0);
  useEffect(() => { const t = setInterval(() => setI((n) => (n + 1) % 5), 3200); return () => clearInterval(t); }, []);
  const m = queue[i]!;
  return <div key={i} style={{ animation: "fl-in .4s" }}><Talao tone="sinal" name={m.donor} text={m.text} value={m.kz} /></div>;
}

const STREAMER_NAV = [
  { to: "/painel", label: "Dashboard", end: true },
  { to: "/painel/fila", label: "Fila", n: 4 },
  { to: "/painel/overlay", label: "Overlay e alertas" },
  { to: "/painel/player", label: "Player só-áudio" },
  { to: "/painel/historico", label: "Histórico" },
  { to: "/painel/carteira", label: "Carteira" },
  { to: "/painel/metas", label: "Metas" },
  { to: "/painel/pagina", label: "Página pública" },
  { to: "/painel/precos", label: "Preços" },
  { to: "/painel/filtros", label: "Filtros" },
  { to: "/painel/assistentes", label: "Assistentes", n: 2 },
  { to: "/painel/notificacoes", label: "Notificações" },
  { to: "/painel/conta", label: "Conta" },
  { to: "/painel/ajuda", label: "Ajuda" },
];

const ADMIN_NAV = [
  { to: "/admin", label: "Visão geral", end: true },
  { to: "/admin/transacoes", label: "Transações" },
  { to: "/admin/falhas", label: "Falhas técnicas", n: 3 },
  { to: "/admin/levantamentos", label: "Levantamentos", n: 4 },
  { to: "/admin/streamers", label: "Streamers" },
  { to: "/admin/verificacoes", label: "Verificações", n: 3 },
  { to: "/admin/reconciliacao", label: "Reconciliação" },
  { to: "/admin/antifraude", label: "Antifraude" },
  { to: "/admin/moderacao", label: "Moderação global" },
  { to: "/admin/configuracoes", label: "Configurações" },
  { to: "/admin/suporte", label: "Suporte" },
  { to: "/admin/papeis", label: "Papéis e auditoria" },
];

type NavItem = { to: string; label: string; n?: number; end?: boolean };

function Shell({ nav, head, foot }: { nav: NavItem[]; head: ReactNode; foot: ReactNode }) {
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  return (
    <div className={open ? "shell open" : "shell"} key={loc.pathname} onClick={(e) => { if (open && (e.target as HTMLElement).classList.contains("shell")) setOpen(false); }}>
      <aside className="side">
        {head}
        <nav aria-label="Navegação principal">
          {nav.map((i) => (
            <NavLink key={i.to} to={i.to} end={i.end} onClick={() => setOpen(false)}>
              <span>{i.label}</span>
              {i.n ? <span className="n">{i.n}</span> : null}
            </NavLink>
          ))}
        </nav>
        {foot}
      </aside>
      <div className="content">
        <MenuContext.Provider value={() => setOpen(true)}>
          <Outlet />
        </MenuContext.Provider>
      </div>
    </div>
  );
}

const MenuContext = createContext<() => void>(() => {});

export function Topbar({ title, children }: { title: string; children?: ReactNode }) {
  const openMenu = useContext(MenuContext);
  return (
    <header className="topbar">
      <button className="burger" aria-label="Abrir menu" onClick={openMenu}>
        <svg width="20" height="14" viewBox="0 0 20 14" aria-hidden><path d="M0 1h20M0 7h20M0 13h20" stroke="currentColor" strokeWidth="2" /></svg>
      </button>
      <h1>{title}</h1>
      {children}
    </header>
  );
}

export function StreamerLayout() {
  return (
    <Shell
      nav={STREAMER_NAV}
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
      nav={ADMIN_NAV}
      head={<div className="admin-mark">FEDHA ADMIN</div>}
      foot={
        <div className="who" style={{ display: "block" }}>
          <b>Marta Sebastião</b><small>Papel · Finanças</small>
        </div>
      }
    />
  );
}

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
      <div>
        <div className="auth-head"><Logo to="/" /></div>
        <main className="auth-main"><Outlet /></main>
      </div>
    </div>
  );
}
