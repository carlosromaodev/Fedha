# WhatsApp com a Evolution API

O Fedha Live envia WhatsApp pela [Evolution API](https://doc.evolution-api.com), a mesma abordagem do UOR Connect: um número de WhatsApp normal (ou Business) ligado por QR code, sem aprovação da Meta.

1. `cp .env.example .env` e define `POSTGRES_PASSWORD` e `AUTHENTICATION_API_KEY` (uma chave longa e aleatória).
2. `docker compose up -d` (precisa do Docker Desktop ligado). A API fica em http://localhost:8081.
3. No `apps/api/.env`:
   ```
   WHATSAPP_PROVIDER=evolution
   EVOLUTION_API_URL=http://localhost:8081
   EVOLUTION_API_KEY=<o mesmo AUTHENTICATION_API_KEY>
   EVOLUTION_INSTANCE=fedha
   ```
4. `pnpm --filter @fedha/api messaging whatsapp:pair` grava o QR code em `apps/api/.data/whatsapp-qr.png`. No telemóvel do número que vai enviar: WhatsApp › Dispositivos ligados › Ligar dispositivo.
5. `pnpm --filter @fedha/api messaging check` deve mostrar o estado `open`. Depois: `pnpm --filter @fedha/api messaging whatsapp 9XXXXXXXX`.

Cuidados: usa um número dedicado ao Fedha (o WhatsApp pode banir números que enviam muitas mensagens não pedidas); a Evolution só envia enquanto o telemóvel tiver a sessão ligada. Para volume grande ou modelos oficiais, troca para `WHATSAPP_PROVIDER=meta` (WhatsApp Cloud API).
