import { and, eq } from "drizzle-orm";
import type { AlertEvent, AlertTier, WidgetConfig } from "@fedha/contracts";
import { schema } from "../../../shared/database/client";
import type { Ctx } from "../../../shared/context";
import type { OutputConnection, OutputKind } from "../../../shared/realtime/hub";
import { audit } from "../../../shared/audit/audit";
import { uuid } from "../../../shared/security/ids";
import { streamerById } from "../../streamers/application/streamers.service";
import { publishSnapshot, queuedOrders } from "../../queue/application/queue.service";
import { publishOrder } from "../../orders/application/orders.service";
import { tokenRowById, widgetConfigFor } from "./widget-config";

interface Playing {
  id: string;
  orderId: string | null;
  connId: string;
  timer: NodeJS.Timeout;
}

interface StreamerState {
  playing: Playing | null;
  nextAt: number;
  wake: NodeJS.Timeout | null;
  /** Alertas de teste e repetições: tocam antes da fila. */
  extra: AlertEvent[];
  busy: boolean;
  again: boolean;
}

/**
 * Motor de reprodução. Cada mensagem paga toca automaticamente, uma de cada vez, numa só saída
 * (overlay ou Player conforme o modo). Só passa a "tocada" quando a saída confirma com ack.
 * Sem saída ligada, a fila espera. Se a saída cair a meio, a mensagem volta para a fila.
 */
export class PlaybackEngine {
  private states = new Map<string, StreamerState>();
  constructor(private ctx: Ctx) {}

  private state(id: string): StreamerState {
    let s = this.states.get(id);
    if (!s) this.states.set(id, (s = { playing: null, nextAt: 0, wake: null, extra: [], busy: false, again: false }));
    return s;
  }

  targetKinds(outputMode: string): OutputKind[] {
    return outputMode === "audio_only" ? ["player"] : ["overlay", "combined"];
  }

  /** Tenta tocar a próxima mensagem. Seguro para chamar a qualquer momento. */
  async pump(streamerId: string): Promise<void> {
    const st = this.state(streamerId);
    if (st.busy) { st.again = true; return; }
    st.busy = true;
    try {
      do {
        st.again = false;
        await this.pumpOnce(streamerId, st);
      } while (st.again);
    } catch (err) {
      this.ctx.log.error({ err, streamerId }, "erro no motor de reprodução");
    } finally {
      st.busy = false;
    }
  }

  private async pumpOnce(streamerId: string, st: StreamerState) {
    if (st.playing) return;
    const s = await streamerById(this.ctx, streamerId);
    const conns = await this.enabledTargets(streamerId, s.outputMode);
    if (conns.length === 0) return;
    const wait = st.nextAt - Date.now();
    if (wait > 0) {
      if (!st.wake) st.wake = setTimeout(() => { st.wake = null; void this.pump(streamerId); }, wait).unref();
      return;
    }
    const conn = conns[0]!;
    const cfg = await widgetConfigFor(this.ctx, conn);

    const extra = st.extra.shift();
    if (extra) {
      this.send(st, conn, { ...extra, ...decorate(extra.amountKz, cfg) }, null);
      return;
    }
    if (s.status !== "active") return;
    const next = (await queuedOrders(this.ctx, s)).find((o) => o.audioKey && o.durationMs);
    if (!next) return;
    const now = this.ctx.now();
    const upd = await this.ctx.db.update(schema.orders).set({ status: "playing", startedAt: now })
      .where(and(eq(schema.orders.id, next.id), eq(schema.orders.status, "queued"))).returning({ id: schema.orders.id });
    if (upd.length === 0) { st.again = true; return; }
    const effect = next.effectId ? await this.ctx.db.query.soundEffects.findFirst({ where: eq(schema.soundEffects.id, next.effectId) }) : null;
    const alert: AlertEvent = {
      id: next.id,
      streamerId,
      donorName: next.donorName,
      amountKz: next.amount,
      kind: next.kind as "text" | "audio",
      text: next.kind === "text" ? next.text : null,
      audioUrl: this.ctx.storage.publicUrl(next.audioKey!),
      durationMs: next.durationMs!,
      showAmount: cfg.showAmount,
      createdAt: (next.paidAt ?? next.createdAt).toISOString(),
      effectUrl: effect?.storageKey ? this.ctx.storage.publicUrl(effect.storageKey) : null,
      voiceId: next.voiceId,
      priority: next.priority,
      ...decorate(next.amount, cfg),
    };
    this.send(st, conn, alert, next.id);
    await publishOrder(this.ctx, next.id);
    await publishSnapshot(this.ctx, streamerId);
  }

  private send(st: StreamerState, conn: OutputConnection, alert: AlertEvent, orderId: string | null) {
    const timeoutMs = alert.durationMs + 45_000;
    const timer = setTimeout(() => void this.release(conn.streamerId, alert.id, "sem confirmação da saída"), timeoutMs).unref();
    st.playing = { id: alert.id, orderId, connId: conn.id, timer };
    this.ctx.hub.sendTo(conn, "alert", alert);
  }

