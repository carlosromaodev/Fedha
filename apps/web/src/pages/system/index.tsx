import { Link, useNavigate, useRouteError } from "react-router-dom";
import { ArrowLeft, Logo, RotateCcw, Wifi } from "../../shared/ui";

function Frame({ code, title, text, children }: { code: string; title: string; text: string; children: React.ReactNode }) {
  return (
    <div className="pub verde sys">
      <header className="pub-top" style={{ padding: "16px 20px" }}><Logo /></header>
      <main className="pub-main route-in" style={{ justifyContent: "center" }}>
        <span className="sys-code">{code}</span>
        <h1>{title}</h1>
        <p style={{ opacity: .85, lineHeight: 1.55 }}>{text}</p>
        <div className="stack" style={{ gap: 10, marginTop: 12 }}>{children}</div>
      </main>
    </div>
  );
}

/** Página inexistente: em vez do erro cru do router, um ecrã com saída clara. */
export function NotFound() {
  const nav = useNavigate();
  return (
    <Frame code="404" title="Esta página não existe" text="O link pode estar incompleto ou o streamer mudou de endereço. Confirma o link que te partilharam.">
      <Link to="/" className="btn ghost-light block">Ir para o início</Link>
      <button className="btn ghost-light block" onClick={() => nav(-1)}><ArrowLeft size={16} />Voltar</button>
    </Frame>
  );
}

/** Erro inesperado numa rota (ex.: rede caiu a meio de carregar a página). */
export function RouteError() {
  const err = useRouteError() as { status?: number } | undefined;
  if (err?.status === 404) return <NotFound />;
  return (
    <Frame code="Ups" title="Algo falhou ao abrir esta página" text="Pode ter sido a rede. Nada foi cobrado: tenta outra vez.">
      <button className="btn ghost-light block" onClick={() => location.reload()}><RotateCcw size={16} />Tentar outra vez</button>
      <Link to="/" className="btn ghost-light block"><Wifi size={16} />Ir para o início</Link>
    </Frame>
  );
}
