import { useState } from "react";
import { Topbar } from "../../../layouts";
import { Tag, copy, useToast } from "../../../shared/ui";
import { PLATFORM_LABEL, streamer } from "../../../shared/mocks/data";

/**
 * S6 — Overlay e alertas. Versão mínima: link do overlay, revogar e alerta de teste.
 * O painel completo (seletor "Onde fazes live?", aparência, W1–W6 e guias G1–G7) vem do prompt de widgets
 * e será gerado no Claude Design antes de ser construído aqui.
 */
export default function Widgets() {
  const [token, setToken] = useState("8F3A2C71E6");
  const toast = useToast();
  const url = `https://fedha.live/o/${token}`;
  const qrBlocked = streamer.platform === "tiktok" || streamer.platform === "instagram";

  return (
    <>
      <Topbar title="Overlay e alertas" />
      <div className="page" style={{ maxWidth: 860 }}>
        <div className="card pad-l stack" style={{ gap: 12 }}>
          <div className="row between"><h2>O teu link de overlay</h2><Tag tone="ok">Ligado · OBS</Tag></div>
          <p className="muted" style={{ fontSize: 14 }}>Um só link mostra a mensagem no ecrã e toca o áudio. Cola-o como Browser Source (OBS, Streamlabs), Link Source (TikTok LIVE Studio) ou widget Web (PRISM, CameraFi Live).</p>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <span className="linkbox grow" style={{ minWidth: 220 }}><span className="grow">fedha.live/o/{token.slice(0, 4)}••••••</span></span>
            <button className="btn dark" onClick={() => { copy(url); toast.show("Link copiado"); }}>Copiar</button>
            <button className="btn" onClick={() => toast.show("Alerta de teste enviado")}>Alerta de teste</button>
            <button className="btn" onClick={() => { setToken(Math.random().toString(16).slice(2, 12).toUpperCase()); toast.show("Link antigo revogado"); }}>Regenerar</button>
          </div>
          <p className="hint">Não mostres este link na live. Quem o tiver vê os teus alertas. Se o partilhares sem querer, regenera-o.</p>
        </div>
        <div className="card pad-l stack" style={{ gap: 8 }}>
          <div className="row between"><h2>QR code na live (W5)</h2><Tag tone={qrBlocked ? "erro" : "ok"}>{qrBlocked ? "Desligado" : "Disponível"}</Tag></div>
          <p className="muted" style={{ fontSize: 14 }}>
            {qrBlocked ? `O ${PLATFORM_LABEL[streamer.platform]} não permite QR codes nem links no ecrã. Põe fedha.live/${streamer.handle} só na bio.` : "Podes mostrar um QR para a tua página na live."}
          </p>
        </div>
        <div className="aviso info">O painel completo (aparência do alerta, widgets de meta, ranking e combinado, e os guias por app) está a ser desenhado e chega na próxima versão.</div>
      </div>
      {toast.node}
    </>
  );
}
