/**
 * Números de telefone para os fornecedores de mensagens.
 * Em Angola guardamos 9XXXXXXXX (9 dígitos); cada fornecedor quer um formato:
 * - Ombala (SMS): 9XXXXXXXX, sem indicativo.
 * - Evolution API e Meta (WhatsApp): 2449XXXXXXXX, só dígitos.
 * Números estrangeiros (com +) passam como estão, só com dígitos.
 */
export interface Phone {
  /** Só dígitos, com indicativo (2449XXXXXXXX). */
  intl: string;
  /** +2449XXXXXXXX */
  e164: string;
  /** 9XXXXXXXX para Angola; para outros países, igual a intl. */
  national: string;
  angolan: boolean;
}

export class InvalidPhoneError extends Error {
  constructor(input: string) {
    super(`Número de telefone inválido: ${mask(input)}`);
  }
}

export function parsePhone(input: string): Phone {
  const raw = input.trim();
  let digits = raw.replace(/[^\d]/g, "");
  if (raw.startsWith("00")) digits = digits.slice(2);
  if (/^9\d{8}$/.test(digits)) digits = `244${digits}`;
  if (/^2449\d{8}$/.test(digits)) return { intl: digits, e164: `+${digits}`, national: digits.slice(3), angolan: true };
  // Outro país: só aceitamos com indicativo explícito (+ ou 00) e 8 a 15 dígitos (E.164).
  if ((raw.startsWith("+") || raw.startsWith("00")) && /^[1-9]\d{7,14}$/.test(digits) && !digits.startsWith("244")) {
    return { intl: digits, e164: `+${digits}`, national: digits, angolan: false };
  }
  throw new InvalidPhoneError(input);
}

/** Para logs: 92•••••78. Nunca escrevemos o número inteiro. */
export function mask(input: string) {
  const d = input.replace(/[^\d]/g, "");
  if (d.length < 5) return "•••";
  return `${d.slice(0, 2)}${"•".repeat(d.length - 4)}${d.slice(-2)}`;
}
