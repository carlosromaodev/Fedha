import { lazy, Suspense, type ReactNode } from "react";
import { createBrowserRouter, Navigate, Outlet, useLocation } from "react-router-dom";
import { AdminLayout, AuthLayout, StreamerLayout } from "../layouts";
import { DraftProvider } from "../features/composer/store";
import { PageSkeleton } from "../shared/ui/skeleton";
import { NotFound, RouteError } from "../pages/system";

const L = (f: () => Promise<{ default: React.ComponentType }>) => {
  const C = lazy(f);
  return <C />;
};
/** Enquanto o código da página chega, mostra um esqueleto com a forma da página (nada de ecrã em branco). */
const S = ({ children, variant = "pub" }: { children: ReactNode; variant?: "page" | "pub" }) => (
  <Suspense fallback={<PageSkeleton variant={variant} />}>{children}</Suspense>
);

/** Fluxo do doador: cada passo entra com uma transição curta, como numa app. */
function Donor() {
  const { pathname } = useLocation();
  return <DraftProvider><S><div key={pathname} className="route-in"><Outlet /></div></S></DraftProvider>;
}
const Lazy = ({ children }: { children: ReactNode }) => <S>{children}</S>;
const Panel = ({ children }: { children: ReactNode }) => <S variant="page">{children}</S>;

export const router = createBrowserRouter([
  { path: "/404", element: <NotFound /> },
  { path: "/", element: <Lazy>{L(() => import("../pages/public/p1-landing"))}</Lazy> },
  { path: "/pedido", element: <Lazy>{L(() => import("../pages/public/p5-order-lookup"))}</Lazy> },

  {
    path: "/auth",
    element: <AuthLayout />,
    children: [
      { path: "entrar", element: <Lazy>{L(() => import("../pages/auth/a3-login"))}</Lazy> },
      { path: "recuperar", element: <Lazy>{L(() => import("../pages/auth/a4-recover-password"))}</Lazy> },
      { path: "2fa", element: <Lazy>{L(() => import("../pages/auth/a5-two-factor"))}</Lazy> },
    ],
  },
  { path: "/auth/registo", element: <Lazy>{L(() => import("../pages/auth/a1-register"))}</Lazy> },
  { path: "/auth/verificar", element: <Lazy>{L(() => import("../pages/auth/a2-verify"))}</Lazy> },
  { path: "/auth/link", element: <Lazy>{L(() => import("../pages/auth/a2-verify/Link"))}</Lazy> },
  { path: "/boas-vindas", element: <Lazy>{L(() => import("../pages/auth/a6-onboarding"))}</Lazy> },
  { path: "/verificacao", element: <Lazy>{L(() => import("../pages/auth/a7-kyc"))}</Lazy> },

  {
    path: "/painel",
    element: <StreamerLayout />,
    children: [
      { index: true, element: <Panel>{L(() => import("../pages/streamer/s1-dashboard"))}</Panel> },
      { path: "fila", element: <Panel>{L(() => import("../pages/streamer/s2-live-queue"))}</Panel> },
      { path: "player", element: <Panel>{L(() => import("../pages/streamer/s3-player"))}</Panel> },
      { path: "widgets", element: <Panel>{L(() => import("../pages/streamer/s6-widgets"))}</Panel> },
      { path: "widgets/ajuda", element: <Panel>{L(() => import("../pages/streamer/s6-widgets/Troubleshoot"))}</Panel> },
      { path: "widgets/:id", element: <Panel>{L(() => import("../pages/streamer/s6-widgets/Customize"))}</Panel> },
      { path: "overlay", element: <Navigate to="/painel/widgets" replace /> },
      { path: "historico", element: <Panel>{L(() => import("../pages/streamer/s4-history"))}</Panel> },
      { path: "carteira", element: <Panel>{L(() => import("../pages/streamer/s11-withdrawals"))}</Panel> },
      { path: "metas", element: <Panel>{L(() => import("../pages/streamer/s7-goals"))}</Panel> },
      { path: "pagina", element: <Panel>{L(() => import("../pages/streamer/s8-public-page"))}</Panel> },
      { path: "precos", element: <Panel>{L(() => import("../pages/streamer/s5-pricing"))}</Panel> },
      { path: "filtros", element: <Navigate to="/painel/precos" replace /> },
      { path: "assistentes", element: <Panel>{L(() => import("../pages/streamer/s10-assistants"))}</Panel> },
      { path: "notificacoes", element: <Panel>{L(() => import("../pages/streamer/s13-notifications"))}</Panel> },
      { path: "conta", element: <Panel>{L(() => import("../pages/streamer/s14-settings"))}</Panel> },
      { path: "ajuda", element: <Panel>{L(() => import("../pages/streamer/s15-support"))}</Panel> },
    ],
  },
  // Player em ecrã inteiro, pensado para o telemóvel ligado à coluna.
  { path: "/player", element: <Lazy>{L(() => import("../pages/streamer/s3-player/Mobile"))}</Lazy> },

  { path: "/assistente", element: <Lazy>{L(() => import("../pages/assistant/as2-live-queue"))}</Lazy> },
  { path: "/assistente/convite/:token", element: <Lazy>{L(() => import("../pages/assistant/as1-streamer-select"))}</Lazy> },
  { path: "/assistente/player", element: <Lazy>{L(() => import("../pages/assistant/as3-player"))}</Lazy> },

  {
    path: "/admin",
    element: <AdminLayout />,
    children: [
      { index: true, element: <Panel>{L(() => import("../pages/admin/b1-overview"))}</Panel> },
      { path: "transacoes", element: <Panel>{L(() => import("../pages/admin/b4-transactions"))}</Panel> },
      { path: "reembolsos", element: <Panel>{L(() => import("../pages/admin/b4-transactions/Failures"))}</Panel> },
      { path: "falhas", element: <Panel>{L(() => import("../pages/admin/b4-transactions/Failures"))}</Panel> },
      { path: "levantamentos", element: <Panel>{L(() => import("../pages/admin/b6-withdrawals"))}</Panel> },
      { path: "streamers", element: <Panel>{L(() => import("../pages/admin/b2-streamers"))}</Panel> },
      { path: "verificacoes", element: <Panel>{L(() => import("../pages/admin/b3-kyc-queue"))}</Panel> },
      { path: "reconciliacao", element: <Panel>{L(() => import("../pages/admin/b5-reconciliation"))}</Panel> },
      { path: "antifraude", element: <Panel>{L(() => import("../pages/admin/b7-fraud"))}</Panel> },
      { path: "moderacao", element: <Panel>{L(() => import("../pages/admin/b8-moderation"))}</Panel> },
      { path: "configuracoes", element: <Panel>{L(() => import("../pages/admin/b9-settings"))}</Panel> },
      { path: "suporte", element: <Panel>{L(() => import("../pages/admin/b10-support"))}</Panel> },
      { path: "papeis", element: <Panel>{L(() => import("../pages/admin/b11-admins-audit"))}</Panel> },
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
  { path: "*", element: <NotFound /> },
].map((r) => ({ ...r, errorElement: <RouteError /> })));
