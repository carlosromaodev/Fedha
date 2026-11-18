import type { PricingConfig, PriceLine } from "@fedha/contracts";
import { formatKz } from "../../../shared/money/money";

/**
 * Conta caracteres como o doador os vê: remove espaços no início e no fim, junta espaços duplicados
 * e conta cada emoji (grafema) como 1.
 */
export function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

const segmenter = new Intl.Segmenter("pt", { granularity: "grapheme" });
export function countChars(text: string): number {
  let n = 0;
  for (const _ of segmenter.segment(normalizeText(text))) n++;
  return n;
}

export interface ComposeInput {
  kind: "text" | "audio";
  text?: string;
  voiceId?: string;
  effectId?: string | null;
  priority?: boolean;
  audioTierSeconds?: number;
}

export interface PriceResult {
  lines: PriceLine[];
  total: number;
  chars: number;
  nextTier: { atChars: number; price: number } | null;
  /** Problema que impede o pedido (null = ok). */
  problem: { code: string; message: string; field?: string } | null;
  premium: boolean;
}

/** RN-PRE-07: mínimo da plataforma por mensagem. */
export const PLATFORM_MIN_AMOUNT = 100;

export function maxChars(p: PricingConfig) {
  return p.textTiers[p.textTiers.length - 1]!.maxChars;
}

/** Cálculo do preço no servidor (fica congelado no pedido). Total = base + voz premium + efeito + prioridade. */
export function priceMessage(p: PricingConfig, input: ComposeInput): PriceResult {
  const lines: PriceLine[] = [];
  let problem: PriceResult["problem"] = null;
  let chars = 0;
  let nextTier: PriceResult["nextTier"] = null;
  let premium = false;

  if (input.kind === "text") {
    chars = countChars(input.text ?? "");
    if (!p.textEnabled) problem = { code: "text_disabled", message: "Este streamer não aceita mensagens de texto.", field: "kind" };
    else if (chars === 0) problem = { code: "text_empty", message: "Escreve a tua mensagem.", field: "text" };
    else if (chars > maxChars(p)) problem = { code: "text_too_long", message: `A mensagem pode ter no máximo ${maxChars(p)} caracteres.`, field: "text" };
    const tierIdx = p.textTiers.findIndex((t) => chars <= t.maxChars);
    const tier = p.textTiers[tierIdx === -1 ? p.textTiers.length - 1 : tierIdx]!;
    if (chars > 0) lines.push({ label: `Texto · ${chars} caracteres`, kz: tier.price });
    const next = tierIdx >= 0 ? p.textTiers[tierIdx + 1] : undefined;
    if (next && chars > 0) nextTier = { atChars: tier.maxChars + 1, price: next.price };

    if (input.voiceId && p.premiumVoiceIds.includes(input.voiceId) && input.voiceId !== p.defaultVoiceId) {
      if (!p.premiumEnabled) problem ??= { code: "premium_disabled", message: "As vozes premium não estão disponíveis.", field: "voiceId" };
      else {
        premium = true;
        lines.push({ label: "Voz premium", kz: p.premiumVoicePrice });
      }
    }
  } else {
    if (!p.audioEnabled) problem = { code: "audio_disabled", message: "Este streamer não aceita áudio gravado.", field: "kind" };
    const tier = p.audioTiers.find((t) => t.seconds === input.audioTierSeconds);
    if (!tier) problem ??= { code: "audio_tier_invalid", message: "Escolhe um escalão de duração válido.", field: "audioTierSeconds" };
    else lines.push({ label: `Áudio gravado · até ${tier.seconds} s`, kz: tier.price });
  }

  if (input.effectId) {
    if (!p.effectsEnabled || !p.effectIds.includes(input.effectId))
      problem ??= { code: "effect_unavailable", message: "Esse efeito sonoro não está disponível.", field: "effectId" };
    else lines.push({ label: "Efeito sonoro", kz: p.effectPrice });
  }
  if (input.priority) {
    if (!p.priorityEnabled) problem ??= { code: "priority_disabled", message: "A prioridade na fila não está disponível.", field: "priority" };
    else lines.push({ label: "Prioridade na fila", kz: p.priorityPrice });
  }

  const total = lines.reduce((s, l) => s + l.kz, 0);
  // RN-PRE-07: nunca abaixo do mínimo do streamer nem do mínimo da plataforma.
  const min = Math.max(p.minAmount, PLATFORM_MIN_AMOUNT);
  if (!problem && total < min)
    problem = { code: "below_minimum", message: `O valor mínimo por mensagem é ${formatKz(min)}.` };
  return { lines, total, chars, nextTier, problem, premium };
}
