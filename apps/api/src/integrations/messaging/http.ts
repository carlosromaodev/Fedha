export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export class MessagingError extends Error {
  constructor(
    readonly provider: string,
    message: string,
    /** Código HTTP do fornecedor (0 = falha de rede ou timeout). */
    readonly status = 0,
    /** Resposta do fornecedor, cortada, para diagnóstico. Nunca contém o token. */
    readonly detail?: string,
  ) {
    super(`${provider}: ${message}`);
  }
}

export interface PostResult {
  status: number;
  body: unknown;
}

const RETRY_STATUS = new Set([429, 502, 503, 504]);

/**
 * POST JSON com timeout e novas tentativas só quando o fornecedor de certeza não processou o pedido
 * (falha de ligação, 429, 502, 503, 504). Um 500 ou um timeout não se repete: a mensagem pode já ter saído
 * e o destinatário receberia duas.
 */
export async function postJson(
  provider: string,
  url: string,
  headers: Record<string, string>,
  body: unknown,
  opts: { fetch?: FetchLike; timeoutMs?: number; attempts?: number; backoffMs?: number; method?: string } = {},
): Promise<PostResult> {
  const doFetch = opts.fetch ?? ((u, i) => fetch(u, i));
  const attempts = opts.attempts ?? 3;
  let last: MessagingError | null = null;
  for (let i = 0; i < attempts; i += 1) {
    if (i > 0) await new Promise((r) => setTimeout(r, (opts.backoffMs ?? 400) * 2 ** (i - 1)));
    let res: Response;
    try {
      res = await doFetch(url, {
        method: opts.method ?? "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json", "User-Agent": "FedhaLive/1", ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(opts.timeoutMs ?? 15_000),
      });
    } catch (err) {
      const name = err instanceof Error ? err.name : "Error";
      if (name === "TimeoutError" || name === "AbortError") throw new MessagingError(provider, "sem resposta (timeout)");
      last = new MessagingError(provider, `falha de ligação (${err instanceof Error ? err.message : String(err)})`);
      continue;
    }
    const text = await res.text().catch(() => "");
    let parsed: unknown = text;
    try { parsed = text ? JSON.parse(text) : null; } catch { /* resposta em texto */ }
    if (res.ok) return { status: res.status, body: parsed };
    last = new MessagingError(provider, `recusado com HTTP ${res.status}`, res.status, text.slice(0, 300));
    if (!RETRY_STATUS.has(res.status)) throw last;
  }
  throw last ?? new MessagingError(provider, "falhou");
}

export async function getJson(provider: string, url: string, headers: Record<string, string>, opts: { fetch?: FetchLike } = {}) {
  return postJson(provider, url, headers, undefined, { ...opts, method: "GET", attempts: 1 });
}
