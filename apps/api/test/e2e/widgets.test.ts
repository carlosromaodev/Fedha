import { afterAll, beforeAll, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { buildApp } from "../../src/app";

type Msg = { type: string; data: any };

/** Liga um overlay e guarda as mensagens recebidas. */
function overlay(base: string, token: string, w: number) {
  const ws = new WebSocket(`${base.replace(/^http/, "ws")}/v1/realtime/overlay?token=${token}&w=${w}`);
  const msgs: Msg[] = [];
  const waiters: Array<{ type: string; fn: (m: Msg) => void; from: number }> = [];
  ws.on("message", (raw) => {
    const m = JSON.parse(raw.toString()) as Msg;
    msgs.push(m);
    for (const w2 of [...waiters]) if (w2.type === m.type) { waiters.splice(waiters.indexOf(w2), 1); w2.fn(m); }
  });
  const next = (type: string, timeoutMs = 5000) => new Promise<Msg>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`sem mensagem ${type}; recebidas: ${msgs.map((x) => x.type).join(",")}`)), timeoutMs);
    waiters.push({ type, from: msgs.length, fn: (m) => { clearTimeout(t); resolve(m); } });
  });
  const opened = new Promise<void>((res, rej) => { ws.once("open", () => res()); ws.once("error", rej); });
  const closed = new Promise<{ code: number }>((res) => ws.once("close", (code) => res({ code })));
  return { ws, msgs, next, opened, closed, send: (m: Msg) => ws.send(JSON.stringify(m)) };
}

