import type { FilterHit } from "@fedha/contracts";

export const FILTER_MESSAGES: Record<FilterHit["kind"], string> = {
  link: "Links não podem aparecer na live. Retira-o para continuar.",
  email: "Emails não podem aparecer na live. Retira-o para continuar.",
  telefone: "Números de telefone não podem aparecer na live. Retira-o para continuar.",
  qr: "Códigos e referências de pagamento não podem aparecer na live. Retira-os para continuar.",
  palavra: "Esta palavra não é permitida nesta live. Altera a mensagem para continuar.",
};

const TLDS = "com|ao|net|org|io|live|me|co|app|link|ly|gg|tv|pt|br|info|xyz|site|online|store|shop|bio|to|cc|biz";

/** Remove truques comuns para esconder links e números (pontos por extenso, espaços entre dígitos, letras parecidas). */
function deobfuscate(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s*[\[(]\s*(dot|ponto)\s*[\])]\s*|\s+(dot|ponto)\s+/g, ".")
    .replace(/\s*[\[(]\s*(at|arroba)\s*[\])]\s*|\s+arroba\s+/g, "@")
    // "fedha . live" → "fedha.live" (só com espaço dos dois lados do ponto e um domínio a seguir)
    .replace(new RegExp(`\\s+\\.\\s+(?=(${TLDS})\\b)`, "g"), ".");
}

const LEET: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", $: "s" };
function normalizeWord(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[013457@$]/g, (c) => LEET[c] ?? c)
    .replace(/(.)\1{2,}/g, "$1$1");
}

/**
 * Filtros antes do pagamento. Links, emails, telefones e QR/referências estão sempre ligados,
 * porque a mensagem aparece escrita no ecrã da live. Depois, palavras bloqueadas (lista base + lista do streamer).
 */
export function checkText(text: string, blockedWords: string[]): FilterHit | null {
  const t = deobfuscate(text);
  const link =
    t.match(new RegExp(`\\b((https?:\\/\\/)?([a-z0-9-]+\\.)+(${TLDS})(\\/\\S*)?)\\b`, "i")) ??
    t.match(/\bwww\.\S+/i) ??
    t.match(/\bhttps?:\/\/\S+/i);
  if (link) return hit("link", link[0]);
  const email = t.match(/[^\s@]+@[^\s@]+\.[a-z]{2,}/i);
  if (email) return hit("email", email[0]);
  const digits = t.replace(/[\s.\-()/]/g, "");
  const tel = digits.match(/(\+?244)?9\d{8}/) ?? digits.match(/\d{9,}/);
  if (tel) return hit("telefone", tel[0]);
  const qr = t.match(/\b(qr ?code|codigo qr|iban|entidade\s*\d{5}|referencia\s*\d{6,})\b/i);
  if (qr) return hit("qr", qr[0]);
  const norm = ` ${normalizeWord(text).replace(/[^a-z0-9]+/g, " ")} `;
  const compact = normalizeWord(text).replace(/[^a-z0-9]/g, "");
  for (const w of blockedWords) {
    const nw = normalizeWord(w).replace(/[^a-z0-9 ]+/g, "").trim();
    if (!nw) continue;
    if (norm.includes(` ${nw} `) || (nw.length >= 5 && compact.includes(nw.replace(/ /g, "")))) return hit("palavra", w);
  }
  return null;
}

function hit(kind: FilterHit["kind"], match: string): FilterHit {
  return { kind, match, message: FILTER_MESSAGES[kind] };
}

/** Nome do doador: também passa pelos filtros (aparece no ecrã). */
export function checkDonorName(name: string, blockedWords: string[]) {
  return checkText(name, blockedWords);
}
