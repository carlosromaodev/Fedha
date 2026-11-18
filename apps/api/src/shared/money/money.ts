/** Todos os valores são Kz inteiros, com IVA incluído. */
export const feeOf = (gross: number, percent: number) => Math.round((gross * percent) / 100);

/** "1.000 Kz" */
export function formatKz(kz: number): string {
  const s = Math.abs(Math.trunc(kz)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${kz < 0 ? "-" : ""}${s} Kz`;
}

/** DD/MM/AAAA HH:mm, fuso de Luanda (WAT, UTC+1, sem hora de verão). */
export function formatLuanda(d: Date, withTime = true): string {
  const w = new Date(d.getTime() + 60 * 60 * 1000);
  const p = (n: number) => n.toString().padStart(2, "0");
  const date = `${p(w.getUTCDate())}/${p(w.getUTCMonth() + 1)}/${w.getUTCFullYear()}`;
  return withTime ? `${date} ${p(w.getUTCHours())}:${p(w.getUTCMinutes())}` : date;
}

/** Início do dia de Luanda para uma data. */
export function startOfLuandaDay(d: Date): Date {
  const w = new Date(d.getTime() + 60 * 60 * 1000);
  return new Date(Date.UTC(w.getUTCFullYear(), w.getUTCMonth(), w.getUTCDate()) - 60 * 60 * 1000);
}
