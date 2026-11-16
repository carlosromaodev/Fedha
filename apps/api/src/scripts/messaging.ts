/**
 * Diagnóstico e envio de teste dos fornecedores de mensagens, com a configuração do apps/api/.env.
 *
 *   pnpm --filter @fedha/api messaging check                 fornecedores ativos, saldo e remetentes Ombala, estado do WhatsApp
 *   pnpm --filter @fedha/api messaging sms 9XXXXXXXX [texto]  envia um SMS real
 *   pnpm --filter @fedha/api messaging whatsapp 9XXXXXXXX [texto]
 *   pnpm --filter @fedha/api messaging whatsapp:pair          cria a instância na Evolution e grava o QR code em .data/whatsapp-qr.png
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { loadEnv } from "../shared/config/env";
import { DefaultMessenger } from "../integrations/messaging/senders";
import { OmbalaSms } from "../integrations/sms/sms";
import { EvolutionWhatsApp } from "../integrations/whatsapp/whatsapp";
import { MessagingError } from "../integrations/messaging/http";

const log = { info: (o: unknown, m: string) => console.log(m, JSON.stringify(o)), warn: (o: unknown, m: string) => console.warn(m, JSON.stringify(o)) };

if (existsSync(".env")) process.loadEnvFile(".env");

async function main() {
  const [cmd = "check", to, ...rest] = process.argv.slice(2).filter((a) => a !== "--");
  const env = loadEnv();
  const messenger = new DefaultMessenger(env, log);
  const text = rest.join(" ") || "Fedha Live: mensagem de teste. Se a recebeste, os envios estão a funcionar.";

  if (cmd === "check") {
    console.log(JSON.stringify(messenger.status(), null, 2));
    if (messenger.smsProvider instanceof OmbalaSms && !messenger.smsProvider.missing().length) {
      console.log("Ombala, saldo:", JSON.stringify(await messenger.smsProvider.credits()));
      console.log("Ombala, remetentes aprovados:", JSON.stringify(await messenger.smsProvider.approvedSenders()));
    }
    if (messenger.whatsappProvider instanceof EvolutionWhatsApp && !messenger.whatsappProvider.missing().length) {
      console.log("Evolution, estado:", JSON.stringify(await messenger.whatsappProvider.connectionState()));
    }
    return;
  }
  if (cmd === "sms" || cmd === "whatsapp") {
    if (!to) throw new Error(`Uso: messaging ${cmd} 9XXXXXXXX [texto]`);
    await messenger[cmd](to, text);
    console.log(`${cmd} entregue ao fornecedor ${cmd === "sms" ? messenger.smsProvider.name : messenger.whatsappProvider.name}.`);
    return;
  }
  if (cmd === "whatsapp:pair") {
    const wa = messenger.whatsappProvider;
    if (!(wa instanceof EvolutionWhatsApp)) throw new Error("WHATSAPP_PROVIDER tem de ser evolution");
    let body: unknown;
    try {
      body = await wa.createInstance();
    } catch (err) {
      // 403/409: a instância já existe; pedimos só um QR novo.
      if (!(err instanceof MessagingError) || ![400, 403, 409].includes(err.status)) throw err;
      body = await wa.connect();
    }
    const b = body as { qrcode?: { base64?: string; pairingCode?: string }; base64?: string; pairingCode?: string };
    const base64 = b.qrcode?.base64 ?? b.base64;
    if (!base64) {
      console.log("Sem QR code na resposta (o número pode já estar ligado):", JSON.stringify(await wa.connectionState()));
      return;
    }
    const file = resolve(".data/whatsapp-qr.png");
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, Buffer.from(base64.replace(/^data:image\/\w+;base64,/, ""), "base64"));
    console.log(`QR code gravado em ${file}. No telemóvel: WhatsApp > Dispositivos ligados > Ligar dispositivo.`);
    const pairing = b.qrcode?.pairingCode ?? b.pairingCode;
    if (pairing) console.log(`Ou usa o código de emparelhamento: ${pairing}`);
    return;
  }
  throw new Error(`Comando desconhecido: ${cmd}`);
}

main().catch((err) => {
  console.error(err instanceof MessagingError ? `${err.message}${err.detail ? `\n${err.detail}` : ""}` : err);
  process.exit(1);
});
