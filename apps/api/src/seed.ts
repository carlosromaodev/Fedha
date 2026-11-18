import { eq, isNull } from "drizzle-orm";
import { schema } from "./shared/database/client";
import type { Ctx } from "./shared/context";
import { uuid } from "./shared/security/ids";
import { hashPassword } from "./shared/security/crypto";
import { wav } from "./integrations/tts/tts";
import { ensureWidgets } from "./modules/playback/application/widgets.service";
import { DEFAULT_PREFS } from "./modules/auth/application/auth.service";

const VOICES = [
  { id: "nzinga", name: "Nzinga", description: "Voz padrão, feminina", premium: false, provider: "azure", providerVoiceId: "pt-PT-RaquelNeural" },
  { id: "kandimba", name: "Kandimba", description: "Masculina, calma", premium: false, provider: "azure", providerVoiceId: "pt-PT-DuarteNeural" },
  { id: "ngola", name: "Ngola", description: "Premium, locutor", premium: true, provider: "azure", providerVoiceId: "pt-BR-AntonioNeural" },
];
const EFFECTS = [
  { id: "moeda", name: "Moeda a cair", tones: [1318, 1760] },
  { id: "aplausos", name: "Aplausos", tones: [0] },
  { id: "buzina", name: "Buzina", tones: [392, 392] },
];
/** Lista base mínima; a equipa de moderação completa-a no back-office (B8). */
const BASE_WORDS = ["burla", "fedhapay", "pix", "aposta", "golpe"];

function effectWav(tones: number[]) {
  const rate = 16000, ms = 700, n = Math.floor((rate * ms) / 1000);
  const pcm = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) {
    const seg = Math.floor((i / n) * tones.length);
    const f = tones[seg]!;
    const env = Math.exp(-((i % (n / tones.length)) / rate) * 6);
    const v = f === 0 ? (Math.random() * 2 - 1) * 0.3 * env : Math.sin((2 * Math.PI * f * i) / rate) * 0.3 * env;
    pcm.writeInt16LE(Math.round(v * 32767), i * 2);
  }
  return wav(pcm, rate);
}

/** Vozes, efeitos e lista base de palavras. Idempotente. */
export async function seedCatalog(ctx: Ctx) {
  for (const v of VOICES) {
    await ctx.db.insert(schema.voices).values(v).onConflictDoNothing();
    const key = `samples/voice-${v.id}.wav`;
    if (!(await ctx.storage.get(key))) {
      const r = await ctx.tts.synthesize(`Olá, eu sou a voz ${v.name} do Fedha Live.`, { provider: v.provider, providerVoiceId: v.providerVoiceId }).catch(() => null);
      if (r) await ctx.storage.put(key, r.data, r.mime);
    }
  }
  for (const e of EFFECTS) {
    const key = `effects/${e.id}.wav`;
    await ctx.db.insert(schema.soundEffects).values({ id: e.id, name: e.name, storageKey: key }).onConflictDoNothing();
    if (!(await ctx.storage.get(key))) await ctx.storage.put(key, effectWav(e.tones), "audio/wav");
  }
  const base = await ctx.db.select().from(schema.blockedWords).where(isNull(schema.blockedWords.streamerId)).limit(1);
  if (base.length === 0) await ctx.db.insert(schema.blockedWords).values(BASE_WORDS.map((word) => ({ id: uuid(), streamerId: null, word })));
}

/** Streamer de demonstração "kiami" (palavra-passe: fedha2026), para desenvolvimento. */
export async function seedDemo(ctx: Ctx) {
  if (await ctx.db.query.streamers.findFirst({ where: eq(schema.streamers.handle, "kiami") })) return;
  const userId = uuid(), streamerId = uuid(), now = ctx.now();
  await ctx.db.insert(schema.users).values({
    id: userId, role: "streamer", displayName: "Kiami Gamer", email: "kiami@fedha.test", phone: "923000001", passwordHash: await hashPassword("fedha2026"),
    birthDate: "1998-04-12", emailVerifiedAt: now, phoneVerifiedAt: now, createdAt: now, updatedAt: now,
  });
  await ctx.db.insert(schema.streamers).values({
    id: streamerId, userId, handle: "kiami", displayName: "Kiami Gamer", bio: "FIFA, Free Fire e conversa da banda. Lives de terça a sábado às 20h.",
    platform: "tiktok", device: "pc", onboardingCompletedAt: now, createdAt: now,
  });
  await ctx.db.insert(schema.notificationPrefs).values({ userId, prefs: DEFAULT_PREFS }).onConflictDoNothing();
  await ensureWidgets(ctx, streamerId);
  ctx.log.info("streamer de demonstração: kiami@fedha.test / fedha2026");
}
