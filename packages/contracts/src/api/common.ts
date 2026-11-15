import { z } from "zod";

/** Formato de erro de toda a API: { error: { code, message, field?, details? } } */
export const ApiError = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    field: z.string().optional(),
    details: z.record(z.unknown()).optional(),
  }),
});
export type ApiError = z.infer<typeof ApiError>;

export const Kz = z.number().int().nonnegative();
export const IsoDate = z.string().datetime();

/** Telemóvel angolano: 9XXXXXXXX, aceita +244 e espaços (normalizado no servidor). */
export const AoPhone = z
  .string()
  .transform((v) => v.replace(/[\s.-]/g, "").replace(/^(\+?244|00244)/, ""))
  .pipe(z.string().regex(/^9\d{8}$/, "Número de telemóvel angolano inválido (9XXXXXXXX)."));

export const Handle = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_.]{3,30}$/, "Usa 3 a 30 letras minúsculas, números, ponto ou _.");

export const Platform = z.enum(["tiktok", "youtube", "twitch", "kick", "facebook", "instagram"]);
export type Platform = z.infer<typeof Platform>;
export const Device = z.enum(["pc", "telemovel"]);
export type Device = z.infer<typeof Device>;

export const PaymentMethod = z.enum(["mcx", "reference", "unitel_money", "afrimoney", "card"]);
export type PaymentMethod = z.infer<typeof PaymentMethod>;

export const Page = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export const paginated = <T extends z.ZodTypeAny>(item: T) =>
  z.object({ items: z.array(item), total: z.number().int(), page: z.number().int(), pageSize: z.number().int() });

export const PriceLine = z.object({ label: z.string(), kz: Kz });
export type PriceLine = z.infer<typeof PriceLine>;
