import { pricing, blockedWords } from "../mocks/data";

export interface Extras { premiumVoice: boolean; effect: boolean; priority: boolean }

export function textTier(chars: number) {
  return pricing.text.find((t) => chars <= t.max) ?? pricing.text[pricing.text.length - 1]!;
}

export function priceText(chars: number, extras: Extras) {
  const base = chars === 0 ? 0 : textTier(chars).kz;
  const lines = [{ label: `Texto · ${chars} caracteres`, kz: base }];
  if (extras.premiumVoice) lines.push({ label: "Voz premium", kz: pricing.extras.premiumVoice });
  if (extras.effect) lines.push({ label: "Efeito sonoro", kz: pricing.extras.effect });
  if (extras.priority) lines.push({ label: "Prioridade na fila", kz: pricing.extras.priority });
  return { lines, total: lines.reduce((s, l) => s + l.kz, 0) };
}

export type FilterHit = { kind: "link" | "telefone" | "email" | "palavra"; match: string };

/**
 * Filtros antes do pagamento. Links, emails, telefones e QR estão sempre ligados (não desativáveis),
 * porque a mensagem aparece escrita no ecrã da live.
 */
export function checkMessage(text: string, words: string[] = blockedWords): FilterHit | null {
  const link = text.match(/\b((https?:\/\/)?[a-z0-9-]+\.(com|ao|net|org|io|live|me|co|app|link|ly)(\/\S*)?)\b/i) ?? text.match(/\bwww\.\S+/i);
  if (link) return { kind: "link", match: link[0] };
  const email = text.match(/\S+@\S+\.\S+/);
  if (email) return { kind: "email", match: email[0] };
  const tel = text.replace(/[\s.-]/g, "").match(/(\+?244)?9\d{8}/);
  if (tel) return { kind: "telefone", match: tel[0] };
  const lower = text.toLowerCase();
  const word = words.find((w) => new RegExp(`(^|\\W)${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\W|$)`, "i").test(lower));
  if (word) return { kind: "palavra", match: word };
  return null;
}

export const FILTER_MSG: Record<FilterHit["kind"], string> = {
  link: "Links não podem aparecer na live. Retira-o para continuar.",
  email: "Emails não podem aparecer na live. Retira-o para continuar.",
  telefone: "Números de telefone não podem aparecer na live. Retira-o para continuar.",
  palavra: "Esta palavra não é permitida nesta live. Altera a mensagem para continuar.",
};
