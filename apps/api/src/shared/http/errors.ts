import type { FastifyError, FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { AppError } from "../errors/app-error";

/** Todas as respostas de erro seguem { error: { code, message, field?, details? } }. */
export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((err: FastifyError & { validation?: unknown }, req, reply) => {
    if (err instanceof AppError) {
      const { field, ...details } = err.details ?? {};
      return reply.status(err.statusCode).send({
        error: { code: err.code, message: err.message, ...(field ? { field: String(field) } : {}), ...(Object.keys(details).length ? { details } : {}) },
      });
    }
    const zod = err instanceof ZodError ? err : (err.cause instanceof ZodError ? err.cause : null);
    if (zod || err.code === "FST_ERR_VALIDATION") {
      const issues = zod?.issues ?? [];
      const first = issues[0];
      return reply.status(400).send({
        error: {
          code: "validation_error",
          message: first?.message ?? err.message,
          ...(first?.path?.length ? { field: first.path.join(".") } : {}),
          details: { issues: issues.map((i) => ({ path: i.path.join("."), message: i.message })) },
        },
      });
    }
    if (err.statusCode === 429) return reply.status(429).send({ error: { code: "too_many_requests", message: "Demasiados pedidos. Tenta daqui a pouco." } });
    if (err.statusCode && err.statusCode < 500) return reply.status(err.statusCode).send({ error: { code: err.code ?? "bad_request", message: err.message } });
    req.log.error({ err }, "erro interno");
    return reply.status(500).send({ error: { code: "internal_error", message: "Ocorreu um erro. Tenta de novo." } });
  });
  app.setNotFoundHandler((_req, reply) => reply.status(404).send({ error: { code: "not_found", message: "Rota não encontrada." } }));
}
