export interface Queueable {
  id: string;
  priority: boolean;
  amount: number;
  paidAt: Date | null;
}

/**
 * Ordem da fila: primeiro as mensagens com prioridade paga, depois as restantes.
 * Dentro de cada grupo, por ordem de pagamento ou (opção do streamer) por valor, desempate pela ordem de pagamento.
 */
export function sortQueue<T extends Queueable>(items: T[], order: "arrival" | "amount"): T[] {
  const t = (d: Date | null) => d?.getTime() ?? Number.MAX_SAFE_INTEGER;
  return [...items].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority ? -1 : 1;
    if (order === "amount" && a.amount !== b.amount) return b.amount - a.amount;
    return t(a.paidAt) - t(b.paidAt) || a.id.localeCompare(b.id);
  });
}
