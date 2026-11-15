import { lazy, Suspense, type ReactNode } from "react";
import { createBrowserRouter, Outlet } from "react-router-dom";
import { AdminLayout, AuthLayout, StreamerLayout } from "../layouts";
import { DraftProvider } from "../features/composer/store";

const L = (f: () => Promise<{ default: React.ComponentType }>) => {
  const C = lazy(f);
  return <C />;
};
const S = ({ children }: { children: ReactNode }) => <Suspense fallback={<div className="skel" style={{ height: 4 }} />}>{children}</Suspense>;

const Donor = () => <DraftProvider><S><Outlet /></S></DraftProvider>;
const Lazy = ({ children }: { children: ReactNode }) => <S>{children}</S>;

export const router = createBrowserRouter([
  { path: "/", element: <Lazy>{L(() => import("../pages/public/p1-landing"))}</Lazy> },
  { path: "/pedido", element: <Lazy>{L(() => import("../pages/public/p5-order-lookup"))}</Lazy> },

  {
    path: "/auth",
    element: <AuthLayout />,
    children: [
      { path: "registo", element: <Lazy>{L(() => import("../pages/auth/a1-register"))}</Lazy> },
      { path: "verificar", element: <Lazy>{L(() => import("../pages/auth/a2-verify"))}</Lazy> },
      { path: "entrar", element: <Lazy>{L(() => import("../pages/auth/a3-login"))}</Lazy> },
      { path: "recuperar", element: <Lazy>{L(() => import("../pages/auth/a4-recover-password"))}</Lazy> },
      { path: "2fa", element: <Lazy>{L(() => import("../pages/auth/a5-two-factor"))}</Lazy> },
    ],
  },
  { path: "/boas-vindas", element: <Lazy>{L(() => import("../pages/auth/a6-onboarding"))}</Lazy> },
  { path: "/verificacao", element: <Lazy>{L(() => import("../pages/auth/a7-kyc"))}</Lazy> },

  {
    path: "/painel",
    element: <StreamerLayout />,
    children: [
      { index: true, element: <Lazy>{L(() => import("../pages/streamer/s1-dashboard"))}</Lazy> },
      { path: "fila", element: <Lazy>{L(() => import("../pages/streamer/s2-live-queue"))}</Lazy> },
      { path: "overlay", element: <Lazy>{L(() => import("../pages/streamer/s6-widgets"))}</Lazy> },
      { path: "historico", element: <Lazy>{L(() => import("../pages/streamer/s4-history"))}</Lazy> },
      { path: "carteira", element: <Lazy>{L(() => import("../pages/streamer/s11-withdrawals"))}</Lazy> },
      { path: "metas", element: <Lazy>{L(() => import("../pages/streamer/s7-goals"))}</Lazy> },
      { path: "pagina", element: <Lazy>{L(() => import("../pages/streamer/s8-public-page"))}</Lazy> },
      { path: "precos", element: <Lazy>{L(() => import("../pages/streamer/s5-pricing"))}</Lazy> },
      { path: "filtros", element: <Lazy>{L(() => import("../pages/streamer/s9-filters"))}</Lazy> },
      { path: "assistentes", element: <Lazy>{L(() => import("../pages/streamer/s10-assistants"))}</Lazy> },
      { path: "notificacoes", element: <Lazy>{L(() => import("../pages/streamer/s13-notifications"))}</Lazy> },
      { path: "conta", element: <Lazy>{L(() => import("../pages/streamer/s14-settings"))}</Lazy> },
      { path: "ajuda", element: <Lazy>{L(() => import("../pages/streamer/s15-support"))}</Lazy> },
    ],
  },
  // Player só-áudio: ecrã inteiro, pensado para o telemóvel ligado à coluna.
  { path: "/painel/player", element: <Lazy>{L(() => import("../pages/streamer/s3-player"))}</Lazy> },

  { path: "/assistente", element: <Lazy>{L(() => import("../pages/assistant/as2-live-queue"))}</Lazy> },
  { path: "/assistente/convite/:token", element: <Lazy>{L(() => import("../pages/assistant/as1-streamer-select"))}</Lazy> },
  { path: "/assistente/player", element: <Lazy>{L(() => import("../pages/assistant/as3-player"))}</Lazy> },

  {
    path: "/admin",
    element: <AdminLayout />,
    children: [
      { index: true, element: <Lazy>{L(() => import("../pages/admin/b1-overview"))}</Lazy> },
      { path: "transacoes", element: <Lazy>{L(() => import("../pages/admin/b4-transactions"))}</Lazy> },
      { path: "falhas", element: <Lazy>{L(() => import("../pages/admin/b4-transactions/Failures"))}</Lazy> },
      { path: "levantamentos", element: <Lazy>{L(() => import("../pages/admin/b6-withdrawals"))}</Lazy> },
      { path: "streamers", element: <Lazy>{L(() => import("../pages/admin/b2-streamers"))}</Lazy> },
      { path: "verificacoes", element: <Lazy>{L(() => import("../pages/admin/b3-kyc-queue"))}</Lazy> },
      { path: "reconciliacao", element: <Lazy>{L(() => import("../pages/admin/b5-reconciliation"))}</Lazy> },
      { path: "antifraude", element: <Lazy>{L(() => import("../pages/admin/b7-fraud"))}</Lazy> },
      { path: "moderacao", element: <Lazy>{L(() => import("../pages/admin/b8-moderation"))}</Lazy> },
      { path: "configuracoes", element: <Lazy>{L(() => import("../pages/admin/b9-settings"))}</Lazy> },
      { path: "suporte", element: <Lazy>{L(() => import("../pages/admin/b10-support"))}</Lazy> },
      { path: "papeis", element: <Lazy>{L(() => import("../pages/admin/b11-admins-audit"))}</Lazy> },
    ],
  },

  // Doador: fedha.live/:nome e o fluxo de pagamento partilham o rascunho.
  {
    element: <Donor />,
    children: [
      { path: "/:handle", element: L(() => import("../pages/public/p2-streamer-page")) },
      { path: "/:handle/pagar", element: L(() => import("../pages/public/p3-checkout")) },
      { path: "/:handle/pagar/express", element: L(() => import("../pages/public/p3-checkout/Express")) },
      { path: "/:handle/pagar/referencia", element: L(() => import("../pages/public/p3-checkout/Reference")) },
      { path: "/r/:id", element: L(() => import("../pages/public/p4-confirmation")) },
    ],
  },
]);
