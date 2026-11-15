// Dados de exemplo enquanto a API não existe. Tudo o que vem daqui será substituído por chamadas a @fedha/contracts.

export type Platform = "tiktok" | "youtube" | "twitch" | "kick" | "facebook" | "instagram";
export type Device = "pc" | "telemovel";
export type OutputMode = "overlay" | "audio_only";

export const PLATFORM_LABEL: Record<Platform, string> = {
  tiktok: "TikTok", youtube: "YouTube", twitch: "Twitch", kick: "Kick", facebook: "Facebook", instagram: "Instagram",
};

export interface Streamer {
  handle: string;
  name: string;
  platform: Platform;
  device: Device;
  outputMode: OutputMode;
  live: boolean;
  viewers: string;
  verified: boolean;
  bio: string;
}

export const streamer: Streamer = {
  handle: "kiami",
  name: "Kiami Gamer",
  platform: "tiktok",
  device: "pc",
  outputMode: "overlay",
  live: true,
  viewers: "1,2 mil a ver",
  verified: true,
  bio: "FIFA, Free Fire e conversa da banda. Lives de terça a sábado às 20h.",
};

export interface PriceTier { min: number; max: number; kz: number }
export const pricing = {
  text: [
    { min: 1, max: 50, kz: 500 },
    { min: 51, max: 100, kz: 1000 },
    { min: 101, max: 200, kz: 2000 },
  ] as PriceTier[],
  audio: [
    { seconds: 10, kz: 5000 },
    { seconds: 20, kz: 8000 },
    { seconds: 30, kz: 10000 },
  ],
  extras: { premiumVoice: 1000, effect: 500, priority: 1000 },
  platformFeePct: 10,
};

export const voices = [
  { id: "nzinga", name: "Nzinga", premium: false, desc: "Voz padrão, feminina" },
  { id: "kandimba", name: "Kandimba", premium: false, desc: "Masculina, calma" },
  { id: "ngola", name: "Ngola", premium: true, desc: "Premium, locutor" },
];
export const effects = [
  { id: "moeda", name: "Moeda a cair" },
  { id: "aplausos", name: "Aplausos" },
  { id: "buzina", name: "Buzina" },
];

export type QueueStatus = "a_tocar" | "na_fila" | "tocada";
export interface QueueMsg {
  id: string;
  donor: string;
  phone: string;
  kind: "text" | "audio";
  text: string;
  seconds?: number;
  kz: number;
  tags: string[];
  at: string;
  status: QueueStatus;
}

export const queue: QueueMsg[] = [
  { id: "FL-8F3A-11B0", donor: "Luana", phone: "936112512", kind: "text", text: "Kiami, manda salve pra malta do Lobito!", kz: 500, tags: [], at: "21:04", status: "a_tocar" },
  { id: "FL-8F3A-22C1", donor: "DJ Nelo", phone: "924881207", kind: "text", text: "Ya mano, essa jogada foi mesmo à Kuduro 😂", kz: 2500, tags: ["Prioridade", "Voz premium"], at: "21:05", status: "na_fila" },
  { id: "FL-8F3A-31D9", donor: "Edvaldo", phone: "923481207", kind: "text", text: "Bora Kiami! Esse clutch foi brabo demais, abraço do Cazenga 🔥", kz: 2500, tags: ["Prioridade", "Efeito · moeda"], at: "21:05", status: "na_fila" },
  { id: "FL-8F3A-40E2", donor: "Mauro A.", phone: "912000209", kind: "audio", text: "Mensagem de voz", seconds: 18, kz: 8000, tags: ["Áudio 20 s"], at: "21:06", status: "na_fila" },
  { id: "FL-8F3A-5A11", donor: "Joana M.", phone: "927700774", kind: "text", text: "Aquele clutch no fim foi brabo, mereces mais subs! 💪", kz: 1500, tags: ["Efeito · aplausos"], at: "21:06", status: "na_fila" },
  { id: "FL-7F10-0C21", donor: "Paulo K.", phone: "918200650", kind: "audio", text: "Mensagem de voz", seconds: 9, kz: 5000, tags: ["Áudio 10 s"], at: "21:03", status: "tocada" },
  { id: "FL-7F0E-4D21", donor: "Anónimo", phone: "943330033", kind: "text", text: "Quando é que vais jogar com a malta de Benguela?", kz: 500, tags: [], at: "21:01", status: "tocada" },
  { id: "FL-7EF2-0A9C", donor: "Luana", phone: "936112512", kind: "text", text: "Kiami, hoje estás impossível 😂", kz: 500, tags: [], at: "20:58", status: "tocada" },
];

export const last14 = [
  [38, 31, 35], [12, 9, 11], [41, 35, 38], [22, 18, 20], [2, 2, 2], [52, 47, 50], [33, 26, 29], [17, 14, 16],
  [58, 46, 51], [25, 20, 24], [43, 34, 39], [72, 58, 64], [49, 37, 42], [61, 49, 56],
];

export const goal = { title: "Cadeira gamer nova", current: 81600, target: 120000, endsAt: "30/11/2026" };
export const pastGoals = [
  { title: "Microfone novo", current: 65000, target: 60000, endedAt: "02/11/2026", done: true },
  { title: "Internet de 6 meses", current: 41000, target: 90000, endedAt: "15/10/2026", done: false },
];

