import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app";

/** Uma "Ombala" local: guarda os pedidos e responde como quisermos. */
function fakeOmbala() {
  const received: Array<{ auth?: string; body: any }> = [];
  let status = 201;
  const server: Server = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      received.push({ auth: req.headers.authorization, body: raw ? JSON.parse(raw) : null });
      res.writeHead(status, { "Content-Type": "application/json" }).end(JSON.stringify(status < 300 ? { id: "m1" } : { detail: "recusado" }));
    });
  });
  return { server, received, setStatus: (s: number) => (status = s) };
}

describe("RN-CON-02: códigos por SMS através da Ombala", () => {
  const ombala = fakeOmbala();
  let built: Awaited<ReturnType<typeof buildApp>>;
  let clock = Date.parse("2026-11-16T12:00:00Z");
  const call = async (method: string, url: string, payload?: unknown, token?: string) => {
    const r = await built.app.inject({ method: method as "GET", url, payload: payload as object, headers: token ? { authorization: `Bearer ${token}` } : {} });
    return { status: r.statusCode, body: r.json() as any };
  };

  beforeAll(async () => {
    await new Promise<void>((r) => ombala.server.listen(0, "127.0.0.1", r));
    const port = (ombala.server.address() as AddressInfo).port;
    built = await buildApp({ logger: false, now: () => new Date(clock), env: {
      NODE_ENV: "test", DATABASE_URL: "memory://", SEED_DEMO: "false",
      SMS_PROVIDER: "ombala", OMBALA_API_URL: `http://127.0.0.1:${port}`, OMBALA_API_TOKEN: "tok-teste", SMS_SENDER: "FEDHA",
    } });
    await built.app.ready();
  });
  afterAll(async () => { await built?.app.close(); ombala.server.close(); });

  it("o registo envia o código ao fornecedor; se o SMS falhar, a conta fica criada e o reenvio responde 503 sem bloquear", async () => {
    const reg = await call("POST", "/v1/auth/register", {
      displayName: "Teste SMS", handle: "testesms", email: "sms@fedha.test", phone: "923111222", password: "Fedha2026!forte", birthDate: "1995-01-01", acceptTerms: true,
    });
    expect(reg.status).toBe(201);
    expect(reg.body.unsentCodes).toBeUndefined();
    expect(ombala.received).toHaveLength(1);
    expect(ombala.received[0]!.auth).toBe("Token tok-teste");
    expect(ombala.received[0]!.body).toMatchObject({ from: "FEDHA", to: "923111222" });
    expect(ombala.received[0]!.body.message).toContain(reg.body.devCodes.phone);

    // O fornecedor recusa: a API diz que o SMS não saiu e deixa pedir outro logo a seguir (sem o minuto de intervalo).
    clock += 61_000; // passa o intervalo de um minuto depois do código do registo
    ombala.setStatus(400);
    const token = reg.body.accessToken;
    const a = await call("POST", "/v1/auth/otp/resend", { channel: "sms" }, token);
    expect(a.status).toBe(503);
    expect(a.body.code ?? a.body.error?.code).toBe("otp_send_failed");
    ombala.setStatus(201);
    const b = await call("POST", "/v1/auth/otp/resend", { channel: "sms" }, token);
    expect(b.status).toBe(200);
  });
});
