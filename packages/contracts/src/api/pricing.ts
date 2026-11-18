import { z } from "zod";
import { Kz } from "./common";

export const TextTier = z.object({ maxChars: z.number().int().min(1).max(300), price: Kz });
export const AudioTier = z.object({ seconds: z.number().int().min(2).max(60), price: Kz });

/** S5 — Preços e regras do streamer. As faixas de texto vão de 1 até maxChars da última faixa. */
export const PricingConfig = z
  .object({
    textEnabled: z.boolean(),
    textTiers: z.array(TextTier).min(1).max(10),
    premiumEnabled: z.boolean(),
    premiumVoicePrice: Kz,
    premiumVoiceIds: z.array(z.string()),
    defaultVoiceId: z.string(),
    audioEnabled: z.boolean(),
    audioTiers: z.array(AudioTier).max(6),
    effectsEnabled: z.boolean(),
    effectPrice: Kz,
    effectIds: z.array(z.string()),
    priorityEnabled: z.boolean(),
    priorityPrice: Kz,
    minAmount: Kz,
  })
  .superRefine((p, ctx) => {
    p.textTiers.forEach((t, i) => {
      const prev = p.textTiers[i - 1];
      if (prev && t.maxChars <= prev.maxChars)
        ctx.addIssue({ code: "custom", path: ["textTiers", i, "maxChars"], message: "As faixas não se podem sobrepor: cada faixa tem de acabar depois da anterior." });
      if (prev && t.price <= prev.price)
        ctx.addIssue({ code: "custom", path: ["textTiers", i, "price"], message: "O preço tem de subir com o número de caracteres." });
    });
    p.audioTiers.forEach((t, i) => {
      const prev = p.audioTiers[i - 1];
      if (prev && (t.seconds <= prev.seconds || t.price <= prev.price))
        ctx.addIssue({ code: "custom", path: ["audioTiers", i], message: "Os escalões de áudio têm de subir em duração e preço." });
    });
    const maxText = Math.max(...p.textTiers.map((t) => t.price));
    if (p.audioEnabled && p.audioTiers.some((t) => t.price <= maxText))
      ctx.addIssue({ code: "custom", path: ["audioTiers"], message: "O áudio gravado tem de ser sempre mais caro que o texto." });
    if (p.audioEnabled && p.audioTiers.length === 0)
      ctx.addIssue({ code: "custom", path: ["audioTiers"], message: "Define pelo menos um escalão de áudio." });
    if (!p.textEnabled && !p.audioEnabled)
      ctx.addIssue({ code: "custom", path: ["textEnabled"], message: "Ativa pelo menos um tipo de mensagem." });
  });
export type PricingConfig = z.infer<typeof PricingConfig>;

export const Voice = z.object({ id: z.string(), name: z.string(), description: z.string(), premium: z.boolean(), sampleUrl: z.string().nullable() });
export type Voice = z.infer<typeof Voice>;
export const SoundEffect = z.object({ id: z.string(), name: z.string(), url: z.string().nullable() });
export type SoundEffect = z.infer<typeof SoundEffect>;
