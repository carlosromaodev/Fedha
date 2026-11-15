import { useCallback, useEffect, useState } from "react";
import { api, hasApi } from "../../shared/api/client";
import type { Platform } from "../../shared/mocks/data";
import { WIDGETS, type Conn, type WidgetDef, type WidgetId, type WidgetTheme } from "./widgets";

/** Configuração de um widget, igual à que o overlay recebe na mensagem "config". */
export interface WidgetConfig {
  theme: WidgetTheme;
  accent: string;
  size: "p" | "m" | "g";
  showName: boolean;
  showValue: boolean;
  karaoke: boolean;
  reduceMotion: boolean;
  highlightFrom: number;
  superFrom: number;
  enterMs: number;
  exitMs: number;
  gapMs: number;
  volume: number;
  entrySound?: string;
  superSound?: string;
  voiceId?: string;
  qrCall?: string;
}

export interface WidgetState extends WidgetDef { openCount: number; config: WidgetConfig }

export const DEFAULT_CONFIG: WidgetConfig = {
  theme: "claro", accent: "#C9F25C", size: "m", showName: true, showValue: true, karaoke: true, reduceMotion: false,
  highlightFrom: 1000, superFrom: 5000, enterMs: 500, exitMs: 400, gapMs: 1500, volume: 0.8, qrCall: "Manda a tua mensagem!",
};

type ApiWidget = { id: WidgetId; token: string; conn: Conn; where?: string; openCount?: number; config?: Partial<WidgetConfig> };

const mock = (): WidgetState[] => WIDGETS.map((w) => ({ ...w, openCount: w.id === "w1" ? 2 : w.conn === "aberto" ? 1 : 0, config: { ...DEFAULT_CONFIG } }));

/** Estado dos widgets vindo de GET /v1/widgets (ou dados de exemplo sem API). */
export function useWidgets() {
  const [list, setList] = useState<WidgetState[]>(mock);
  const [destination, setDest] = useState<Platform>("tiktok");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(hasApi);

  const reload = useCallback(async () => {
    if (!hasApi) return;
    setLoading(true);
    try {
      const [ws, d] = await Promise.all([api<ApiWidget[]>("/widgets"), api<{ destination: Platform }>("/streamer/destination")]);
      setList(WIDGETS.map((def) => {
        const w = ws.find((x) => x.id === def.id);
        return { ...def, token: w?.token ?? def.token, conn: w?.conn ?? "fechado", where: w?.where, openCount: w?.openCount ?? 0, config: { ...DEFAULT_CONFIG, ...w?.config } };
      }));
      setDest(d.destination);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const setDestination = async (d: Platform) => {
    setDest(d);
    if (hasApi) await api("/streamer/destination", { method: "PUT", json: { destination: d } }).catch((e) => setError((e as Error).message));
  };
  const save = async (id: WidgetId, config: WidgetConfig) => {
    if (hasApi) {
      const saved = await api<WidgetConfig>(`/widgets/${id}`, { method: "PUT", json: config });
      setList((l) => l.map((w) => (w.id === id ? { ...w, config: saved } : w)));
      return saved;
    }
    setList((l) => l.map((w) => (w.id === id ? { ...w, config } : w)));
    return config;
  };
  const regenerate = async (id: WidgetId) => {
    const token = hasApi ? (await api<{ token: string }>(`/widgets/${id}/token`, { method: "POST" })).token : Math.random().toString(16).slice(2, 10);
    setList((l) => l.map((w) => (w.id === id ? { ...w, token, conn: "fechado", openCount: 0 } : w)));
    return token;
  };
  const sendTest = async () => { if (hasApi) await api("/widgets/test", { method: "POST", json: {} }); };

  return { list, destination, setDestination, save, regenerate, sendTest, reload, error, loading, live: hasApi };
}

export async function lastTest(): Promise<{ sentAt: string | null; pageOpen: boolean; played: boolean }> {
  if (!hasApi) return { sentAt: "21:02", pageOpen: true, played: false };
  return api("/widgets/last-test");
}
