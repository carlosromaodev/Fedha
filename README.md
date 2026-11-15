# Fedha Live

O sistema de mensagens pagas em Kwanza para a tua live, seja qual for a app. O Fedha não transmite vídeo: complementa o OBS, o Streamlabs, o TikTok LIVE Studio, o PRISM ou a app nativa da plataforma.

O produto principal é **um único link de overlay** que mostra a mensagem no ecrã da live e toca o áudio (voz sintética gerada no servidor ou áudio gravado). Entra como Browser Source no OBS e no Streamlabs, como Link Source no TikTok LIVE Studio e como widget Web no PRISM (telemóvel). Quem transmite pela app nativa no telemóvel fica com o Player só-áudio, o plano B.

Pagamentos por Multicaixa Express e Referência Multicaixa, levantamentos, KYC e back-office. O streamer não aprova nem rejeita mensagens; o bloqueio de links, números de telefone e QR está sempre ligado.

Estratégia: https://claude.ai/artifact/916qoRFhGb3XDAugvVSwaa

> Estado: só estrutura. Nenhuma funcionalidade implementada.

## Estrutura

```
apps/
  api/          Fastify + Zod, organizado por domínio
    src/modules/<dominio>/
      spec/       spec.md · contracts.md · tasks.md  (SDD: escrever primeiro)
      contracts/  http/  domain/  application/  infra/  tests/
    src/shared/       config, http, errors, database, events, realtime, jobs, money, audit
    src/integrations/ payments (Multicaixa Express, Referência), tts, sms, email, whatsapp, storage
  overlay/      página leve do overlay (W1–W5), corre horas dentro do OBS, LIVE Studio e PRISM
  web/          React + Vite
    src/pages/  public (P1–P5) · auth (A1–A7) · streamer (S1–S15) · assistant · admin (B1–B11)
    src/features/  src/layouts/  src/shared/  src/app/
packages/
  contracts/    schemas Zod partilhados (inclui o evento de alerta usado pela API, overlay e Player)
docs/           produto, ADRs, fluxos, saídas (overlay e Player)
```

## Fluxo SDD
1. Escrever e aprovar `spec/spec.md` do módulo.
2. Fechar `spec/contracts.md` e passar a schemas Zod.
3. Testes a partir dos critérios de aceitação.
4. Implementação.