describe("widgets W1–W6 ligados ao backend", () => {
  let built: Awaited<ReturnType<typeof buildApp>>;
  let base = "";
  let auth = "";
  const api = async (path: string, init: { method?: string; json?: unknown; token?: string } = {}) => {
    const res = await fetch(`${base}${path}`, {
      method: init.method ?? (init.json ? "POST" : "GET"),
      headers: { ...(init.json ? { "content-type": "application/json" } : {}), ...(init.token ?? auth ? { authorization: `Bearer ${init.token ?? auth}` } : {}) },
      body: init.json ? JSON.stringify(init.json) : undefined,
    });
    const body = await res.json().catch(() => null);
    return { status: res.status, body: body as any };
  };

  beforeAll(async () => {
    built = await buildApp({ logger: false, env: { NODE_ENV: "test", DATABASE_URL: "memory://", SEED_DEMO: "true", SANDBOX_AUTO_CONFIRM_MS: "0" } });
    await built.app.listen({ port: 0, host: "127.0.0.1" });
    const addr = built.app.server.address() as { port: number };
    base = `http://127.0.0.1:${addr.port}`;
    const login = await api("/v1/auth/login", { json: { identifier: "kiami@fedha.test", password: "fedha2026" } });
    expect(login.status).toBe(200);
    auth = login.body.tokens?.accessToken ?? login.body.accessToken;
    expect(auth).toBeTruthy();
  });
  afterAll(async () => { await built?.app.close(); });

  it("GET /v1/widgets lista w1..w6 com token, estado e config no formato do overlay", async () => {
    const r = await api("/v1/widgets");
    expect(r.status).toBe(200);
    expect(r.body.map((w: any) => w.id)).toEqual(["w1", "w2", "w3", "w4", "w5", "w6"]);
    const w1 = r.body[0];
    expect(w1.conn).toBe("fechado");
    expect(w1.config).toMatchObject({ highlightFrom: 1000, superFrom: 5000, destination: "tiktok", handle: "kiami", volume: 0.8 });
    // W5 (QR) fica bloqueado no TikTok
    expect(r.body[4].blocked).toBe(true);
  });

  it("pedido → pagamento sandbox → alerta no W1 → ack → tocada; W2 recebe state", async () => {
    const list = (await api("/v1/widgets")).body;
    const w1 = overlay(base, list[0].token, 1);
    const w2 = overlay(base, list[1].token, 2);
    const cfg1 = w1.next("config");
    const state2 = w2.next("state");
    await Promise.all([w1.opened, w2.opened]);
    w1.send({ type: "hello", data: { widget: 1, scenario: "c1", userAgent: "OBS/30" } });
    expect((await cfg1).data.handle).toBe("kiami");
    expect((await state2).data).toMatchObject({ goal: null, queueSize: 0 });

    const after = (await api("/v1/widgets")).body;
    expect(after[0]).toMatchObject({ conn: "aberto", openCount: 1 });
    await new Promise((r) => setTimeout(r, 50));
    expect((await api("/v1/widgets")).body[0].where).toContain("C1");

    const order = await api("/v1/public/orders", { json: { handle: "kiami", kind: "text", text: "Boa noite mano, salve para Viana!", donorName: "Luana", phone: "923456789", acceptTerms: true } });
    expect(order.status, JSON.stringify(order.body)).toBeLessThan(300);
    const orderId = order.body.id ?? order.body.order?.id;

    const alertP = w1.next("alert", 10000);
    const pay = await api(`/v1/public/orders/${orderId}/payments`, { json: { method: "reference" } });
    expect(pay.status, JSON.stringify(pay.body)).toBeLessThan(300);
    const conf = await api(`/v1/dev/payments/${orderId}/confirm`, { json: {} });
    expect(conf.status, JSON.stringify(conf.body)).toBe(200);

    const alert = (await alertP).data;
    expect(alert).toMatchObject({ id: orderId, donorName: "Luana", amountKz: 500, kind: "text", tier: "normal" });
    expect(alert.audioUrl).toMatch(/^http/);
    expect((await api(`/v1/public/orders/${orderId}`)).body.status).toBe("playing");

    const stateAfter = w2.next("state", 5000);
    w1.send({ type: "ack", data: { id: orderId, playedAt: new Date().toISOString() } });
    const st = (await stateAfter).data;
    expect(st.latest[0]).toMatchObject({ name: "Luana", kz: 500 });
    expect((await api(`/v1/public/orders/${orderId}`)).body.status).toBe("played");
    w1.ws.close(); w2.ws.close();
    await Promise.all([w1.closed, w2.closed]);
    await new Promise((r) => setTimeout(r, 50));
    expect((await api("/v1/widgets")).body[0].conn).toBe("a_religar");
  });

  it("PUT /v1/widgets/w1 guarda a config e envia config ao overlay aberto", async () => {
    const list = (await api("/v1/widgets")).body;
    const w1 = overlay(base, list[0].token, 1);
    const first = w1.next("config");
    await w1.opened; await first;
    const pushed = w1.next("config");
    const r = await api("/v1/widgets/w1", { method: "PUT", json: { theme: "sinal", highlightFrom: 2000, superFrom: 8000, volume: 0.5, accent: "#FF00AA" } });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.config).toMatchObject({ theme: "sinal", highlightFrom: 2000, superFrom: 8000, volume: 0.5 });
    expect((await pushed).data).toMatchObject({ theme: "sinal", highlightFrom: 2000, accent: "#FF00AA" });
    w1.ws.close(); await w1.closed;
  });

  it("alerta de teste chega ao W1 sem cobrar e last-test regista o ack", async () => {
    const list = (await api("/v1/widgets")).body;
    const w1 = overlay(base, list[0].token, 1);
    await w1.opened;
    const alertP = w1.next("alert");
    const t = await api("/v1/widgets/test", { json: {} });
    expect(t.body).toMatchObject({ sent: true });
    const a = (await alertP).data;
    expect(a.isTest).toBe(true);
    expect((await api("/v1/widgets/last-test")).body).toMatchObject({ pageOpen: true, played: false });
    w1.send({ type: "ack", data: { id: a.id } });
    await new Promise((r) => setTimeout(r, 100));
    expect((await api("/v1/widgets/last-test")).body).toMatchObject({ pageOpen: true, played: true });
    w1.ws.close(); await w1.closed;
  });

  it("gerar token novo envia revoked e o token antigo deixa de ligar", async () => {
    const list = (await api("/v1/widgets")).body;
    const w1 = overlay(base, list[0].token, 1);
    await w1.opened;
    const revoked = w1.next("revoked");
    const r = await api("/v1/widgets/w1/token", { json: {} });
    expect(r.body.token).not.toBe(list[0].token);
    await revoked;
    expect((await w1.closed).code).toBe(4001);
    const again = overlay(base, list[0].token, 1);
    expect((await again.closed).code).toBe(4001);
  });

  it("destino muda o W5", async () => {
    expect((await api("/v1/streamer/destination")).body).toEqual({ destination: "tiktok" });
    await api("/v1/streamer/destination", { method: "PUT", json: { destination: "youtube" } });
    const w5 = (await api("/v1/widgets")).body[4];
    expect(w5.blocked).toBe(false);
    expect(w5.config.destination).toBe("youtube");
  });
});
