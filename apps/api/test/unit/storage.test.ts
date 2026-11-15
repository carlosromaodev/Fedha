import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LocalStorage, MemoryStorage, isPublicKey } from "../../src/integrations/storage/storage";

describe("armazenamento", () => {
  it("URL pública usa sempre / (também no Windows)", () => {
    expect(new MemoryStorage("http://api/").publicUrl("audio/s1/a.wav")).toBe("http://api/media/audio/s1/a.wav");
    expect(new LocalStorage(".", "http://api").publicUrl("audio/s1/a.wav")).toBe("http://api/media/audio/s1/a.wav");
  });
  it("guarda e lê chaves com /", async () => {
    const s = new LocalStorage(await mkdtemp(join(tmpdir(), "fedha-")), "http://api");
    await s.put("audio/s1/a.wav", Buffer.from("ola"));
    expect((await s.get("audio/s1/a.wav"))?.data.toString()).toBe("ola");
  });
  it("recusa chaves que saem da pasta", async () => {
    const s = new LocalStorage(await mkdtemp(join(tmpdir(), "fedha-")), "http://api");
    await expect(s.put("../x.wav", Buffer.from(""))).rejects.toThrow();
    await expect(s.put("audio\\..\\..\\x.wav", Buffer.from(""))).rejects.toThrow();
    expect(isPublicKey("audio\\x.wav")).toBe(false);
  });
});
