export interface TtsVoice {
  provider: string;
  providerVoiceId: string;
}

export interface TtsResult {
  data: Buffer;
  mime: string;
  ext: string;
  durationMs: number;
}

export interface TtsEngine {
  name: string;
  synthesize(text: string, voice: TtsVoice): Promise<TtsResult>;
}

/**
 * TTS de desenvolvimento: gera um WAV com tons suaves (um por palavra) e duração proporcional ao texto.
 * Serve para testar o overlay e o Player sem fornecedor. Não lê o texto.
 */
export class MockTts implements TtsEngine {
  name = "mock";
  async synthesize(text: string): Promise<TtsResult> {
    const rate = 16000;
    const words = text.trim().split(/\s+/).filter(Boolean);
    const durationMs = Math.min(20000, Math.max(1500, text.length * 65));
    const samples = Math.floor((rate * durationMs) / 1000);
    const pcm = Buffer.alloc(samples * 2);
    const perWord = Math.max(1, Math.floor(samples / Math.max(1, words.length)));
    for (let i = 0; i < samples; i++) {
      const w = Math.floor(i / perWord);
      const pos = (i % perWord) / perWord;
      const freq = 220 + ((w * 37) % 180);
      const env = pos < 0.7 ? Math.sin((Math.PI * pos) / 0.7) : 0;
      const v = Math.sin((2 * Math.PI * freq * i) / rate) * env * 0.25;
      pcm.writeInt16LE(Math.round(v * 32767), i * 2);
    }
    return { data: wav(pcm, rate), mime: "audio/wav", ext: "wav", durationMs };
  }
}

export function wav(pcm: Buffer, rate: number): Buffer {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVE", 8);
  h.write("fmt ", 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

/** Azure AI Speech (tem vozes pt-PT e pt-BR). Precisa de AZURE_TTS_KEY e AZURE_TTS_REGION. */
export class AzureTts implements TtsEngine {
  name = "azure";
  constructor(private key: string, private region: string) {}
  async synthesize(text: string, voice: TtsVoice): Promise<TtsResult> {
    const voiceName = voice.providerVoiceId || "pt-PT-RaquelNeural";
    const lang = voiceName.slice(0, 5);
    const ssml = `<speak version="1.0" xml:lang="${lang}"><voice name="${voiceName}">${escapeXml(text)}</voice></speak>`;
    const res = await fetch(`https://${this.region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": this.key,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
        "User-Agent": "fedha-api",
      },
      body: ssml,
    });
    if (!res.ok) throw new Error(`Azure TTS ${res.status}: ${await res.text()}`);
    const data = Buffer.from(await res.arrayBuffer());
    return { data, mime: "audio/mpeg", ext: "mp3", durationMs: Math.round((data.length * 8) / 48) };
  }
}

const escapeXml = (s: string) =>
  s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);
