# ADR 0002 — Overlay único como produto principal

Contexto: o Fedha não transmite vídeo; tem de funcionar por cima das apps de live existentes.

Decisão:
1. O produto principal é um link de overlay (W1) com texto e áudio, servido por `apps/overlay`, separado do painel.
2. O Player (S3) passa a plano B "só áudio" e nunca toca ao mesmo tempo que o overlay.
3. TTS gerado no servidor.
4. `AlertEvent` é um só schema Zod em `@fedha/contracts`.
5. W5 (QR) desligado para TikTok e Instagram; bloqueio de links, telefones e QR sempre ligado.

Ref.: https://claude.ai/artifact/916qoRFhGb3XDAugvVSwaa
