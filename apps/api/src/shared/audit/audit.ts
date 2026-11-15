import { schema, type DbOrTx } from "../database/client";
import { uuid } from "../security/ids";
import type { Ctx } from "../context";

export interface AuditInput {
  actorId?: string | null;
  actorType: "streamer" | "assistant" | "admin" | "system" | "donor";
  action: string;
  targetType?: string;
  targetId?: string;
  streamerId?: string | null;
  data?: Record<string, unknown>;
  ip?: string | null;
}

/** Registo de auditoria (ações administrativas, de reprodução e financeiras), com autor, data e IP. */
export async function audit(ctx: Ctx, input: AuditInput, db: DbOrTx = ctx.db) {
  await db.insert(schema.auditLog).values({
    id: uuid(),
    actorId: input.actorId ?? null,
    actorType: input.actorType,
    action: input.action,
    targetType: input.targetType ?? null,
    targetId: input.targetId ?? null,
    streamerId: input.streamerId ?? null,
    data: input.data ?? null,
    ip: input.ip ?? null,
    createdAt: ctx.now(),
  });
}
