/**
 * Configuração lida do URL do widget, servido pelo próprio site (RN-WID-01). É o link que o streamer copia em
 * Widgets e cola no OBS, LIVE Studio, PRISM ou CameraFi:
 *   https://fedha.live/o/<token>?w=1&layout=h   (layout h = horizontal 1920×1080, v = vertical 1080×1920)
 * O token é secreto e revogável; a configuração "a sério" (níveis, sons, tempos) vem da API.
 * Parâmetros extra servem para pré-visualização no painel e para testes: demo=1, reduce=1, api=<url>.
 */
export type Widget = 1 | 2 | 3 | 4 | 5 | 6;
/** C1 OBS 1920×1080 · C2 TikTok LIVE Studio vertical · C3 câmara no telemóvel (PRISM/CameraFi) · C4 flutuante, versão mínima */
export type Scenario = "c1" | "c2" | "c3" | "c4";
export type Theme = "claro" | "noite" | "sinal";
export type Destination = "tiktok" | "instagram" | "youtube" | "twitch" | "kick" | "facebook";

export interface OverlayConfig {
  token: string;
  widget: Widget;
  scenario: Scenario;
  theme: Theme;
  accent: string;
  size: "p" | "m" | "g";
  showName: boolean;
  showValue: boolean;
  karaoke: boolean;
  reduceMotion: boolean;
  /** Limites dos níveis em Kz: destaque ≥ highlightFrom, super ≥ superFrom. */
  highlightFrom: number;
  superFrom: number;
  enterMs: number;
  exitMs: number;
  pauseMs: number;
  gapMs: number;
  volume: number;
  destination: Destination;
  qrCall: string;
  handle: string;
  demo: boolean;
  preview: boolean;
  api: string | null;
}

const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));

export function readConfig(loc: Location = window.location): OverlayConfig {
  const q = new URLSearchParams(loc.search);
  const token = loc.pathname.match(/\/o\/([^/?#]+)/)?.[1] ?? q.get("t") ?? "demo";
  const w = Number(q.get("w") ?? 1);
  // layout=h|v é o formato do link público (RF-WID-01); c=c1..c4 fica para pré-visualizações e testes.
  const layout = q.get("layout");
  const c = (q.get("c") ?? (layout === "v" ? "c2" : "c1")) as Scenario;
  const reduce = q.get("reduce") === "1" || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  return {
    token,
    widget: ([1, 2, 3, 4, 5, 6].includes(w) ? w : 1) as Widget,
    scenario: (["c1", "c2", "c3", "c4"].includes(c) ? c : "c1") as Scenario,
    theme: (["claro", "noite", "sinal"].includes(q.get("theme") ?? "") ? q.get("theme") : "claro") as Theme,
    accent: q.get("accent") ? `#${q.get("accent")!.replace("#", "")}` : "#C9F25C",
    size: (["p", "m", "g"].includes(q.get("size") ?? "") ? q.get("size") : "m") as "p" | "m" | "g",
    showName: q.get("name") !== "0",
    showValue: q.get("value") !== "0",
    karaoke: q.get("karaoke") !== "0",
    reduceMotion: !!reduce,
    highlightFrom: Number(q.get("hl") ?? 1000),
    superFrom: Number(q.get("sup") ?? 5000),
    // Regras de tempo (AN0): entrada 400–700, saída 300–500, pausa final 1 s, intervalo 0–5 s (padrão 1,5 s).
    enterMs: clamp(Number(q.get("in") ?? 500), 400, 700),
    exitMs: clamp(Number(q.get("out") ?? 400), 300, 500),
    pauseMs: 1000,
    gapMs: clamp(Number(q.get("gap") ?? 1500), 0, 5000),
    volume: clamp(Number(q.get("vol") ?? 80), 0, 100) / 100,
    destination: (q.get("dest") ?? "tiktok") as Destination,
    qrCall: q.get("call") ?? "Manda a tua mensagem!",
    handle: q.get("h") ?? "kiami",
    demo: q.get("demo") === "1" || token === "demo",
    preview: q.get("preview") === "1",
    // Em produção a API vem do build (VITE_API_URL); ?api= serve para testar contra outro servidor.
    api: q.get("api") ?? ((import.meta.env.VITE_API_URL as string | undefined) || null),
  };
}

export function levelOf(kz: number, cfg: OverlayConfig): "normal" | "destaque" | "super" {
  if (kz >= cfg.superFrom) return "super";
  if (kz >= cfg.highlightFrom) return "destaque";
  return "normal";
}
