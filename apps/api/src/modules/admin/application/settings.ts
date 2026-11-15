import { eq } from "drizzle-orm";
import { PlatformSettings } from "@fedha/contracts";
import { schema } from "../../../shared/database/client";
import type { Ctx } from "../../../shared/context";

export const DEFAULT_SETTINGS: PlatformSettings = {
  platformFeePercent: 10,
  withdrawalFee: 300,
  withdrawalMin: 5000,
  retentionHours: 48,
  cardRetentionHours: 24 * 7,
  manualReviewAbove: 500_000,
  newAccountDays: 14,
  kycUnverifiedLimit: 50_000,
  donorDailyMaxMessages: 30,
  donorDailyMaxAmount: 200_000,
  mcxTtlMinutes: 5,
  referenceTtlMinutes: 60,
  activeMethods: ["mcx", "reference"],
  maxCharsCeiling: 300,
  atypicalAmount: 100_000,
  samePhoneHourlyAlert: 10,
  unplayedRefundDays: 7,
  unclaimedRefundDays: 90,
  audioRetentionDays: 30,
  defaultPricing: {
    textEnabled: true,
    textTiers: [
      { maxChars: 50, price: 500 },
      { maxChars: 100, price: 1000 },
      { maxChars: 200, price: 2000 },
    ],
    premiumEnabled: true,
    premiumVoicePrice: 1000,
    premiumVoiceIds: ["ngola"],
    defaultVoiceId: "nzinga",
    audioEnabled: true,
    audioTiers: [
      { seconds: 10, price: 5000 },
      { seconds: 20, price: 8000 },
      { seconds: 30, price: 10000 },
    ],
    effectsEnabled: true,
    effectPrice: 500,
    effectIds: ["moeda", "aplausos", "buzina"],
    priorityEnabled: true,
    priorityPrice: 1000,
    minAmount: 500,
  },
};

const KEY = "platform";
const caches = new WeakMap<object, { at: number; value: PlatformSettings }>();

export async function getSettings(ctx: Ctx): Promise<PlatformSettings> {
  const cache = caches.get(ctx.db);
  if (cache && Date.now() - cache.at < 5000) return cache.value;
  const row = await ctx.db.query.platformSettings.findFirst({ where: eq(schema.platformSettings.key, KEY) });
  const merged = { ...DEFAULT_SETTINGS, ...((row?.value as Partial<PlatformSettings>) ?? {}) };
  caches.set(ctx.db, { at: Date.now(), value: merged });
  return merged;
}

export async function updateSettings(ctx: Ctx, patch: Partial<PlatformSettings>): Promise<PlatformSettings> {
  const current = await getSettings(ctx);
  const next = PlatformSettings.parse({ ...current, ...patch });
  await ctx.db
    .insert(schema.platformSettings)
    .values({ key: KEY, value: next, updatedAt: ctx.now() })
    .onConflictDoUpdate({ target: schema.platformSettings.key, set: { value: next, updatedAt: ctx.now() } });
  caches.delete(ctx.db);
  return next;
}

export function clearSettingsCache(ctx: Ctx) {
  caches.delete(ctx.db);
}
