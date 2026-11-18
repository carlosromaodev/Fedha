import { EventEmitter } from "node:events";

/** Eventos de domínio. Os módulos comunicam por aqui em vez de usarem o repositório uns dos outros. */
export interface DomainEvents {
  "order.paid": { orderId: string; streamerId: string };
  "order.queued": { orderId: string; streamerId: string };
  "order.updated": { orderId: string; streamerId: string; status: string };
  "order.played": { orderId: string; streamerId: string };
  "order.failed": { orderId: string; streamerId: string; reason: string };
  "payment.updated": { paymentId: string; orderId: string; status: string };
  "withdrawal.updated": { withdrawalId: string; streamerId: string; status: string };
  "kyc.decided": { streamerId: string; status: string };
  "goal.updated": { streamerId: string };
  "settings.updated": { streamerId: string };
}

export class EventBus {
  private ee = new EventEmitter({ captureRejections: true });
  constructor(private onError: (err: unknown, event: string) => void = () => {}) {
    this.ee.setMaxListeners(100);
  }
  on<K extends keyof DomainEvents>(event: K, fn: (p: DomainEvents[K]) => void | Promise<void>) {
    this.ee.on(event, (p: DomainEvents[K]) => {
      Promise.resolve()
        .then(() => fn(p))
        .catch((err) => this.onError(err, event));
    });
  }
  emit<K extends keyof DomainEvents>(event: K, payload: DomainEvents[K]) {
    this.ee.emit(event, payload);
  }
}
