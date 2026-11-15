import type { FastifyReply, FastifyRequest } from "fastify";
import type { Ctx } from "../context";
import { forbidden, unauthorized } from "../errors/app-error";
import { authenticate, type User } from "../../modules/auth/application/auth.service";
import { streamerByUser, type Streamer } from "../../modules/streamers/application/streamers.service";
import { assertCan } from "../../modules/admin/application/admin.service";

declare module "fastify" {
  interface FastifyRequest {
    auth?: { user: User; sessionId: string };
  }
}

export function bearer(req: FastifyRequest): string | null {
  const h = req.headers.authorization;
  if (h?.startsWith("Bearer ")) return h.slice(7);
  const q = (req.query as Record<string, string> | undefined)?.access_token;
  return q ?? null;
}

/** preHandler: exige sessão válida e, opcionalmente, um papel. */
export function requireAuth(ctx: Ctx, roles?: Array<"streamer" | "assistant" | "admin">) {
  return async (req: FastifyRequest, _reply: FastifyReply) => {
    const token = bearer(req);
    if (!token) throw unauthorized();
    req.auth = await authenticate(ctx, token);
    if (roles && !roles.includes(req.auth.user.role as "streamer")) throw forbidden();
  };
}

/** Sessão opcional (rotas públicas que se comportam diferente com login). */
export function optionalAuth(ctx: Ctx) {
  return async (req: FastifyRequest) => {
    const token = bearer(req);
    if (token) req.auth = await authenticate(ctx, token).catch(() => undefined);
  };
}

export function requireAdmin(ctx: Ctx, permission: string) {
  const base = requireAuth(ctx, ["admin"]);
  return async (req: FastifyRequest, reply: FastifyReply) => {
    await base(req, reply);
    assertCan(req.auth!.user.adminRole, permission);
  };
}

export function user(req: FastifyRequest): User {
  if (!req.auth) throw unauthorized();
  return req.auth.user;
}

export async function streamerOf(ctx: Ctx, req: FastifyRequest): Promise<Streamer> {
  const s = await streamerByUser(ctx, user(req).id);
  if (!s || s.status === "removed") throw forbidden("Esta conta não tem perfil de streamer.");
  return s;
}

export const ipOf = (req: FastifyRequest) => req.ip ?? null;
export const meta = (req: FastifyRequest) => ({ ip: req.ip ?? null, userAgent: (req.headers["user-agent"] as string | undefined) ?? null });
