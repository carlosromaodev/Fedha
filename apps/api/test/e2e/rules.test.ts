import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app";
import { streamerBalances } from "../../src/modules/wallet/domain/ledger";

describe("regras do produto pela API", () => {
  let built: Awaited<ReturnType<typeof buildApp>>;
  const call = async (method: string, url: string, payload?: unknown) => {
    const r = await built.app.inject({ method: method as "GET", url, payload: payload as object });
    return { status: r.statusCode, body: r.json() as any };
  };

  beforeAll(async () => {
    built = await buildApp({ logger: false, env: { NODE_ENV: "test", DATABASE_URL: "memory://", SEED_DEMO: "true", SANDBOX_AUTO_CONFIRM_MS: "0" } });
    await built.app.ready();
  });
  afterAll(async () => { await built?.app.close(); });

  it.each([
    [50, 500], [51, 1000], [100, 1000], [101, 2000], [200, 2000],
  ])("texto com %i caracteres custa %i Kz", async (n, kz) => {
    const r = await call("POST", "/v1/public/streamers/kiami/quote", { kind: "text", text: "a".repeat(n) });
    expect(r.status).toBe(200);
    expect(r.body.total).toBe(kz);
  });

  it("prioridade soma 1000 Kz", async () => {
    const r = await call("POST", "/v1/public/streamers/kiami/quote", { kind: "text", text: "olá malta", priority: true });
    expect(r.body.total).toBe(1500);
  });

  it.each(["vê o meu canal www.exemplo.com", "liga 923 456 789", "manda para a@b.co"])("bloqueia contacto/link antes do pagamento: %s", async (text) => {
    const r = await call("POST", "/v1/public/streamers/kiami/orders", { kind: "text", text, donorName: "X", phone: "923456789", acceptTerms: true });
    expect(r.status).toBeGreaterThanOrEqual(400);
  });

  it("pagamento MCX recusado (telefone acabado em 000) não entra na fila", async () => {
    const o = await call("POST", "/v1/public/orders", { handle: "kiami", kind: "text", text: "boa live", donorName: "Ana", phone: "923456789", acceptTerms: true });
    expect(o.status).toBe(201);
    const p = await call("POST", `/v1/public/orders/${o.body.id}/payments`, { method: "mcx", phone: "923456000" });
    expect(p.status).toBeLessThan(300);
    await new Promise((r) => setTimeout(r, 50));
    expect((await call("GET", `/v1/public/orders/${o.body.id}`)).body.status).toBe("payment_failed");
  });

  it("pagamento confirmado: 10% de taxa, resto fica pendente para o streamer (ledger equilibrado)", async () => {
    const o = await call("POST", "/v1/public/orders", { handle: "kiami", kind: "text", text: "a".repeat(120), donorName: "Rui", phone: "923456789", acceptTerms: true });
    const p = await call("POST", `/v1/public/orders/${o.body.id}/payments`, { method: "mcx", phone: "923456789" });
    expect(p.status, JSON.stringify(p.body)).toBeLessThan(300);
    expect((await call("POST", `/v1/dev/payments/${o.body.id}/confirm`, {})).status).toBe(200);
    expect((await call("GET", `/v1/public/orders/${o.body.id}`)).body.status).toBe("queued");
    const s = await built.ctx.db.query.streamers.findFirst();
    const b = await streamerBalances(built.ctx.db as never, s!.id);
    expect(b.pending).toBe(1800);
  });
});