export interface LedgerRow { at: string; origin: string; gross: number; fee: number; net: number; status: "pendente" | "disponivel" | "reembolsado"; until?: string }
export const ledger: LedgerRow[] = [
  { at: "14/11/2026 21:04", origin: "Luana · texto", gross: 500, fee: 50, net: 450, status: "pendente", until: "16/11" },
  { at: "14/11/2026 20:51", origin: "DJ Nelo · texto + prioridade", gross: 2500, fee: 250, net: 2250, status: "pendente", until: "16/11" },
  { at: "14/11/2026 20:40", origin: "Mauro A. · áudio 30 s", gross: 10000, fee: 1000, net: 9000, status: "pendente", until: "16/11" },
  { at: "14/11/2026 20:12", origin: "Anónimo · áudio 10 s", gross: 5000, fee: 0, net: 0, status: "reembolsado" },
  { at: "12/11/2026 22:30", origin: "Joana M. · texto", gross: 1500, fee: 150, net: 1350, status: "disponivel" },
  { at: "12/11/2026 21:58", origin: "Edvaldo · áudio 20 s", gross: 8000, fee: 800, net: 7200, status: "disponivel" },
];
export const wallet = { available: 184320, pending: 46800, releaseAt: "15/11/2026 · 22:10", monthNet: 412650, monthGross: 458500, monthFee: 45850, withdrawFee: 300 };

export const blockedWords = ["fedhapay", "burla", "xinguilamento", "aposta", "pix"];
export const blockedSenders = ["918200650", "943330033"];

export const assistants = [
  { name: "Nelo Bento", contact: "+244 925 ••• 118", status: "ativo", since: "02/11/2026" },
  { name: "Ana Pedro", contact: "ana.p@…", status: "convite enviado", since: "14/11/2026" },
];

// Back-office
export type TxStatus = "na_fila" | "emitida" | "falha" | "aguarda" | "reembolsada" | "expirada";
export const transactions: Array<{ id: string; at: string; donor: string; streamer: string; method: "Multicaixa Express" | "Referência"; kz: number; status: TxStatus }> = [
  { id: "FL-8F3A-22C1", at: "14/11 21:06", donor: "924881207", streamer: "Kiami Gamer", method: "Multicaixa Express", kz: 2500, status: "na_fila" },
  { id: "FL-8F39-11B0", at: "14/11 21:04", donor: "936112512", streamer: "Kiami Gamer", method: "Multicaixa Express", kz: 500, status: "emitida" },
  { id: "FL-7C10-9AE4", at: "14/11 21:01", donor: "924000118", streamer: "DJ Nelo", method: "Referência", kz: 10000, status: "falha" },
  { id: "FL-7C0E-4D21", at: "14/11 20:58", donor: "943330033", streamer: "Luana Plays", method: "Referência", kz: 1500, status: "aguarda" },
  { id: "FL-7BF2-0A9C", at: "14/11 20:55", donor: "927700774", streamer: "Kiami Gamer", method: "Multicaixa Express", kz: 8000, status: "emitida" },
  { id: "FL-7BE8-3F02", at: "14/11 20:49", donor: "918200650", streamer: "Mano Zé TV", method: "Multicaixa Express", kz: 5000, status: "reembolsada" },
  { id: "FL-7BD1-77A8", at: "14/11 20:41", donor: "932000209", streamer: "DJ Nelo", method: "Multicaixa Express", kz: 1000, status: "emitida" },
  { id: "FL-7BC4-1E5D", at: "14/11 20:37", donor: "925550881", streamer: "Luana Plays", method: "Multicaixa Express", kz: 3500, status: "expirada" },
];
export const withdrawalsQueue = [
  { id: "LV-2201", streamer: "Kiami Gamer", dest: "IBAN · BAI ••• 4471", kz: 150000, at: "14/11 21:10", risk: "baixo" },
  { id: "LV-2200", streamer: "Luana Plays", dest: "Multicaixa Express ••• 512", kz: 42000, at: "14/11 19:02", risk: "baixo" },
  { id: "LV-2199", streamer: "Mano Zé TV", dest: "IBAN · BFA ••• 0932", kz: 310000, at: "14/11 16:45", risk: "médio" },
  { id: "LV-2197", streamer: "DJ Nelo", dest: "IBAN · BIC ••• 1180", kz: 88500, at: "13/11 23:20", risk: "baixo" },
];
export const kycQueue = [
  { id: "KYC-118", name: "Mano Zé TV", legal: "José Manuel Zua", sent: "14/11 18:20", docs: 4, status: "pendente" },
  { id: "KYC-117", name: "Rita Kuduro", legal: "Rita Domingos", sent: "14/11 12:02", docs: 4, status: "pendente" },
  { id: "KYC-116", name: "Benguela Gaming", legal: "Paulo Sapalo", sent: "13/11 21:40", docs: 3, status: "correção pedida" },
];
export const streamersList = [
  { name: "Kiami Gamer", handle: "kiami", platform: "TikTok", kyc: "aprovado", month: 458500, status: "ativo" },
  { name: "DJ Nelo", handle: "djnelo", platform: "YouTube", kyc: "aprovado", month: 212000, status: "ativo" },
  { name: "Luana Plays", handle: "luanaplays", platform: "Twitch", kyc: "aprovado", month: 98400, status: "ativo" },
  { name: "Mano Zé TV", handle: "manoze", platform: "TikTok", kyc: "pendente", month: 61500, status: "ativo" },
  { name: "Rita Kuduro", handle: "ritakuduro", platform: "Instagram", kyc: "pendente", month: 0, status: "ativo" },
  { name: "Benguela Gaming", handle: "bgaming", platform: "Kick", kyc: "correção pedida", month: 12000, status: "suspenso" },
];
