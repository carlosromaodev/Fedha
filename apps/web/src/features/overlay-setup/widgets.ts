import type { Platform } from "../../shared/mocks/data";
import { hasApi } from "../../shared/api/client";

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

/**
 * Os widgets são páginas do próprio site em /o/<token> (RN-WID-01), por isso o link usa a origem do site.
 * VITE_PUBLIC_URL só serve para forçar um domínio público diferente (ex.: https://fedha.live num ambiente de pré-visualização).
 */
export const SITE_URL = ((import.meta.env.VITE_PUBLIC_URL as string | undefined) || window.location.origin).replace(/\/$/, "");

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

/** Link que o streamer copia (RF-WID-01): <site>/o/<token>?w=<n>&layout=h|v. A configuração vem da API, não do URL. */
export function widgetUrl(w: WidgetDef, opts: { dest: Platform; theme?: WidgetTheme; preview?: boolean }) {
  const q = new URLSearchParams({ w: String(w.n), layout: scenarioFor(opts.dest) === "c2" ? "v" : "h" });
  if (opts.preview) { q.set("preview", "1"); if (opts.theme) q.set("theme", opts.theme); if (!hasApi) q.set("demo", "1"); }
  return `${SITE_URL}/o/${w.token}?${q}`;
}

export function publicWidgetLink(w: WidgetDef) {
  return `${SITE_URL.replace(/^https?:\/\//, "")}/o/${w.token.slice(0, 4)}••••`;
}
