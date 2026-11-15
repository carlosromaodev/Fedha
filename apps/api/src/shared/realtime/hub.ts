import type { WebSocket } from "ws";
import { uuid } from "../security/ids";

export type OutputKind = "overlay" | "goal" | "ranking" | "latest" | "qr" | "combined" | "player";

export interface OutputConnection {
  id: string;
  streamerId: string;
  kind: OutputKind;
  tokenId: string | null;
  layout: string | null;
  userAgent: string | null;
  ip: string | null;
  /** Cenário indicado pelo overlay na mensagem hello (c1–c4). */
  scenario?: string | null;
  connectedAt: Date;
  lastPingAt: Date;
  socket: WebSocket;
}

interface DashboardConnection {
  id: string;
  streamerId: string;
  userId: string;
  socket: WebSocket;
}

type OrderListener = (event: string, data: unknown) => void;

/** Ligações em tempo real (um só processo). Para várias instâncias, trocar por Redis pub/sub. */
export class RealtimeHub {
  private outputs = new Map<string, OutputConnection>();
  private dashboards = new Map<string, DashboardConnection>();
  private orderListeners = new Map<string, Set<OrderListener>>();
  /** Última vez que uma saída de cada widget fechou (para o estado "a religar"). */
  private lastClosed = new Map<string, number>();
  onOutputsChanged: (streamerId: string) => void = () => {};

  addOutput(c: Omit<OutputConnection, "id" | "connectedAt" | "lastPingAt">): OutputConnection {
    const conn: OutputConnection = { ...c, id: uuid(), connectedAt: new Date(), lastPingAt: new Date() };
    this.outputs.set(conn.id, conn);
    this.onOutputsChanged(c.streamerId);
    return conn;
  }
  removeOutput(id: string) {
    const c = this.outputs.get(id);
    if (!c) return;
    this.outputs.delete(id);
    this.lastClosed.set(`${c.streamerId}:${c.kind}`, Date.now());
    this.onOutputsChanged(c.streamerId);
  }
  getOutput(id: string) {
    return this.outputs.get(id);
  }
  outputsOf(streamerId: string, kinds?: OutputKind[]): OutputConnection[] {
    return [...this.outputs.values()].filter((c) => c.streamerId === streamerId && (!kinds || kinds.includes(c.kind)));
  }
  closedRecently(streamerId: string, kind: OutputKind, withinMs = 30_000) {
    const t = this.lastClosed.get(`${streamerId}:${kind}`);
    return t !== undefined && Date.now() - t < withinMs;
  }
  /** Avisa ("revoked") e fecha as ligações de um token revogado. */
  dropToken(tokenId: string) {
    for (const c of this.outputs.values()) if (c.tokenId === tokenId) {
      safeSend(c.socket, { type: "revoked", data: {} });
      c.socket.close(4001, "token revogado");
    }
  }

  sendTo(conn: OutputConnection, type: string, data: unknown) {
    safeSend(conn.socket, { type, data });
  }
  broadcastOutputs(streamerId: string, type: string, data: unknown, kinds?: OutputKind[]) {
    for (const c of this.outputsOf(streamerId, kinds)) safeSend(c.socket, { type, data });
  }

  addDashboard(streamerId: string, userId: string, socket: WebSocket) {
    const id = uuid();
    this.dashboards.set(id, { id, streamerId, userId, socket });
    return id;
  }
  removeDashboard(id: string) {
    this.dashboards.delete(id);
  }
  publishDashboard(streamerId: string, type: string, data: unknown) {
    for (const d of this.dashboards.values()) if (d.streamerId === streamerId) safeSend(d.socket, { type, data });
  }

  subscribeOrder(orderId: string, fn: OrderListener): () => void {
    let set = this.orderListeners.get(orderId);
    if (!set) this.orderListeners.set(orderId, (set = new Set()));
    set.add(fn);
    return () => {
      set!.delete(fn);
      if (set!.size === 0) this.orderListeners.delete(orderId);
    };
  }
  publishOrder(orderId: string, event: string, data: unknown) {
    for (const fn of this.orderListeners.get(orderId) ?? []) fn(event, data);
  }

  closeAll() {
    for (const c of this.outputs.values()) c.socket.close(1001);
    for (const d of this.dashboards.values()) d.socket.close(1001);
  }
}

function safeSend(socket: WebSocket, msg: unknown) {
  if (socket.readyState === 1) socket.send(JSON.stringify(msg));
}
