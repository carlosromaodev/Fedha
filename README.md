# Fedha Live

Plataforma angolana de mensagens pagas em Kwanza que tocam automaticamente em lives: texto lido por voz sintética (preço por caracteres) ou áudio gravado. Widgets OBS, página Player, Multicaixa Express e Referência Multicaixa, levantamentos, KYC e back-office. O streamer não aprova nem rejeita mensagens.

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
  web/          React + Vite
    src/pages/  public (P1–P5) · auth (A1–A7) · streamer (S1–S15) · assistant · admin (B1–B11) · widgets (W1–W5)
    src/features/  src/layouts/  src/shared/  src/app/
packages/
  contracts/    schemas Zod partilhados
docs/           produto, ADRs, fluxos
```

## Fluxo SDD
1. Escrever e aprovar `spec/spec.md` do módulo.
2. Fechar `spec/contracts.md` e passar a schemas Zod.
3. Testes a partir dos critérios de aceitação.
4. Implementação.
