import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Topbar } from "../../../layouts";
import { RouteButton, Tag, useToast } from "../../../shared/ui";
import { cx } from "../../../shared/lib/format";
import { lastTest, useWidgets } from "../../../features/overlay-setup/api";

type Sc = "c1" | "c2" | "c3" | "c4" | "c5";
const TABS: Array<[Sc, string]> = [["c1", "OBS / Streamlabs"], ["c2", "TikTok LIVE Studio"], ["c3", "CameraFi / PRISM"], ["c4", "Flutuante"], ["c5", "Só áudio"]];

/** Guias G1–G7 condensados por cenário: lista de verificação, novo teste e pedido de suporte preenchido. */
const CHECKS: Record<Sc, { title: string; items: Array<[string, string]> }> = {
  c1: { title: "OBS / Streamlabs · W1 Alerta", items: [
    ["O link está certo e atualizado?", "Fontes → + → Navegador → cola o link. Tamanho 1920×1080."],
    ["A fonte está acima do jogo ou da câmara?", "Na lista de fontes, o W1 tem de estar em cima."],
    ["O som da fonte está ligado?", 'Ativa "Controlar áudio via OBS" e confirma o volume no misturador.'],
    ["A fonte atualiza ao ficar visível?", 'Ativa "Atualizar o navegador quando a cena fica ativa".'],
  ] },
  c2: { title: "TikTok LIVE Studio · W1 Alerta", items: [
    ["O link está certo e atualizado?", "Comparámos com o link atual: coincide."],
    ["A fonte está visível e acima da câmara?", "Na lista de fontes, arrasta o W1 para cima da câmara."],
    ["A fonte aparece como um ponto vermelho?", 'Problema conhecido do Link Source (0×0 px): remove a fonte, volta a adicioná-la e cola o link. Se continuar, usa o OBS como câmara virtual.'],
    ["O som da fonte está ligado?", "Abre o misturador e confirma que a fonte não está em silêncio."],
  ] },
  c3: { title: "CameraFi / PRISM · W6 Combinado", items: [
    ["A camada URL está ativa e fixa?", "CameraFi: Overlays → URL#1 → cola o link e fixa a camada."],
    ["Há no máximo 4 camadas web?", "PRISM aceita até 4 widgets web; usa o W6 para alerta e meta numa só."],
    ["A camada está bloqueada?", "Bloqueia a camada para não a moveres sem querer durante a live."],
    ["O telemóvel está ligado à corrente?", "Lives longas com camadas web gastam bateria depressa."],
  ] },
  c4: { title: "Flutuante · W1 versão mínima", items: [
    ["O CameraFi tem permissão para aparecer por cima de outras apps?", "Definições do Android → Apps → CameraFi → Mostrar por cima."],
    ["A janela flutuante está dentro do ecrã?", "Nada sai da caixa: nome, valor e duas linhas."],
    ["Experimental", "A partilha de ecrã do TikTok pode não mostrar a janela. Testa antes de entrar em direto."],
  ] },
  c5: { title: "Só áudio · Player", items: [
    ["Tocaste em Ativar som?", "O navegador só toca depois de tocares no ecrã."],
    ["O ecrã fica ligado?", "Ativa Manter ecrã ligado no Player."],
    ["A coluna está ligada ao aparelho certo?", "O som sai pelo dispositivo Bluetooth ligado ao telemóvel do Player."],
  ] },
};

export default function Troubleshoot() {
  const nav = useNavigate();
  const toast = useToast();
  const [sc, setSc] = useState<Sc>("c2");
  const [done, setDone] = useState<Record<string, boolean>>({ "c2-0": true, "c2-1": true });
  const data = CHECKS[sc];
  const { sendTest } = useWidgets();
  const [last, setLast] = useState<{ sentAt: string | null; pageOpen: boolean; played: boolean } | null>(null);
  useEffect(() => { void lastTest().then(setLast).catch(() => setLast(null)); }, []);
  const retest = async () => {
    try { await sendTest(); toast.show("Teste enviado. Vê se aparece e se ouves o som."); setTimeout(() => void lastTest().then(setLast).catch(() => {}), 8000); }
    catch (e) { toast.show(`Falhou: ${(e as Error).message}`); }
  };

  return (
    <>
      <Topbar mtitle="Problemas" mActions={false} title="Resolução de problemas" sub="O alerta não aparece ou não toca">
        <button className="btn" onClick={() => nav("/painel/widgets")}>Voltar</button>
      </Topbar>
      <div className="page">
        <div className="m-only">
          <span className="eyebrow">{sc.toUpperCase()} · {TABS.find(([k]) => k === sc)![1]}</span>
          <h1 className="page-h" style={{ marginTop: 4 }}>O alerta não aparece</h1>
        </div>
        <div className="chips" role="tablist">
          {TABS.map(([k, l]) => (
            <button key={k} role="tab" aria-selected={sc === k} className={cx("chip", sc === k && "on")} onClick={() => setSc(k)}>
              <span className="mono" style={{ fontSize: 11, opacity: .7 }}>{k.toUpperCase()}</span> {l}
            </button>
          ))}
        </div>
        <div className="split">
          <div className="card pad-l">
            <div className="row between d-only"><h2>{data.title}</h2><Tag tone="erro">Não aparece</Tag></div>
            <div className="check-list" style={{ marginTop: 8 }}>
              {data.items.map(([q, a], i) => (
                <div key={q}>
                  <input type="checkbox" className="selo" aria-label={q} checked={!!done[`${sc}-${i}`]} onChange={(e) => setDone({ ...done, [`${sc}-${i}`]: e.target.checked })} />
                  <span><b style={{ fontWeight: 500 }}>{q}</b><br /><small className="muted" style={{ fontSize: 13 }}>{a}</small></span>
                </div>
              ))}
            </div>
            <div className="row ts-actions" style={{ gap: 16, marginTop: 16, flexWrap: "wrap" }}>
              <div style={{ width: 170 }}><RouteButton size="sm" onClick={retest}>Voltar a testar</RouteButton></div>
              <Link to={`/painel/ajuda?cenario=${sc}`}>Abrir pedido de suporte com o cenário {sc.toUpperCase()} preenchido</Link>
            </div>
          </div>
          <div className="stack d-only" style={{ gap: 16 }}>
            <div className="card pad-l">
              <h2>Outros cenários</h2>
              <div className="lines" style={{ marginTop: 6 }}>
                {TABS.filter(([k]) => k !== sc).slice(0, 4).map(([k, l]) => (
                  <button key={k} onClick={() => setSc(k)} style={{ textAlign: "left", border: 0, background: "none", width: "100%" }}>
                    <b style={{ fontWeight: 500 }}>{k.toUpperCase()} · {l}</b><br /><small className="muted">{CHECKS[k].items[0]![0]}</small>
                  </button>
                ))}
              </div>
            </div>
            <div className="card pad-l">
              <h2>Último teste</h2>
              <div className="lines" style={{ marginTop: 6, fontSize: 14 }}>
                <div className="row between"><span className="muted">Enviado</span><span className="mono">{last?.sentAt ?? "—"} · W1-T</span></div>
                <div className="row between"><span className="muted">Página aberta</span><Tag tone={last?.pageOpen ? "ok" : "erro"}>{last?.pageOpen ? "Sim" : "Não"}</Tag></div>
                <div className="row between"><span className="muted">Som</span><Tag tone={last?.played ? "ok" : "erro"}>{last?.played ? "Tocou" : "Não tocou"}</Tag></div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {toast.node}
    </>
  );
}
