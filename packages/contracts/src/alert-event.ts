import { z } from "zod";

/** Evento entregue pela API ao overlay (W1) e ao Player (S3). Uma mensagem toca numa só saída. */
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
});
export type AlertEvent = z.infer<typeof AlertEvent>;

export const AlertAck = z.object({ id: z.string(), playedAt: z.string().datetime() });
export type AlertAck = z.infer<typeof AlertAck>;

export const OutputMode = z.enum(["overlay", "audio_only"]);
export type OutputMode = z.infer<typeof OutputMode>;
