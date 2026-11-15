import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import type { PublicGoal } from "@fedha/contracts";
import { schema } from "../../../shared/database/client";
import type { Ctx } from "../../../shared/context";
import { conflict, notFound } from "../../../shared/errors/app-error";
import { uuid } from "../../../shared/security/ids";

type Goal = typeof schema.goals.$inferSelect;

/** Progresso = soma das mensagens pagas (não reembolsadas) entre o início e o fim da meta. */
async function current(ctx: Ctx, g: Goal) {
  const [r] = await ctx.db.select({ s: sql<string>`coalesce(sum(${schema.orders.amount}), 0)` }).from(schema.orders).where(and(
    eq(schema.orders.streamerId, g.streamerId),
    inArray(schema.orders.status, ["queued", "playing", "played"]),
    gte(schema.orders.paidAt, g.startsAt),
    g.closedAt ? lte(schema.orders.paidAt, g.closedAt) : g.endsAt ? lte(schema.orders.paidAt, g.endsAt) : undefined,
  ));
  return Number(r!.s);
}

export async function goalView(ctx: Ctx, g: Goal) {
  const c = await current(ctx, g);
  return {
    id: g.id, title: g.title, target: g.target, current: c, startsAt: g.startsAt.toISOString(), endsAt: g.endsAt?.toISOString() ?? null,
    status: g.status as "active" | "closed", closedAt: g.closedAt?.toISOString() ?? null, reached: c >= g.target,
  };
}

export async function activeGoal(ctx: Ctx, streamerId: string): Promise<PublicGoal | null> {
  const g = await ctx.db.query.goals.findFirst({ where: and(eq(schema.goals.streamerId, streamerId), eq(schema.goals.status, "active")), orderBy: desc(schema.goals.createdAt) });
  if (!g) return null;
  if (g.endsAt && g.endsAt < ctx.now()) {
    await ctx.db.update(schema.goals).set({ status: "closed", closedAt: g.endsAt }).where(eq(schema.goals.id, g.id));
    return null;
  }
  return { id: g.id, title: g.title, current: await current(ctx, g), target: g.target, endsAt: g.endsAt?.toISOString() ?? null };
}

export async function listGoals(ctx: Ctx, streamerId: string) {
  const rows = await ctx.db.select().from(schema.goals).where(eq(schema.goals.streamerId, streamerId)).orderBy(desc(schema.goals.createdAt));
  return Promise.all(rows.map((g) => goalView(ctx, g)));
}

/** Só uma meta ativa de cada vez. */
export async function createGoal(ctx: Ctx, streamerId: string, input: { title: string; target: number; endsAt?: string | null }) {
  if (await activeGoal(ctx, streamerId)) throw conflict("goal_active", "Já tens uma meta ativa. Encerra-a antes de criar outra.");
  const id = uuid();
  await ctx.db.insert(schema.goals).values({ id, streamerId, title: input.title, target: input.target, endsAt: input.endsAt ? new Date(input.endsAt) : null, startsAt: ctx.now(), createdAt: ctx.now() });
  ctx.bus.emit("goal.updated", { streamerId });
  return goalView(ctx, (await ctx.db.query.goals.findFirst({ where: eq(schema.goals.id, id) }))!);
}

export async function closeGoal(ctx: Ctx, streamerId: string, id: string) {
  const g = await ctx.db.query.goals.findFirst({ where: and(eq(schema.goals.id, id), eq(schema.goals.streamerId, streamerId)) });
  if (!g) throw notFound("Meta");
  if (g.status === "closed") return goalView(ctx, g);
  await ctx.db.update(schema.goals).set({ status: "closed", closedAt: ctx.now() }).where(eq(schema.goals.id, id));
  ctx.bus.emit("goal.updated", { streamerId });
  return goalView(ctx, (await ctx.db.query.goals.findFirst({ where: eq(schema.goals.id, id) }))!);
}
