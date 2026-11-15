export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export const badRequest = (code: string, message: string, details?: Record<string, unknown>) => new AppError(400, code, message, details);
export const unauthorized = (message = "Sessão inválida ou expirada.", code = "unauthorized") => new AppError(401, code, message);
export const forbidden = (message = "Não tens permissão para esta ação.", code = "forbidden") => new AppError(403, code, message);
export const notFound = (what = "Recurso") => new AppError(404, "not_found", `${what} não encontrado.`);
export const conflict = (code: string, message: string, details?: Record<string, unknown>) => new AppError(409, code, message, details);
export const unprocessable = (code: string, message: string, details?: Record<string, unknown>) => new AppError(422, code, message, details);
export const tooMany = (message = "Demasiadas tentativas. Tenta mais tarde.") => new AppError(429, "too_many_requests", message);