  private async enabledTargets(streamerId: string, outputMode: string) {
    const conns = this.ctx.hub.outputsOf(streamerId, this.targetKinds(outputMode)).sort((a, b) => a.connectedAt.getTime() - b.connectedAt.getTime());
    const out: OutputConnection[] = [];
    for (const c of conns) {
      const row = c.tokenId ? await tokenRowById(this.ctx, c.tokenId) : null;
      if (!row || row.enabled) out.push(c);
    }
    return out;
  }

  /** A saída confirmou que o áudio acabou. */
  async ack(conn: OutputConnection, id: string) {
    const st = this.state(conn.streamerId);
    const p = st.playing;
    if (!p || p.id !== id || p.connId !== conn.id) return;
    clearTimeout(p.timer);
    st.playing = null;
    const s = await streamerById(this.ctx, conn.streamerId);
    st.nextAt = Date.now() + s.intervalSeconds * 1000;
    if (p.orderId) {
      const now = this.ctx.now();
      const o = await this.ctx.db.query.orders.findFirst({ where: eq(schema.orders.id, p.orderId) });
      if (o && o.status === "playing") {
        await this.ctx.db.update(schema.orders).set({ status: "played", playedAt: now, playCount: o.playCount + 1 }).where(eq(schema.orders.id, o.id));
        await audit(this.ctx, { actorType: "system", action: "order.played", targetType: "order", targetId: o.id, streamerId: o.streamerId, data: { output: conn.kind, connectionId: conn.id } });
        this.ctx.bus.emit("order.played", { orderId: o.id, streamerId: o.streamerId });
        await publishOrder(this.ctx, o.id);
      }
    }
    await publishSnapshot(this.ctx, conn.streamerId);
    void this.pump(conn.streamerId);
  }

  async started(conn: OutputConnection, id: string) {
    const st = this.state(conn.streamerId);
    if (st.playing?.id === id) this.ctx.log.debug({ id }, "alerta começou");
  }

  /** Devolve à fila a mensagem em curso (saída caiu, erro de áudio, sem ack). */
  async release(streamerId: string, id: string, reason: string, delayMs = 2000) {
    const st = this.state(streamerId);
    const p = st.playing;
    if (!p || p.id !== id) return;
    clearTimeout(p.timer);
    st.playing = null;
    st.nextAt = Date.now() + delayMs;
    if (p.orderId) {
      await this.ctx.db.update(schema.orders).set({ status: "queued", startedAt: null })
        .where(and(eq(schema.orders.id, p.orderId), eq(schema.orders.status, "playing")));
      this.ctx.log.warn({ orderId: p.orderId, reason }, "mensagem devolvida à fila");
      await publishOrder(this.ctx, p.orderId);
    }
    await publishSnapshot(this.ctx, streamerId);
    void this.pump(streamerId);
  }

  async onDisconnect(conn: OutputConnection) {
    const st = this.state(conn.streamerId);
    if (st.playing?.connId === conn.id) await this.release(conn.streamerId, st.playing.id, "saída desligou", 0);
    else void this.pump(conn.streamerId);
  }

  async onError(conn: OutputConnection, id: string, reason: string) {
    const st = this.state(conn.streamerId);
    if (st.playing?.id === id && st.playing.connId === conn.id) {
      await this.release(conn.streamerId, id, reason, 5000);
      this.ctx.hub.publishDashboard(conn.streamerId, "notification", {
        id: uuid(), event: "output_error", title: "A saída não conseguiu tocar",
        body: reason === "autoplay_blocked" ? "O navegador bloqueou o som. Abre o Player e toca em \"Ativar som\"." : "O áudio não carregou. A mensagem voltou para a fila.",
      });
    }
  }

  /** Alerta de teste (S6) ou repetição de uma mensagem já tocada (S2). */
  enqueueExtra(streamerId: string, alert: AlertEvent) {
    this.state(streamerId).extra.push(alert);
    void this.pump(streamerId);
  }

  /** Recupera mensagens que ficaram "a tocar" depois de um reinício. */
  async recover() {
    const rows = await this.ctx.db.update(schema.orders).set({ status: "queued", startedAt: null }).where(eq(schema.orders.status, "playing")).returning({ id: schema.orders.id });
    if (rows.length) this.ctx.log.warn({ n: rows.length }, "mensagens devolvidas à fila após reinício");
  }

  stop() {
    for (const st of this.states.values()) {
      if (st.playing) clearTimeout(st.playing.timer);
      if (st.wake) clearTimeout(st.wake);
    }
  }

  isPlaying(streamerId: string) {
    return this.states.get(streamerId)?.playing?.id ?? null;
  }
}

/** Nível (normal/destaque/super) pelo valor e regras do widget. */
export function tierFor(amount: number, cfg: WidgetConfig): AlertTier {
  const sorted = [...cfg.tiers].sort((a, b) => b.minAmount - a.minAmount);
  return sorted.find((t) => amount >= t.minAmount)?.tier ?? "normal";
}

function decorate(amount: number, cfg: WidgetConfig): Partial<AlertEvent> {
  return { tier: tierFor(amount, cfg), showAmount: cfg.showAmount };
}
