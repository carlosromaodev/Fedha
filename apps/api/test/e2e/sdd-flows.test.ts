import { afterAll, beforeAll, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { eq } from "drizzle-orm";
import { buildApp } from "../../src/app";
import { schema } from "../../src/shared/database/client";
import { streamerBalances } from "../../src/modules/wallet/domain/ledger";
import { releaseDue } from "../../src/modules/wallet/application/wallet.service";

/** Fluxos de dinheiro e de emissão do SDD v2.0: webhook, ledger, antifraude e saída principal. */
describe("SDD: webhook, ledger e saída principal", () => {
  let built: Awaited<ReturnType<typeof buildApp>>;
  let clock = Date.now();
  let base = "";
  let streamerId = "";
  let auth = "";
  const call = async (method: string, url: string, payload?: unknown, token?: string) => {
    const r = await built.app.inject({ method: method as "GET", url, payload: payload as object, headers: token ? { authorization: `Bearer ${token}` } : {} });
    return { status: r.statusCode, body: r.json() as any };
  };
  let n = 0;
  const order = async (extra: Record<string, unknown> = {}) => {
    const phone = `9234${String(10000 + n++).slice(-5)}`;
    const o = await call("POST", "/v1/public/orders", { handle: "kiami", kind: "text", text: "boa live mano", donorName: "Ana", phone, acceptTerms: true, ...extra });
    expect(o.status, JSON.stringify(o.body)).toBe(201);
    return o.body.id as string;
  };
  const payAndConfirm = async (id: string) => {
    expect((await call("POST", `/v1/public/orders/${id}/payments`, { method: "reference" })).status).toBeLessThan(300);
    expect((await call("POST", `/v1/dev/payments/${id}/confirm`, {})).status).toBe(200);
  };
  const status = async (id: string) => (await call("GET", `/v1/public/orders/${id}`)).body.status;
  const balances = () => streamerBalances(built.ctx.db as never, streamerId);
  const login = async () => { const l = await call("POST", "/v1/auth/login", { identifier: "kiami@fedha.test", password: "fedha2026" }); return (l.body.tokens?.accessToken ?? l.body.accessToken) as string; };
  const releasedAt = async (id: string) => (await built.ctx.db.query.orders.findFirst({ where: eq(schema.orders.id, id) }))!.releasedAt;

  beforeAll(async () => {
    built = await buildApp({ logger: false, now: () => new Date(clock), env: { NODE_ENV: "test", DATABASE_URL: "memory://", SEED_DEMO: "true" } });
    await built.app.listen({ port: 0, host: "127.0.0.1" });
    base = `http://127.0.0.1:${(built.app.server.address() as { port: number }).port}`;
    streamerId = (await built.ctx.db.query.streamers.findFirst())!.id;
    const login = await call("POST", "/v1/auth/login", { identifier: "kiami@fedha.test", password: "fedha2026" });
    auth = login.body.tokens?.accessToken ?? login.body.accessToken;
  });
  afterAll(async () => { await built?.app.close(); });

  it("RN-PAG-01/RN-CAR-01/02: só o webhook confirma; 10% para a plataforma, 90% pendente", async () => {
    const before = await balances();
    const id = await order();
    expect((await call("POST", `/v1/public/orders/${id}/payments`, { method: "reference" })).status).toBeLessThan(300);
    expect(await status(id)).toBe("awaiting_payment");
    expect((await call("POST", `/v1/dev/payments/${id}/confirm`, {})).status).toBe(200);
    expect(await status(id)).toBe("queued");
    const after = await balances();
    expect(after.pending - before.pending).toBe(450);
    expect(after.available).toBe(before.available);
  });

  it("RN-PAG-01: webhook com assinatura errada é recusado", async () => {
    const r = await built.app.inject({ method: "POST", url: "/v1/webhooks/payments/sandbox", headers: { "content-type": "application/json", "x-signature": "errada" }, payload: JSON.stringify({ id: "x", ref: "SBX-1", status: "confirmed" }) });
    expect(r.statusCode).toBeGreaterThanOrEqual(400);
  });

  it("RN-PAG-04: um segundo pagamento confirmado do mesmo pedido é reembolsado e não credita o streamer", async () => {
    const id = await order();
    const a = await call("POST", `/v1/public/orders/${id}/payments`, { method: "reference" });
    clock += 1000;
    const b = await call("POST", `/v1/public/orders/${id}/payments`, { method: "reference" });
    expect(a.body.payment.id).not.toBe(b.body.payment.id);
    const before = await balances();
    const cb = await call("POST", `/v1/sandbox/payments/${b.body.payment.id}/confirm`, {});
    expect(cb.status, JSON.stringify([a.body.payment, b.body.payment, cb.body])).toBe(200);
    const mid = await balances();
    expect(mid.pending - before.pending).toBe(450);
    // o primeiro pagamento (substituído) chega depois: duplicado
    expect((await call("POST", `/v1/sandbox/payments/${a.body.payment.id}/confirm`, {})).status).toBe(200);
    const pa = await built.ctx.db.query.payments.findFirst({ where: eq(schema.payments.id, a.body.payment.id) });
    expect(["refund_requested", "refunded"]).toContain(pa!.status);
    expect((await balances()).pending).toBe(mid.pending);
  });

  it("RN-FRA-02: o streamer não paga para a própria página (bloqueado e sinalizado)", async () => {
    const r = await call("POST", "/v1/public/orders", { handle: "kiami", kind: "text", text: "teste", donorName: "Eu", phone: "923000001", acceptTerms: true });
    expect(r.status).toBe(403);
    expect(r.body.error.code).toBe("self_payment");
    const alert = await built.ctx.db.query.fraudAlerts.findFirst({ where: eq(schema.fraudAlerts.kind, "self_donation") });
    expect(alert).toBeTruthy();
  });

  it("RN-FRA-01: limite de 20 mensagens por dia por telemóvel", async () => {
    const phone = "924111222";
    for (let i = 0; i < 20; i++) {
      const o = await call("POST", "/v1/public/orders", { handle: "kiami", kind: "text", text: `msg ${i}`, donorName: "Rui", phone, acceptTerms: true });
      expect(o.status, `pedido ${i}: ${JSON.stringify(o.body)}`).toBe(201);
    }
    const o = await call("POST", "/v1/public/orders", { handle: "kiami", kind: "text", text: "mais uma", donorName: "Rui", phone, acceptTerms: true });
    expect(o.status).toBe(429);
  });

  it("RN-WID-06/RN-FIL-04/RN-CAR-03: toca no último W1 aberto; só passa a disponível depois de tocada e de 48 h", async () => {
    // limpa a fila acumulada pelos testes anteriores
    await built.ctx.db.update(schema.orders).set({ status: "played", playedAt: new Date(clock) }).where(eq(schema.orders.status, "queued"));
    const token = (await call("GET", "/v1/widgets", undefined, auth)).body[0].token;
    const open = async () => {
      const ws = new WebSocket(`${base.replace("http", "ws")}/v1/realtime/overlay?token=${token}&w=1`);
      const alerts: any[] = [];
      ws.on("message", (raw) => { const m = JSON.parse(raw.toString()); if (m.type === "alert") alerts.push(m.data); });
      await new Promise((r) => ws.once("open", r));
      return { ws, alerts };
    };
    const first = await open();
    await new Promise((r) => setTimeout(r, 20));
    const second = await open();

    const id = await order();
    await payAndConfirm(id);
    await new Promise((r) => setTimeout(r, 300));
    expect(second.alerts.map((a) => a.id)).toContain(id);
    expect(first.alerts.map((a) => a.id)).not.toContain(id);

    const before = await balances();
    clock += 49 * 3600_000;
    await releaseDue(built.ctx, 48, 168);
    expect(await releasedAt(id)).toBeNull(); // ainda a tocar: não liberta
    const mid = await balances();

    second.ws.send(JSON.stringify({ type: "ack", data: { id } }));
    await new Promise((r) => setTimeout(r, 100));
    expect(await status(id)).toBe("played");
    await releaseDue(built.ctx, 48, 168);
    expect(await releasedAt(id)).not.toBeNull();
    expect((await balances()).available - mid.available).toBe(450);
    expect(before.pending).toBeGreaterThan(0);
    first.ws.close(); second.ws.close();
  });

  it("RN-WID-05/RN-REE-01: áudio que não carrega é falha técnica com reembolso", async () => {
    auth = await login();
    const token = (await call("GET", "/v1/widgets", undefined, auth)).body[0].token;
    const ws = new WebSocket(`${base.replace("http", "ws")}/v1/realtime/overlay?token=${token}&w=1`);
    const got = new Promise<any>((res) => ws.on("message", (raw) => { const m = JSON.parse(raw.toString()); if (m.type === "alert") res(m.data); }));
    await new Promise((r) => ws.once("open", r));
    const id = await order();
    await payAndConfirm(id);
    const a = await got;
    expect(a.id).toBe(id);
    const before = await balances();
    ws.send(JSON.stringify({ type: "error", data: { id, reason: "load_failed" } }));
    await new Promise((r) => setTimeout(r, 200));
    expect(["failed", "refund_pending", "refunded"]).toContain(await status(id));
    expect(before.pending - (await balances()).pending).toBe(450); // RN-REE-04: sem receita para o streamer
    ws.close();
  });

  it("RN-FIL-06: intervalo por omissão de 1,5 s", async () => {
    const s = await built.ctx.db.query.streamers.findFirst();
    expect(s!.intervalMs).toBe(1500);
  });

  it("RN-CON-03: o nome de utilizador só muda 1 vez a cada 30 dias", async () => {
    auth = await login();
    expect((await call("PUT", "/v1/streamer/handle", { handle: "kiami_ao" }, auth)).status).toBe(200);
    const again = await call("PUT", "/v1/streamer/handle", { handle: "kiami" }, auth);
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe("handle_change_too_soon");
    clock += 31 * 86400_000;
    auth = await login();
    expect((await call("PUT", "/v1/streamer/handle", { handle: "kiami" }, auth)).status).toBe(200);
  });
});
