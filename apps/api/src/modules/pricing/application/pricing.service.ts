import { eq } from "drizzle-orm";
import { PricingConfig } from "@fedha/contracts";
import { schema } from "../../../shared/database/client";
import type { Ctx } from "../../../shared/context";
import { unprocessable } from "../../../shared/errors/app-error";
import { getSettings } from "../../admin/application/settings";
import { maxChars } from "../domain/pricing";

export async function getPricing(ctx: Ctx, streamerId: string): Promise<PricingConfig> {
  const row = await ctx.db.query.pricingRules.findFirst({ where: eq(schema.pricingRules.streamerId, streamerId) });
  if (row) return row.data as PricingConfig;
  return (await getSettings(ctx)).defaultPricing;
}

/** S5. Valida faixas (sem sobreposição, preço a subir) e limites da plataforma. Não afeta pedidos já criados. */
export async function updatePricing(ctx: Ctx, streamerId: string, input: unknown): Promise<PricingConfig> {
  const parsed = PricingConfig.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0]!;
    throw unprocessable("pricing_invalid", issue.message, { path: issue.path.join(".") });
  }
  const p = parsed.data;
  const settings = await getSettings(ctx);
  if (maxChars(p) > settings.maxCharsCeiling)
    throw unprocessable("pricing_invalid", `O limite máximo é ${settings.maxCharsCeiling} caracteres.`, { path: "textTiers" });
  const voiceIds = new Set((await ctx.db.select({ id: schema.voices.id }).from(schema.voices)).map((v) => v.id));
  if (!voiceIds.has(p.defaultVoiceId)) throw unprocessable("pricing_invalid", "Voz padrão inexistente.", { path: "defaultVoiceId" });
  if (p.premiumVoiceIds.some((v) => !voiceIds.has(v))) throw unprocessable("pricing_invalid", "Voz premium inexistente.", { path: "premiumVoiceIds" });
  const effectIds = new Set((await ctx.db.select({ id: schema.soundEffects.id }).from(schema.soundEffects)).map((v) => v.id));
  if (p.effectIds.some((e) => !effectIds.has(e))) throw unprocessable("pricing_invalid", "Efeito inexistente.", { path: "effectIds" });

  await ctx.db
    .insert(schema.pricingRules)
    .values({ streamerId, data: p, updatedAt: ctx.now() })
    .onConflictDoUpdate({ target: schema.pricingRules.streamerId, set: { data: p, updatedAt: ctx.now() } });
  return p;
}
