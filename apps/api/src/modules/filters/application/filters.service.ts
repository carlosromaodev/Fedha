import { and, eq, isNull, or } from "drizzle-orm";
import { schema } from "../../../shared/database/client";
import type { Ctx } from "../../../shared/context";
import { uuid } from "../../../shared/security/ids";
import { checkText } from "../domain/filters";

export async function blockedWordsFor(ctx: Ctx, streamerId: string): Promise<{ base: string[]; own: string[] }> {
  const rows = await ctx.db
    .select({ word: schema.blockedWords.word, streamerId: schema.blockedWords.streamerId })
    .from(schema.blockedWords)
    .where(or(isNull(schema.blockedWords.streamerId), eq(schema.blockedWords.streamerId, streamerId)));
  return { base: rows.filter((r) => !r.streamerId).map((r) => r.word), own: rows.filter((r) => r.streamerId).map((r) => r.word) };
}

export async function checkMessageText(ctx: Ctx, streamerId: string, text: string) {
  const { base, own } = await blockedWordsFor(ctx, streamerId);
  return checkText(text, [...base, ...own]);
}

export async function setStreamerWords(ctx: Ctx, streamerId: string, words: string[]) {
  const unique = [...new Set(words.map((w) => w.trim().toLowerCase()).filter(Boolean))];
  await ctx.db.transaction(async (tx) => {
    await tx.delete(schema.blockedWords).where(eq(schema.blockedWords.streamerId, streamerId));
    if (unique.length) await tx.insert(schema.blockedWords).values(unique.map((word) => ({ id: uuid(), streamerId, word })));
  });
  return unique;
}

export async function setBaseWords(ctx: Ctx, words: string[]) {
  const unique = [...new Set(words.map((w) => w.trim().toLowerCase()).filter(Boolean))];
  await ctx.db.transaction(async (tx) => {
    await tx.delete(schema.blockedWords).where(isNull(schema.blockedWords.streamerId));
    if (unique.length) await tx.insert(schema.blockedWords).values(unique.map((word) => ({ id: uuid(), streamerId: null, word })));
  });
  return unique;
}

/** Remetente bloqueado por este streamer ou globalmente (antifraude). */
export async function isDonorBlocked(ctx: Ctx, streamerId: string, phone?: string | null, deviceId?: string | null) {
  if (!phone && !deviceId) return false;
  const who = [phone ? eq(schema.blockedDonors.phone, phone) : undefined, deviceId ? eq(schema.blockedDonors.deviceId, deviceId) : undefined].filter(Boolean);
  const row = await ctx.db.query.blockedDonors.findFirst({
    where: and(or(isNull(schema.blockedDonors.streamerId), eq(schema.blockedDonors.streamerId, streamerId)), or(...who)),
  });
  return !!row;
}

export async function blockDonor(ctx: Ctx, streamerId: string | null, input: { phone?: string | null; deviceId?: string | null; reason?: string }) {
  const id = uuid();
  await ctx.db.insert(schema.blockedDonors).values({ id, streamerId, phone: input.phone ?? null, deviceId: input.deviceId ?? null, reason: input.reason ?? "", createdAt: ctx.now() });
  return id;
}
