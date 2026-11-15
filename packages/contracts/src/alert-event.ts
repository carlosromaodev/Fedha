import { z } from "zod";

/** Nível visual do alerta por valor (configurado no W1). */
export const AlertTier = z.enum(["normal", "destaque", "super"]);
export type AlertTier = z.infer<typeof AlertTier>;

/** Evento entregue pela API ao overlay (W1/W6) e ao Player (S3). Uma mensagem toca numa só saída. */
export const AlertEvent = z.object({
  id: z.string(),
  streamerId: z.string(),
  donorName: z.string().max(40),
  amountKz: z.number().int().nonnegative(),
  kind: z.enum(["text", "audio"]),
  text: z.string().max(500).nullable(),
  audioUrl: z.string().url(),
  durationMs: z.number().int().positive(),
  showAmount: z.boolean(),
  createdAt: z.string().datetime(),
  // Campos opcionais acrescentados pelo backend (não quebram clientes antigos).
  /** Som de entrada a tocar antes da mensagem. */
  effectUrl: z.string().url().nullable().optional(),
  tier: AlertTier.optional(),
  voiceId: z.string().nullable().optional(),
  priority: z.boolean().optional(),
  /** Alerta de teste (não conta para nada). */
  isTest: z.boolean().optional(),
  /** Repetição pedida pelo streamer de uma mensagem já tocada. */
  isReplay: z.boolean().optional(),
});
export type AlertEvent = z.infer<typeof AlertEvent>;

/** Enviado pela saída quando o áudio acaba. Só então a mensagem passa a "tocada". */
export const AlertAck = z.object({ id: z.string(), playedAt: z.string().datetime() });
export type AlertAck = z.infer<typeof AlertAck>;

export const OutputMode = z.enum(["overlay", "audio_only"]);
export type OutputMode = z.infer<typeof OutputMode>;
