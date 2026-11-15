/** Valores em Kwanza são inteiros. 2500 → "2.500 Kz" */
export function kz(value: number, withUnit = true): string {
  const n = Math.round(value);
  const s = (n < 0 ? "-" : "") + String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return withUnit ? `${s} Kz` : s;
}

/** Telefone angolano: 923481207 → "+244 923 481 207" */
export function phone(digits: string): string {
  const d = digits.replace(/\D/g, "").replace(/^244/, "").slice(0, 9);
  const parts = [d.slice(0, 3), d.slice(3, 6), d.slice(6, 9)].filter(Boolean);
  return parts.length ? `+244 ${parts.join(" ")}` : "";
}

export function maskPhone(digits: string): string {
  const d = digits.replace(/\D/g, "").replace(/^244/, "");
  return `+244 ${d.slice(0, 2)}• ••• ${d.slice(6, 9)}`;
}

export function mmss(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");
}

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
