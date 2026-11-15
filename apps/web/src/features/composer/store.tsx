import { createContext, useContext, useState, type ReactNode } from "react";
import type { Extras } from "../../shared/lib/rules";

export type PayMethod = "mcx" | "referencia";

export interface Draft {
  name: string;
  anonymous: boolean;
  kind: "text" | "audio";
  text: string;
  audioSeconds: number;
  audioTier: number;
  voice: string;
  effect: string | null;
  extras: Extras;
  total: number;
  lines: Array<{ label: string; kz: number }>;
  method: PayMethod;
  phone: string;
  orderId: string;
}

const empty: Draft = {
  name: "", anonymous: false, kind: "text", text: "", audioSeconds: 0, audioTier: 10, voice: "nzinga", effect: null,
  extras: { premiumVoice: false, effect: false, priority: false }, total: 0, lines: [], method: "mcx", phone: "", orderId: "FL-8F3A-22C1",
};

const Ctx = createContext<{ draft: Draft; update: (p: Partial<Draft>) => void; reset: () => void } | null>(null);

export function DraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<Draft>(() => {
    try { const s = sessionStorage.getItem("fedha.draft"); if (s) return { ...empty, ...JSON.parse(s) }; } catch { /* sem storage */ }
    return empty;
  });
  const update = (p: Partial<Draft>) => setDraft((d) => {
    const next = { ...d, ...p };
    try { sessionStorage.setItem("fedha.draft", JSON.stringify(next)); } catch { /* sem storage */ }
    return next;
  });
  const reset = () => { try { sessionStorage.removeItem("fedha.draft"); } catch { /* */ } setDraft(empty); };
  return <Ctx.Provider value={{ draft, update, reset }}>{children}</Ctx.Provider>;
}

export function useDraft() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useDraft fora do DraftProvider");
  return c;
}
