import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, normalize, resolve } from "node:path";

export interface StoredFile {
  data: Buffer;
  mime: string;
}

export interface Storage {
  put(key: string, data: Buffer, mime: string): Promise<void>;
  get(key: string): Promise<StoredFile | null>;
  delete(key: string): Promise<void>;
  /** URL pública. Só para prefixos públicos (audio/, effects/, images/, samples/). */
  publicUrl(key: string): string;
}

export const PUBLIC_PREFIXES = ["audio/", "effects/", "images/", "samples/", "proofs/"] as const;
export const isPublicKey = (key: string) => PUBLIC_PREFIXES.some((p) => key.startsWith(p)) && !key.includes("..");

const MIME_BY_EXT: Record<string, string> = {
  wav: "audio/wav", mp3: "audio/mpeg", ogg: "audio/ogg", opus: "audio/ogg", webm: "audio/webm", m4a: "audio/mp4", aac: "audio/aac",
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", pdf: "application/pdf", bin: "application/octet-stream",
};
export const extForMime = (mime: string) =>
  Object.entries(MIME_BY_EXT).find(([, m]) => m === mime.split(";")[0])?.[0] ?? "bin";

/** Disco local. Em produção trocar por armazenamento de objetos (S3, R2, MinIO) com a mesma interface. */
export class LocalStorage implements Storage {
  private root: string;
  constructor(dir: string, private publicBaseUrl: string) {
    this.root = resolve(dir);
  }
  private path(key: string) {
    const p = resolve(this.root, normalize(key));
    if (!p.startsWith(this.root)) throw new Error("chave inválida");
    return p;
  }
  async put(key: string, data: Buffer) {
    const p = this.path(key);
    await mkdir(dirname(p), { recursive: true });
    await writeFile(p, data);
  }
  async get(key: string): Promise<StoredFile | null> {
    try {
      const data = await readFile(this.path(key));
      const ext = key.split(".").pop()?.toLowerCase() ?? "bin";
      return { data, mime: MIME_BY_EXT[ext] ?? "application/octet-stream" };
    } catch {
      return null;
    }
  }
  async delete(key: string) {
    await rm(this.path(key), { force: true });
  }
  publicUrl(key: string) {
    return `${this.publicBaseUrl.replace(/\/$/, "")}/media/${key}`;
  }
}

export class MemoryStorage implements Storage {
  files = new Map<string, StoredFile>();
  constructor(private publicBaseUrl = "http://localhost:3333") {}
  async put(key: string, data: Buffer, mime: string) {
    this.files.set(key, { data, mime });
  }
  async get(key: string) {
    return this.files.get(key) ?? null;
  }
  async delete(key: string) {
    this.files.delete(key);
  }
  publicUrl(key: string) {
    return `${this.publicBaseUrl}/media/${join(key)}`;
  }
}
