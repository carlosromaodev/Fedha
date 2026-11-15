# Módulos (domínios)

Cada módulo segue a mesma forma:

```
<modulo>/
  spec/          spec.md, contracts.md, tasks.md (escrever primeiro)
  contracts/     Schemas Zod de pedidos, respostas e eventos. Fonte única de tipos (`z.infer`).
  http/          Rotas Fastify (`*.routes.ts`) e handlers, validados com os schemas de `contracts/`.
  domain/        Entidades, regras de negócio e máquinas de estado. Sem Fastify nem base de dados.
  application/   Casos de uso (um ficheiro por caso de uso), orquestram domínio e repositórios.
  infra/         Repositórios, acesso à base de dados e adaptadores externos deste módulo.
  tests/         Testes derivados dos critérios de aceitação da spec.
```

Um módulo só fala com outro através dos casos de uso (`application/`) ou de eventos, nunca pelo repositório do outro.

| Módulo | Domínio | Telas / fluxos |
|---|---|---|
| `auth` | Contas e autenticação | A1–A5, S14 |
| `streamers` | Perfil e página pública do streamer | P2, A6, S8 |
| `kyc` | Verificação KYC | A7, B3 |
| `assistants` | Assistentes | S10, 5.4 |
| `pricing` | Preços e regras | S5, P2 |
| `filters` | Filtros antes do pagamento | S9, B8 |
| `orders` | Pedidos de mensagem | P3, P4, P5, F1, F2 |
| `payments` | Checkout e pagamentos | P3, F1, F3, F4 |
| `queue` | Fila ao vivo | S2 |
| `playback` | Reprodução | S3, S6, W1–W5 |
| `goals` | Metas | S7, W2 |
| `wallet` | Carteira e ledger | S1, S12 |
| `withdrawals` | Levantamentos | S11, B6, F6 |
| `notifications` | Notificações | S13 |
| `support` | Ajuda e suporte | S15, B10 |
| `analytics` | Relatórios e análise | S1, B1 |
| `reconciliation` | Reconciliação | B5, F7 |
| `fraud` | Antifraude e compliance | B7 |
| `admin` | Back-office | B2, B4, B9, B11 |
