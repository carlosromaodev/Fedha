import type { AlertEvent } from "@fedha/contracts";
import type { OverlayConfig } from "./config";

/** Estado partilhado pelos widgets W2–W6 (meta, ranking, últimas mensagens). */
export interface OverlayState {
  goal: { title: string; current: number; target: number } | null;
  ranking: Array<{ name: string; kz: number }>;
  latest: Array<{ name: string; kz: number; text: string }>;
  queueSize: number;
}

/** Evento de alerta com os campos opcionais que a API acrescenta ao AlertEvent. */
export type Alert = AlertEvent & { tier?: string; isTest?: boolean; voice?: string; priority?: boolean; effectUrl?: string };

/** Configuração do widget guardada no painel (PUT /v1/widgets/:id). Sobrepõe-se aos parâmetros do URL. */
export type WidgetConfig = Partial<Pick<OverlayConfig,
  "theme" | "accent" | "size" | "showName" | "showValue" | "karaoke" | "reduceMotion" | "highlightFrom" | "superFrom" |
  "enterMs" | "exitMs" | "gapMs" | "volume" | "destination" | "qrCall" | "handle" | "scenario">>;

type Listener = {
  onAlert: (a: Alert) => void;
  onConfig: (c: WidgetConfig) => void;
  onState: (s: Partial<OverlayState>) => void;
  onConnection: (c: "ligado" | "a_ligar" | "desligado" | "revogado") => void;
};

/**
 * Ligação à API por WebSocket: /v1/realtime/overlay?token=…
 * Volta a ligar-se sozinha (espera crescente até 30 s) e retoma a fila: os alertas ficam no servidor
 * até o overlay confirmar com AlertAck, por isso uma queda de rede nunca perde mensagens.
 */
export function connect(cfg: OverlayConfig, l: Listener) {
  if (!cfg.api || cfg.demo) return demo(cfg, l);
  let retry = 0;
  let ws: WebSocket | null = null;
  let closed = false;
  const url = `${cfg.api.replace(/^http/, "ws").replace(/\/$/, "")}/v1/realtime/overlay?token=${encodeURIComponent(cfg.token)}&w=${cfg.widget}`;
  const open = () => {
    l.onConnection("a_ligar");
    ws = new WebSocket(url);
    ws.onopen = () => {
      retry = 0;
      l.onConnection("ligado");
      ws?.send(JSON.stringify({ type: "hello", data: { widget: cfg.widget, scenario: cfg.scenario, userAgent: navigator.userAgent } }));
    };
    ws.onmessage = (m) => {
      try {
        const msg = JSON.parse(String(m.data)) as { type: string; data: unknown };
        if (msg.type === "alert") l.onAlert(msg.data as Alert);
        else if (msg.type === "config") l.onConfig(msg.data as WidgetConfig);
        else if (msg.type === "ping") ws?.send(JSON.stringify({ type: "pong" }));
        else if (msg.type === "state") l.onState(msg.data as Partial<OverlayState>);
        else if (msg.type === "revoked") { closed = true; l.onConnection("revogado"); ws?.close(); }
      } catch { /* mensagem inválida: ignorar */ }
    };
    ws.onclose = (ev) => {
      if (closed) return;
      // 4001: token inválido ou revogado · 4003: conta suspensa. Nestes casos não vale a pena voltar a tentar.
      if (ev.code === 4001 || ev.code === 4003) { closed = true; l.onConnection("revogado"); return; }
      l.onConnection("desligado");
      retry = Math.min(retry + 1, 6);
      setTimeout(open, Math.min(30000, 1000 * 2 ** retry));
    };
  };
  open();
  const hb = setInterval(() => { if (ws?.readyState === 1) ws.send(JSON.stringify({ type: "ping" })); }, 25000);
  return {
    ack: (id: string) => ws?.readyState === 1 && ws.send(JSON.stringify({ type: "ack", data: { id, playedAt: new Date().toISOString() } })),
    /** RN-WID-05: o áudio não carregou em 5 s; o texto já foi mostrado 6 s e a mensagem passa a falha técnica. */
    fail: (id: string, reason: "load_failed" | "autoplay_blocked" | "decode_failed") => ws?.readyState === 1 && ws.send(JSON.stringify({ type: "error", data: { id, reason } })),
    close: () => { closed = true; clearInterval(hb); ws?.close(); },
  };
}

