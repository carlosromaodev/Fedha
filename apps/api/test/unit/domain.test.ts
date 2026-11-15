import { describe, expect, it } from "vitest";
import { PricingConfig } from "@fedha/contracts";
import { countChars, priceMessage, PLATFORM_MIN_AMOUNT } from "../../src/modules/pricing/domain/pricing";
import { checkText } from "../../src/modules/filters/domain/filters";
import { sortQueue } from "../../src/modules/queue/domain/ordering";
import { DEFAULT_SETTINGS } from "../../src/modules/admin/application/settings";

const P = PricingConfig.parse(DEFAULT_SETTINGS.defaultPricing);

describe("preços (RN-PRE)", () => {
  it("RN-PRE-01: faixas por omissão 500 / 1.000 / 2.000 Kz e máximo de 200 caracteres", () => {
    expect(priceMessage(P, { kind: "text", text: "a".repeat(50) }).total).toBe(500);
    expect(priceMessage(P, { kind: "text", text: "a".repeat(51) }).total).toBe(1000);
    expect(priceMessage(P, { kind: "text", text: "a".repeat(101) }).total).toBe(2000);
    expect(priceMessage(P, { kind: "text", text: "a".repeat(201) }).problem?.code).toBe("text_too_long");
  });
  it("RN-PRE-02: emoji conta 1, espaços repetidos e nas pontas não contam", () => {
    expect(countChars("  olá   mano 👋🏽  ")).toBe(10);
    expect(countChars("🇦🇴")).toBe(1);
  });
  it("RN-PRE-03: faixas sobrepostas ou com preço a descer são recusadas", () => {
    const bad = { ...DEFAULT_SETTINGS.defaultPricing, textTiers: [{ maxChars: 50, price: 1000 }, { maxChars: 40, price: 500 }] };
    expect(PricingConfig.safeParse(bad).success).toBe(false);
  });
  it("RN-PRE-04/06: voz premium +1.000, efeito +500, prioridade +1.000", () => {
    const r = priceMessage(P, { kind: "text", text: "olá", voiceId: "ngola", effectId: "moeda", priority: true });
    expect(r.total).toBe(500 + 1000 + 500 + 1000);
    expect(r.lines.map((l) => l.kz)).toEqual([500, 1000, 500, 1000]);
  });
  it("RN-PRE-05: áudio por escalão e sempre mais caro do que o texto mais caro", () => {
    expect(priceMessage(P, { kind: "audio", audioTierSeconds: 20 }).total).toBe(8000);
    const cheap = { ...DEFAULT_SETTINGS.defaultPricing, audioTiers: [{ seconds: 10, price: 1500 }] };
    expect(PricingConfig.safeParse(cheap).success).toBe(false);
  });
  it("RN-PRE-07: nunca abaixo do mínimo da plataforma (100 Kz)", () => {
    expect(PLATFORM_MIN_AMOUNT).toBe(100);
    const tiny = PricingConfig.parse({ ...DEFAULT_SETTINGS.defaultPricing, minAmount: 0, textTiers: [{ maxChars: 50, price: 50 }, { maxChars: 100, price: 1000 }, { maxChars: 200, price: 2000 }] });
    expect(priceMessage(tiny, { kind: "text", text: "olá" }).problem?.code).toBe("below_minimum");
  });
});

describe("filtros (RN-MSG)", () => {
  it.each([
    "segue o meu canal em www.site.com",
    "vê fedha . live / kiami",
    "manda para kiami@gmail.com",
    "liga já 9 2 3 4 5 6 7 8 9",
    "+244 923 456 789",
    "lê o qr code no ecrã",
  ])("RN-MSG-02: bloqueia sempre links, emails, telefones e QR: %s", (t) => {
    expect(checkText(t, [])).not.toBeNull();
  });
  it("RN-MSG-01: lista do streamer, mesmo com letras trocadas", () => {
    expect(checkText("és um p4lhaço", ["palhaço"])).not.toBeNull();
    expect(checkText("boa live mano, és o maior", ["palhaço"])).toBeNull();
    expect(checkText("Boa noite. Com amor de Viana, nota 10 de 10", [])).toBeNull();
  });
});

describe("fila (RN-FIL-02)", () => {
  const at = (m: number) => new Date(2026, 10, 15, 20, m);
  const items = [
    { id: "a", priority: false, amount: 500, paidAt: at(1) },
    { id: "b", priority: true, amount: 1500, paidAt: at(3) },
    { id: "c", priority: false, amount: 5000, paidAt: at(2) },
    { id: "d", priority: true, amount: 9000, paidAt: at(4) },
  ];
  it("prioridade paga primeiro, depois por ordem de pagamento", () => {
    expect(sortQueue(items, "arrival").map((x) => x.id)).toEqual(["b", "d", "a", "c"]);
  });
  it("opção do streamer: por valor dentro de cada grupo", () => {
    expect(sortQueue(items, "amount").map((x) => x.id)).toEqual(["d", "b", "c", "a"]);
  });
});

describe("predefinições do SDD", () => {
  it("comissão, retenção, levantamentos, KYC e limites por doador", () => {
    expect(DEFAULT_SETTINGS).toMatchObject({
      platformFeePercent: 10, retentionHours: 48, cardRetentionHours: 168, withdrawalMin: 5000, withdrawalFee: 300,
      manualReviewAbove: 500_000, newAccountDays: 30, kycUnverifiedLimit: 50_000, donorDailyMaxMessages: 20, donorDailyMaxAmount: 100_000,
      mcxTtlMinutes: 5, referenceTtlMinutes: 60, unplayedRefundDays: 7, unclaimedRefundDays: 90, audioRetentionDays: 30,
    });
  });
});
