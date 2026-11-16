import "./style.css";
import { readConfig } from "./config";
import { connect, type Alert, type OverlayState } from "./runtime";
import { playAlert, renderGoal, renderLatest, renderQr, renderRanking } from "./widgets";

/**
 * Widgets Fedha LIVE (W1–W6) em /o/<token>: página do próprio site (RN-WID-01), leve e transparente (RN-WID-03),
 * que corre horas dentro do OBS, Streamlabs, TikTok LIVE Studio, PRISM ou CameraFi Live. Sem React, para não pesar
 * nos navegadores embutidos. Nunca mostra erros na live; os avisos só aparecem na pré-visualização do painel.
 */
const cfg = readConfig();
const stage = document.getElementById("stage")!;
stage.className = `stage sc-${cfg.scenario}${cfg.preview ? " preview" : ""}`;

const alertZone = document.createElement("div");
alertZone.className = "zone-alert";
const sideZone = document.createElement("div");
sideZone.className = `zone-side w${cfg.widget}`;
const status = document.createElement("div");
status.className = "conn";
stage.append(sideZone, alertZone, status);

let state: OverlayState = { goal: null, ranking: [], latest: [], queueSize: 0 };
const queue: Alert[] = [];
let busy = false;
const hasAlert = cfg.widget === 1 || cfg.widget === 6;

function render() {
  if (cfg.widget === 2 || cfg.widget === 6) renderGoal(sideZone, state, cfg);
  // RF-WID-08: W3 últimas mensagens, W4 top doadores.
  if (cfg.widget === 3) renderLatest(sideZone, state, cfg);
  if (cfg.widget === 4) renderRanking(sideZone, state, cfg);
  if (cfg.widget === 5) renderQr(sideZone, cfg);
}

const link = connect(cfg, {
  onAlert(a) {
    if (!hasAlert) return;
    // Dois alertas nunca se sobrepõem: fila local, um de cada vez.
    queue.push(a);
    void pump();
  },
  onState(s) { state = { ...state, ...s }; render(); },
  onConfig(c) {
    // O painel guardou alterações: aplicam-se já, sem recarregar a fonte no OBS.
    Object.assign(cfg, Object.fromEntries(Object.entries(c).filter(([, v]) => v !== undefined && v !== null)));
    stage.className = `stage sc-${cfg.scenario}${cfg.preview ? " preview" : ""}`;
    render();
  },
  onConnection(c) {
    // O estado da ligação nunca aparece na live; só na pré-visualização do painel.
    status.textContent = cfg.preview ? ({ ligado: "", a_ligar: "A ligar…", desligado: "Sem ligação · a tentar de novo", revogado: "Link revogado · gera um novo no painel" })[c] : "";
    status.dataset.state = c;
  },
});

async function pump() {
  if (busy) return;
  busy = true;
  while (queue.length) {
    const a = queue.shift()!;
    // W6: o alerta entra por cima da meta; a meta reage quando ele sai.
    if (cfg.widget === 6) sideZone.classList.add("dim");
    const { played } = await playAlert(alertZone, a, cfg, Math.max(state.queueSize, queue.length));
    if (cfg.widget === 6) sideZone.classList.remove("dim");
    // RF-WID-06: confirmar o fim ao servidor; RN-WID-05: sem áudio, a mensagem fica como falha técnica.
    if (played || a.isTest) link.ack(a.id); else link.fail(a.id, "load_failed");
    await new Promise((r) => setTimeout(r, cfg.gapMs));
  }
  busy = false;
}

render();
