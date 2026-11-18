import { and, eq, gte, ilike, inArray, ne, or, sql, desc } from "drizzle-orm";
import type { AcceptState, Device, Platform, StreamerProfile } from "@fedha/contracts";
import { schema } from "../../../shared/database/client";
import type { Ctx } from "../../../shared/context";
import { notFound } from "../../../shared/errors/app-error";
import { getSettings } from "../../admin/application/settings";
import { formatKz } from "../../../shared/money/money";

export type Streamer = typeof schema.streamers.$inferSelect;

export async function streamerByHandle(ctx: Ctx, handle: string): Promise<Streamer> {
  const s = await ctx.db.query.streamers.findFirst({ where: eq(schema.streamers.handle, handle.toLowerCase()) });
  if (!s || s.status === "removed") throw notFound("Streamer");
  return s;
}

export async function streamerById(ctx: Ctx, id: string): Promise<Streamer> {
  const s = await ctx.db.query.streamers.findFirst({ where: eq(schema.streamers.id, id) });
  if (!s) throw notFound("Streamer");
  return s;
}

export async function streamerByUser(ctx: Ctx, userId: string): Promise<Streamer | undefined> {
  return ctx.db.query.streamers.findFirst({ where: eq(schema.streamers.userId, userId) });
}

export async function isHandleAvailable(ctx: Ctx, handle: string) {
  const reserved = ["admin", "api", "painel", "auth", "pedido", "o", "p", "assistente", "fedha", "suporte", "ajuda", "media", "v1"];
  if (reserved.includes(handle)) return false;
  return !(await ctx.db.query.streamers.findFirst({ where: eq(schema.streamers.handle, handle) }));
}

/** Recebido sem KYC (bruto pago, sem reembolsos). */
export async function receivedGross(ctx: Ctx, streamerId: string) {
  const [r] = await ctx.db
    .select({ s: sql<string>`coalesce(sum(${schema.orders.amount}), 0)` })
    .from(schema.orders)
    .where(and(eq(schema.orders.streamerId, streamerId), inArray(schema.orders.status, ["queued", "playing", "played"])));
  return Number(r!.s);
}

/** A mensagem toca agora? Em direto (marcado) ou com uma saída ligada. */
export function isEffectivelyLive(ctx: Ctx, s: Streamer) {
  return s.isLive || ctx.hub.outputsOf(s.id, ["overlay", "combined", "player"]).length > 0;
}

export async function acceptState(ctx: Ctx, s: Streamer): Promise<{ state: AcceptState; message: string | null }> {
  if (s.status !== "active") return { state: "suspended", message: "Este perfil não está a aceitar mensagens." };
  if (!s.acceptingMessages) return { state: "paused", message: "O streamer pausou as mensagens por agora." };
  if (s.kycStatus !== "approved") {
    const settings = await getSettings(ctx);
    if ((await receivedGross(ctx, s.id)) >= settings.kycUnverifiedLimit)
      return { state: "kyc_limit", message: "Este streamer atingiu o limite de mensagens antes da verificação de identidade." };
  }
  if (!isEffectivelyLive(ctx, s)) {
    return s.offlineBehavior === "queue"
      ? { state: "offline_queue", message: "O streamer está offline. A tua mensagem toca na próxima live." }
      : { state: "offline_blocked", message: "O streamer está offline. Volta durante a live para enviar." };
  }
  return { state: "open", message: null };
}

export function profileView(ctx: Ctx, s: Streamer): StreamerProfile {
  return {
    id: s.id, handle: s.handle, displayName: s.displayName, bio: s.bio, avatarUrl: s.avatarUrl, bannerUrl: s.bannerUrl,
    socials: s.socials, thankYouMessage: s.thankYouMessage, showTopDonors: s.showTopDonors, showRecentMessages: s.showRecentMessages,
    offlineBehavior: s.offlineBehavior as "queue" | "block", acceptingMessages: s.acceptingMessages, isLive: isEffectivelyLive(ctx, s),
    platform: s.platform as Platform | null, device: s.device as Device | null, outputMode: s.outputMode as "overlay" | "audio_only",
    queueOrder: s.queueOrder as "arrival" | "amount", intervalMs: s.intervalMs, volume: s.volume,
    kycStatus: s.kycStatus as StreamerProfile["kycStatus"], publicUrl: `${ctx.env.PUBLIC_WEB_URL}/${s.handle}`,
    onboardingCompleted: !!s.onboardingCompletedAt,
  };
}