const DEMO: Array<Omit<Alert, "id" | "createdAt" | "streamerId">> = [
  { donorName: "Kiami Gamer", amountKz: 500, kind: "text", text: "Boa noite mano, manda um salve pra malta de Viana!", audioUrl: "https://fedha.live/a/demo1.mp3", durationMs: 3800, showAmount: true, voice: "Nzinga" },
  { donorName: "Luana", amountKz: 3000, kind: "text", text: "Feliz aniversário DJ Nelo, és o maior!", audioUrl: "https://fedha.live/a/demo2.mp3", durationMs: 3200, showAmount: true, voice: "Nzinga", priority: true },
  { donorName: "Anónimo", amountKz: 8000, kind: "audio", text: null, audioUrl: "https://fedha.live/a/demo3.mp3", durationMs: 5000, showAmount: true },
  { donorName: "Edvaldo", amountKz: 2000, kind: "text", text: "Mano Kiami, a malta do Cazenga está toda contigo esta noite! O jogo está bué renhido mas tu estás a jogar como um profissional. Não desistas, a vitória é nossa. Abraço grande!", audioUrl: "https://fedha.live/a/demo4.mp3", durationMs: 9000, showAmount: true, voice: "Nzinga" },
  { donorName: "DJ Nelo", amountKz: 10000, kind: "text", text: "Kiami, esta é para o torneio de sábado. Bora ganhar!", audioUrl: "https://fedha.live/a/demo5.mp3", durationMs: 3600, showAmount: true, voice: "Ngola", priority: true },
];

/** Modo de demonstração e pré-visualização: ciclo de mensagens de exemplo, sem API. */
function demo(cfg: OverlayConfig, l: Listener) {
  let i = 0;
  const state: OverlayState = {
    goal: { title: "Cadeira gamer nova", current: 81600, target: 120000 },
    ranking: [{ name: "Edvaldo", kz: 19000 }, { name: "DJ Nelo", kz: 18500 }, { name: "Luana", kz: 9000 }, { name: "Mauro A.", kz: 6500 }, { name: "Anónimo", kz: 5000 }],
    latest: [
      { name: "DJ Nelo", kz: 2500, text: "Ya mano, essa jogada foi mesmo à Kuduro 😂" },
      { name: "Luana", kz: 3000, text: "Feliz aniversário DJ Nelo, és o maior!" },
      { name: "Edvaldo", kz: 2000, text: "Esse clutch foi brabo demais, abraço do Cazenga" },
      { name: "Kiami Gamer", kz: 500, text: "Boa noite mano, manda um salve pra malta de Viana" },
      { name: "Anónimo", kz: 8000, text: "Mensagem de voz · 00:18" },
    ],
    queueSize: 3,
  };
  setTimeout(() => { l.onConnection("ligado"); l.onState(state); }, 50);
  const next = () => {
    const base = DEMO[i % DEMO.length]!;
    i++;
    l.onAlert({ ...base, id: `demo-${i}`, streamerId: "demo", createdAt: new Date().toISOString(), isTest: cfg.preview });
  };
  const t = setTimeout(next, cfg.preview ? 300 : 800);
  return {
    ack: (id: string) => {
      const a = DEMO[(Number(id.split("-")[1]) - 1) % DEMO.length]!;
      state.latest = [{ name: a.donorName, kz: a.amountKz, text: a.text ?? "Mensagem de voz" }, ...state.latest].slice(0, 5);
      if (state.goal) state.goal = { ...state.goal, current: Math.min(state.goal.target, state.goal.current + a.amountKz) };
      const r = state.ranking.find((x) => x.name === a.donorName);
      if (r) r.kz += a.amountKz; else state.ranking.push({ name: a.donorName, kz: a.amountKz });
      state.ranking.sort((x, y) => y.kz - x.kz);
      state.queueSize = Math.max(0, 3 - (i % 4));
      l.onState({ ...state });
      setTimeout(next, cfg.gapMs);
    },
    fail: (id: string) => { void id; setTimeout(next, cfg.gapMs); },
    close: () => clearTimeout(t),
  };
}
