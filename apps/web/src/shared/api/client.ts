/**
 * Cliente da API Fedha (apps/api). Convenções combinadas com o backend:
 * - base /v1, JSON, valores em Kz inteiros, datas ISO;
 * - erros { error: { code, message, field?, details? } };
 * - tempo real: WebSocket /v1/realtime/dashboard (canal queue:<streamerId>) e /v1/realtime/overlay?token=;
 *   SSE /v1/public/orders/:id/events para o doador acompanhar a mensagem.
 * Sem VITE_API_URL, as telas usam os dados de exemplo de shared/mocks.
 * Os schemas Zod vivem em @fedha/contracts (dono: backend).
 */
export const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? null;
export const hasApi = !!API_URL;

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public field?: string, public details?: unknown) {
    super(message);
  }
}

let token: string | null = null;
try { token = localStorage.getItem("fedha.token"); } catch { /* sem storage */ }

export function setToken(t: string | null) {
  token = t;
  try { if (t) localStorage.setItem("fedha.token", t); else localStorage.removeItem("fedha.token"); } catch { /* */ }
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  if (!API_URL) throw new ApiError(0, "no_api", "API não configurada");
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.json !== undefined) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(`${API_URL}/v1${path}`, { ...init, headers, body: init.json !== undefined ? JSON.stringify(init.json) : init.body, credentials: "include" });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const e = body?.error ?? {};
    throw new ApiError(res.status, e.code ?? "http_error", e.message ?? `Erro ${res.status}`, e.field, e.details);
  }
  return body as T;
}

/** Tempo real do painel: fila, saídas e avisos. Volta a ligar-se com espera crescente. */
export function dashboardSocket(onMessage: (type: string, data: unknown) => void) {
  if (!API_URL) return () => {};
  let ws: WebSocket | null = null;
  let retry = 0;
  let closed = false;
  const open = () => {
    ws = new WebSocket(`${API_URL.replace(/^http/, "ws")}/v1/realtime/dashboard${token ? `?token=${encodeURIComponent(token)}` : ""}`);
    ws.onopen = () => { retry = 0; };
    ws.onmessage = (m) => { try { const { type, data } = JSON.parse(String(m.data)); onMessage(type, data); } catch { /* */ } };
    ws.onclose = () => { if (!closed) setTimeout(open, Math.min(30000, 1000 * 2 ** ++retry)); };
  };
  open();
  return () => { closed = true; ws?.close(); };
}

/** O doador acompanha o pedido até tocar (SSE). */
export function orderEvents(orderId: string, onEvent: (status: string, data: unknown) => void) {
  if (!API_URL) return () => {};
  const es = new EventSource(`${API_URL}/v1/public/orders/${encodeURIComponent(orderId)}/events`);
  es.onmessage = (m) => { try { const d = JSON.parse(m.data); onEvent(d.status, d); } catch { /* */ } };
  return () => es.close();
}
