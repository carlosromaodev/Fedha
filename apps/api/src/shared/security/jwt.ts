import { createHmac } from "node:crypto";
import { safeEqual } from "./crypto";

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");

/** JWT HS256 mínimo (sem dependências). */
export function signJwt(payload: Record<string, unknown>, secret: string, ttlSeconds: number, now = Date.now()): string {
  const iat = Math.floor(now / 1000);
  const head = b64({ alg: "HS256", typ: "JWT" });
  const body = b64({ ...payload, iat, exp: iat + ttlSeconds });
  const sig = createHmac("sha256", secret).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
}

export function verifyJwt<T = Record<string, unknown>>(token: string, secret: string, now = Date.now()): (T & { exp: number; iat: number }) | null {
  const [head, body, sig] = token.split(".");
  if (!head || !body || !sig) return null;
  const expected = createHmac("sha256", secret).update(`${head}.${body}`).digest("base64url");
  if (!safeEqual(sig, expected)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString());
    if (typeof p.exp !== "number" || p.exp * 1000 < now) return null;
    return p;
  } catch {
    return null;
  }
}