export async function search(ctx: Ctx, q: string) {
  const rows = await ctx.db
    .select()
    .from(schema.streamers)
    .where(and(eq(schema.streamers.status, "active"), or(ilike(schema.streamers.handle, `%${q}%`), ilike(schema.streamers.displayName, `%${q}%`))))
    .limit(20);
  return rows.map((s) => ({ handle: s.handle, displayName: s.displayName, avatarUrl: s.avatarUrl, isLive: isEffectivelyLive(ctx, s), verified: s.kycStatus === "approved" }));
}

export async function topDonors(ctx: Ctx, streamerId: string, since: Date | null, limit = 5) {
  const rows = await ctx.db
    .select({ donorName: schema.orders.donorName, total: sql<string>`sum(${schema.orders.amount})`, count: sql<string>`count(*)` })
    .from(schema.orders)
    .where(and(
      eq(schema.orders.streamerId, streamerId),
      inArray(schema.orders.status, ["queued", "playing", "played"]),
      eq(schema.orders.anonymous, false),
      since ? gte(schema.orders.paidAt, since) : undefined,
    ))
    .groupBy(schema.orders.donorName)
    .orderBy(desc(sql`sum(${schema.orders.amount})`))
    .limit(limit);
  return rows.map((r) => ({ donorName: r.donorName, total: Number(r.total), count: Number(r.count) }));
}

export async function recentPlayed(ctx: Ctx, streamerId: string, limit = 5) {
  const rows = await ctx.db
    .select()
    .from(schema.orders)
    .where(and(eq(schema.orders.streamerId, streamerId), eq(schema.orders.status, "played")))
    .orderBy(desc(schema.orders.playedAt))
    .limit(limit);
  return rows.map((o) => ({ id: o.id, donorName: o.donorName, text: o.kind === "text" ? o.text : null, kind: o.kind as "text" | "audio", amount: o.amount, at: (o.playedAt ?? o.createdAt).toISOString() }));
}

export async function otherStreamersWithPhone(ctx: Ctx, phone: string, streamerId: string) {
  return ctx.db
    .select({ id: schema.streamers.id })
    .from(schema.streamers)
    .innerJoin(schema.users, eq(schema.users.id, schema.streamers.userId))
    .where(and(eq(schema.users.phone, phone), ne(schema.streamers.id, streamerId)));
}

// ------------------------------------------------------------- onboarding (A6 / "Onde fazes live?")
const NO_QR: Platform[] = ["tiktok", "instagram"];

export function onboardingGuide(platform: Platform, device: Device) {
  const qrAllowed = !NO_QR.includes(platform);
  if (device === "pc") {
    if (platform === "tiktok")
      return {
        scenario: "C2" as const, guide: "G2" as const, outputMode: "overlay" as const, qrAllowed, experimental: false,
        title: "TikTok LIVE Studio no PC",
        steps: [
          "Abre o TikTok LIVE Studio e carrega em Adicionar fonte → Link.",
          "Cola o teu link de overlay e define 1920×1080 (ou 1080×1920 em vertical).",
          "Se a fonte aparecer vazia (0×0), usa o OBS com a Câmara Virtual e escolhe-a no LIVE Studio.",
          "Envia um alerta de teste para confirmar o som e a imagem.",
        ],
      };
    return {
      scenario: "C1" as const, guide: "G1" as const, outputMode: "overlay" as const, qrAllowed, experimental: false,
      title: "OBS ou Streamlabs no PC",
      steps: [
        "No OBS, carrega em + → Navegador (Browser Source).",
        "Cola o teu link de overlay, largura 1920 e altura 1080.",
        "Ativa \"Controlar áudio pelo OBS\" para o som entrar na live.",
        "Envia um alerta de teste.",
      ],
    };
  }
  if (platform === "tiktok" || platform === "instagram")
    return {
      scenario: "C5" as const, guide: "G5" as const, outputMode: "audio_only" as const, qrAllowed, experimental: false,
      title: "App nativa no telemóvel (só áudio)",
      steps: [
        "A app nativa não aceita sobreposições: o Fedha toca só o áudio.",
        "Abre o Player noutro aparelho ligado a uma coluna, ou no mesmo telemóvel com o volume alto.",
        "Toca em \"Ativar som\" e mantém o ecrã ligado.",
        "Opcional (experimental): com PRISM ou CameraFi Live tens alerta visual. Vê o guia G3/G4.",
      ],
    };
  return {
    scenario: "C3" as const, guide: "G3" as const, outputMode: "overlay" as const, qrAllowed, experimental: false,
    title: "PRISM ou CameraFi Live no telemóvel",
    steps: [
      "Na PRISM Live Studio, adiciona um widget Web; na CameraFi Live, adiciona uma sobreposição URL.",
      "Cola o teu link de overlay em formato vertical (1080×1920).",
      "Confirma que o áudio do widget está ligado.",
      "Envia um alerta de teste.",
    ],
  };
}

export const describeLimit = (n: number) => formatKz(n);
