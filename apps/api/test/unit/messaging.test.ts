import { describe, expect, it } from "vitest";
import { parsePhone, mask } from "../../src/integrations/messaging/phone";
import { DefaultMessenger, type MessengerCfg } from "../../src/integrations/messaging/senders";
import { MessagingError, type FetchLike } from "../../src/integrations/messaging/http";
import { loadEnv } from "../../src/shared/config/env";

const silent = { info: () => {}, warn: () => {} };

function fakeFetch(responses: Array<{ status: number; body?: unknown } | Error>) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fn: FetchLike = async (url, init) => {
    calls.push({ url, init });
    const r = responses[Math.min(calls.length - 1, responses.length - 1)]!;
    if (r instanceof Error) throw r;
    return new Response(r.body === undefined ? "" : JSON.stringify(r.body), { status: r.status });
  };
  return { fn, calls };
}

const base: MessengerCfg = {
  NODE_ENV: "test", SMS_PROVIDER: "console", SMS_SENDER: "FEDHA", OMBALA_API_URL: "https://api.useombala.ao",
  EMAIL_PROVIDER: "console", EMAIL_FROM: "x@y", WHATSAPP_PROVIDER: "console",
};

describe("telefones", () => {
  it("aceita os formatos angolanos e devolve cada formato", () => {
    for (const input of ["923456789", "+244923456789", "244 923 456 789", "00244923456789", "923-456-789"]) {
      expect(parsePhone(input)).toEqual({ intl: "244923456789", e164: "+244923456789", national: "923456789", angolan: true });
    }
  });
  it("aceita estrangeiros só com indicativo e recusa lixo", () => {
    expect(parsePhone("+351912345678").angolan).toBe(false);
    expect(() => parsePhone("12345")).toThrow();
    expect(() => parsePhone("812345678")).toThrow();
    expect(() => parsePhone("+24481234567")).toThrow();
  });
  it("mascara o número nos logs", () => {
    expect(mask("923456789")).toBe("92•••••89");
  });
});

describe("SMS pela Ombala", () => {
  const cfg = { ...base, SMS_PROVIDER: "ombala" as const, OMBALA_API_TOKEN: "tok-teste" };

  it("envia para /v1/messages com Token, remetente e número sem indicativo", async () => {
    const f = fakeFetch([{ status: 201, body: { id: "abc" } }]);
    const m = new DefaultMessenger(cfg, silent, { fetch: f.fn });
    await m.sms("+244923456789", "Fedha Live: 123456");
    expect(f.calls).toHaveLength(1);
    const { url, init } = f.calls[0]!;
    expect(url).toBe("https://api.useombala.ao/v1/messages");
    expect((init.headers as Record<string, string>).Authorization).toBe("Token tok-teste");
    expect(JSON.parse(init.body as string)).toEqual({ message: "Fedha Live: 123456", from: "FEDHA", to: "923456789" });
  });

  it("repete em 503 e falha de ligação, mas não num 400 nem num 500", async () => {
    const ok = fakeFetch([new TypeError("fetch failed"), { status: 503 }, { status: 200, body: {} }]);
    await new DefaultMessenger(cfg, silent, { fetch: ok.fn }).sms("923456789", "x");
    expect(ok.calls).toHaveLength(3);

    for (const status of [400, 500]) {
      const bad = fakeFetch([{ status, body: { detail: "erro" } }]);
      const err = await new DefaultMessenger(cfg, silent, { fetch: bad.fn }).sms("923456789", "x").catch((e) => e);
      expect(err).toBeInstanceOf(MessagingError);
      expect(err.status).toBe(status);
      expect(bad.calls).toHaveLength(1);
    }
  });

  it("recusa números estrangeiros e diz o que falta configurar", async () => {
    const f = fakeFetch([{ status: 200 }]);
    const m = new DefaultMessenger(cfg, silent, { fetch: f.fn });
    await expect(m.sms("+351912345678", "x")).rejects.toThrow(/angolanos/);
    expect(f.calls).toHaveLength(0);
    expect(new DefaultMessenger({ ...cfg, OMBALA_API_TOKEN: undefined }, silent).status().sms).toEqual({ provider: "ombala", missing: ["OMBALA_API_TOKEN"] });
  });
});

describe("WhatsApp", () => {
  it("Evolution: sendText na instância, cabeçalho apikey e número com 244", async () => {
    const f = fakeFetch([{ status: 201, body: { key: { id: "MSG1" } } }]);
    const m = new DefaultMessenger({ ...base, WHATSAPP_PROVIDER: "evolution", EVOLUTION_API_URL: "http://evo:8081/", EVOLUTION_API_KEY: "k", EVOLUTION_INSTANCE: "fedha" }, silent, { fetch: f.fn });
    await m.whatsapp("+244923456789", "Nova mensagem");
    const { url, init } = f.calls[0]!;
    expect(url).toBe("http://evo:8081/message/sendText/fedha");
    expect((init.headers as Record<string, string>).apikey).toBe("k");
    expect(JSON.parse(init.body as string)).toEqual({ number: "244923456789", text: "Nova mensagem" });
  });

  it("Meta: Cloud API com Bearer", async () => {
    const f = fakeFetch([{ status: 200, body: { messages: [{ id: "wamid" }] } }]);
    const m = new DefaultMessenger({ ...base, WHATSAPP_PROVIDER: "meta", WHATSAPP_TOKEN: "t", WHATSAPP_PHONE_ID: "123" }, silent, { fetch: f.fn });
    await m.whatsapp("923456789", "Olá");
    expect(f.calls[0]!.url).toBe("https://graph.facebook.com/v20.0/123/messages");
    expect(JSON.parse(f.calls[0]!.init.body as string).to).toBe("244923456789");
  });
});

describe("configuração", () => {
  const prod = { NODE_ENV: "production", JWT_SECRET: "x".repeat(32), ENCRYPTION_KEY: "a".repeat(64) };
  it("produção recusa SMS em console e fornecedores sem credenciais", () => {
    expect(() => loadEnv(prod)).toThrow(/SMS_PROVIDER=console/);
    expect(() => loadEnv({ ...prod, SMS_PROVIDER: "ombala" })).toThrow(/OMBALA_API_TOKEN/);
    expect(() => loadEnv({ ...prod, SMS_PROVIDER: "ombala", OMBALA_API_TOKEN: "t", WHATSAPP_PROVIDER: "evolution" })).toThrow(/EVOLUTION_API_URL/);
    expect(loadEnv({ ...prod, SMS_PROVIDER: "ombala", OMBALA_API_TOKEN: "t" }).SMS_PROVIDER).toBe("ombala");
  });
  it("produção não guarda mensagens em memória", async () => {
    const m = new DefaultMessenger({ ...base, NODE_ENV: "production" }, silent);
    await m.sms("923456789", "código 123456");
    expect(m.outbox).toHaveLength(0);
  });
});
