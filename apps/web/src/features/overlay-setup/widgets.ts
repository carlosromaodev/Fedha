import type { Platform } from "../../shared/mocks/data";

export type WidgetId = "w1" | "w2" | "w3" | "w4" | "w5" | "w6";
export type WidgetTheme = "claro" | "noite" | "sinal";
export type Conn = "aberto" | "fechado" | "a_religar" | "desligado";

export interface WidgetDef {
  id: WidgetId;
  n: number;
  name: string;
  desc: string;
  token: string;
  conn: Conn;
  where?: string;
}

/** Endereço onde corre a app do overlay (apps/overlay). Em produção: https://fedha.live */
export const OVERLAY_URL = (import.meta.env.VITE_OVERLAY_URL as string | undefined) ?? "http://localhost:5174";

export const WIDGETS: WidgetDef[] = [
  { id: "w1", n: 1, name: "Alerta de mensagem", desc: "Mostra e lê cada mensagem", token: "a8f3c71e", conn: "aberto", where: "LIVE Studio" },
  { id: "w2", n: 2, name: "Meta de doação", desc: "Barra da meta ativa", token: "9d04b2aa", conn: "aberto", where: "LIVE Studio" },
  { id: "w3", n: 3, name: "Ranking", desc: "Top doadores da live", token: "e6a21c90", conn: "fechado" },
  { id: "w4", n: 4, name: "Últimas mensagens", desc: "Lista ou faixa a rolar", token: "51be7f03", conn: "a_religar" },
  { id: "w5", n: 5, name: "QR code", desc: "Para a tua página", token: "77c0d1e4", conn: "fechado" },
  { id: "w6", n: 6, name: "Combinado", desc: "Alerta e meta numa só camada", token: "c3f9a018", conn: "fechado" },
];

export const NO_QR: Platform[] = ["tiktok", "instagram"];

/** Cenário do overlay a partir do destino da live: vertical no TikTok e Instagram, horizontal no resto. */
export function scenarioFor(dest: Platform) {
  return NO_QR.includes(dest) ? "c2" : "c1";
}

export function widgetUrl(w: WidgetDef, opts: { dest: Platform; theme?: WidgetTheme; preview?: boolean } ) {
  const q = new URLSearchParams({ w: String(w.n), c: scenarioFor(opts.dest), dest: opts.dest, theme: opts.theme ?? "claro" });
  if (opts.preview) { q.set("preview", "1"); q.set("demo", "1"); }
  return `${OVERLAY_URL}/o/${w.token}?${q}`;
}

export function publicWidgetLink(w: WidgetDef) {
  return `fedha.live/o/${w.token.slice(0, 4)}••••`;
}
