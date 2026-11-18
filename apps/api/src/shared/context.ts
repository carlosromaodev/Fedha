import type { FastifyBaseLogger } from "fastify";
import type { Env } from "./config/env";
import type { Db } from "./database/client";
import type { EventBus } from "./events/bus";
import type { RealtimeHub } from "./realtime/hub";
import type { Storage } from "../integrations/storage/storage";
import type { TtsEngine } from "../integrations/tts/tts";
import type { DefaultMessenger } from "../integrations/messaging/senders";
import type { PaymentGateway, PaymentMethod } from "../integrations/payments/gateway";
import type { SandboxGateway } from "../integrations/payments/sandbox";

/** Dependências partilhadas, criadas uma vez em app.ts e passadas aos casos de uso. */
export interface Ctx {
  env: Env;
  db: Db;
  log: FastifyBaseLogger;
  bus: EventBus;
  hub: RealtimeHub;
  storage: Storage;
  tts: TtsEngine;
  messenger: DefaultMessenger;
  gateways: {
    forMethod(method: PaymentMethod): PaymentGateway;
    byName(name: string): PaymentGateway | undefined;
    all(): PaymentGateway[];
    sandbox: SandboxGateway;
  };
  /** Relógio injetável (testes avançam o tempo). */
  now: () => Date;
}
