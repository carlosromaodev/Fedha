/**
 * Tarefas periódicas dentro do processo. Suficiente para uma instância; com várias,
 * mover para uma fila (ex.: BullMQ ou pg-boss) com bloqueio por tarefa.
 */
export interface Job {
  name: string;
  everyMs: number;
  run: () => Promise<unknown>;
}

export class Scheduler {
  private timers: NodeJS.Timeout[] = [];
  private running = new Set<string>();
  constructor(private log: { error: (o: unknown, msg: string) => void }) {}

  start(jobs: Job[]) {
    for (const job of jobs) {
      const t = setInterval(() => void this.runOnce(job), job.everyMs);
      t.unref();
      this.timers.push(t);
    }
  }

  async runOnce(job: Job) {
    if (this.running.has(job.name)) return;
    this.running.add(job.name);
    try {
      await job.run();
    } catch (err) {
      this.log.error({ err, job: job.name }, "tarefa falhou");
    } finally {
      this.running.delete(job.name);
    }
  }

  stop() {
    for (const t of this.timers) clearInterval(t);
    this.timers = [];
  }
}
