import type { Job } from "./shared/jobs/scheduler";
import type { Ctx } from "./shared/context";
import { getSettings } from "./modules/admin/application/settings";
import { expireStale, purgeAudio, refundUnplayed } from "./modules/payments/application/payments.service";
import { releaseDue } from "./modules/wallet/application/wallet.service";
import { runReconciliation, yesterdayLuanda } from "./modules/reconciliation/application/reconciliation.service";
import { schema } from "./shared/database/client";
import { eq } from "drizzle-orm";

/** Tarefas periódicas: expiração, retenção, reembolsos automáticos, limpeza de áudio e reconciliação diária. */
export function buildJobs(ctx: Ctx): Job[] {
  return [
    { name: "expirar-pagamentos", everyMs: 15_000, run: () => expireStale(ctx) },
    {
      name: "libertar-saldo",
      everyMs: 5 * 60_000,
      run: async () => { const s = await getSettings(ctx); return releaseDue(ctx, s.retentionHours, s.cardRetentionHours); },
    },
    { name: "reembolsar-nao-tocadas", everyMs: 60 * 60_000, run: async () => refundUnplayed(ctx, (await getSettings(ctx)).unplayedRefundDays) },
    { name: "limpar-audio", everyMs: 60 * 60_000, run: async () => purgeAudio(ctx, (await getSettings(ctx)).audioRetentionDays) },
    {
      name: "reconciliacao-diaria",
      everyMs: 60 * 60_000,
      run: async () => {
        const day = yesterdayLuanda(ctx.now());
        const done = await ctx.db.query.reconciliationRuns.findFirst({ where: eq(schema.reconciliationRuns.day, day) });
        if (!done) await runReconciliation(ctx, day);
      },
    },
  ];
}
