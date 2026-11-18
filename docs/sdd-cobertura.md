# Cobertura do SDD v2.0 no backend (apps/api)

Fonte da verdade: [Fedha Live: SDD v2.0](https://claude.ai/artifact/8W56chffoqrQm3myagoXLN). Este ficheiro diz, para cada regra do MVP, onde está no código e que teste a prova.
Prioridades da primeira fase: preços, filtros, fila, webhook e ledger.

Legenda: ✅ implementado e testado · 🟡 implementado sem teste automático · ⏳ falta.

## Preços (RN-PRE)

| Regra | Estado | Código | Teste |
|---|---|---|---|
| RN-PRE-01 faixas 500/1.000/2.000, máx. 200 (até 300) | ✅ | `pricing/domain/pricing.ts`, `admin/application/settings.ts` | `test/unit/domain.test.ts`, `test/e2e/rules.test.ts` |
| RN-PRE-02 contagem por carácter visível, emoji = 1 | ✅ | `countChars` | `domain.test.ts` |
| RN-PRE-03 faixas sem sobreposição e a subir | ✅ | `contracts/api/pricing.ts` (superRefine) | `domain.test.ts` |
| RN-PRE-04 voz premium +1.000 | ✅ | `priceMessage` | `domain.test.ts` |
| RN-PRE-05 áudio por escalão, sempre mais caro | ✅ | `priceMessage`, superRefine | `domain.test.ts` |
| RN-PRE-06 efeito +500, prioridade +1.000 | ✅ | `priceMessage` | `domain.test.ts`, `rules.test.ts` |
| RN-PRE-07 mínimo da plataforma 100 Kz | ✅ | `PLATFORM_MIN_AMOUNT` | `domain.test.ts` |
| RN-PRE-08 preço congelado no pedido | 🟡 | `orders.service.ts#createOrder` (lines, amount) | — |

## Filtros (RN-MSG)

| Regra | Estado | Código | Teste |
|---|---|---|---|
| RN-MSG-01 lista base + lista do streamer antes do pagamento | ✅ | `filters/domain/filters.ts`, `createOrder` | `domain.test.ts` |
| RN-MSG-02 links, emails, telefones e QR sempre bloqueados (com truques) | ✅ | `checkText` | `domain.test.ts`, `rules.test.ts` |
| RN-MSG-03 aceitar regras antes de pagar | ✅ | `CreateOrderBody.acceptTerms` | contrato Zod |
| RN-MSG-04 áudio não filtrado no MVP | ✅ | — | — |
| RN-MSG-05 remetentes bloqueados não pagam | 🟡 | `isDonorBlocked` | — |
| RN-MSG-06 nome passa pelos filtros; Anónimo | 🟡 | `createOrder` | — |

## Pagamentos e webhook (RN-PAG)

| Regra | Estado | Código | Teste |
|---|---|---|---|
| RN-PAG-01 só o webhook assinado confirma | ✅ | `payments.service.ts#handleWebhook`, HMAC | `test/e2e/sdd-flows.test.ts` |
| RN-PAG-02 MCX expira em 5 min | ✅ | `mcxTtlMinutes` | `domain.test.ts` (predefinição) |
| RN-PAG-03 referência 60 min; pagamento tardio reembolsado ou reativado | 🟡 | `confirmPayment` (lateAccepted) | — |
| RN-PAG-04 duplicado → reembolso automático | ✅ | `handleWebhook` | `sdd-flows.test.ts` |

## Fila e emissão (RN-FIL, RN-WID)

| Regra | Estado | Código | Teste |
|---|---|---|---|
| RN-FIL-01 emissão automática, sem moderação | ✅ | `playback/application/engine.ts` | `widgets.test.ts` |
| RN-FIL-02 prioridade primeiro, depois ordem de pagamento (ou valor) | ✅ | `queue/domain/ordering.ts` | `domain.test.ts` |
| RN-FIL-03 uma só saída principal (W1/W6 ou Player) | ✅ | `engine.targetKinds` | `widgets.test.ts` |
| RN-FIL-04 tocada só com ack | ✅ | `engine.ack` | `widgets.test.ts`, `sdd-flows.test.ts` |
| RN-FIL-05 sem saída, a fila espera; ao voltar retoma sem perder | ✅ | `engine.release`, heartbeat 20 s / 60 s | `widgets.test.ts` |
| RN-FIL-06 intervalo 0–5 s, predefinição 1,5 s | ✅ | `streamers.intervalMs` | `sdd-flows.test.ts` |
| RN-FIL-07 offline: fila com aviso ou bloqueio | 🟡 | `acceptState` | — |
| RN-FIL-08 repetir sem cobrar | 🟡 | `playback.service#replay` | — |
| RN-WID-02 token secreto, regenerar invalida já | ✅ | `regenerateWidget` | `widgets.test.ts` |
| RN-WID-04 W5 desligado no TikTok/Instagram | ✅ | `qrBlocked` | `widgets.test.ts` |
| RN-WID-05 áudio que não carrega → falha técnica | ✅ | `engine.onError` | `sdd-flows.test.ts` |
| RN-WID-06 W1 aberto em dois sítios: toca o último | ✅ | `engine.enabledTargets` | `sdd-flows.test.ts` |
| RF-WID-08 W3 últimas mensagens, W4 top doadores | ✅ | `contracts/api/widgets.ts` (WIDGET_BY_ID) | `widgets.test.ts` |
| RN-WID-01 links dos widgets no próprio site | ✅ | `widgetUrl` (PUBLIC_OVERLAY_URL = PUBLIC_WEB_URL) | `widgets.test.ts` |

## Carteira, ledger e levantamentos (RN-CAR, RN-LEV, RN-REE)

| Regra | Estado | Código | Teste |
|---|---|---|---|
| RN-CAR-01 10% para a plataforma | ✅ | `feeOf`, `creditOrder` | `rules.test.ts`, `sdd-flows.test.ts` |
| RN-CAR-02 líquido entra como pendente | ✅ | `creditOrder` | `sdd-flows.test.ts` |
| RN-CAR-03 disponível só depois de tocada e 48 h (cartão 7 d) | ✅ | `releaseDue` | `sdd-flows.test.ts` |
| RN-CAR-04 dupla entrada imutável, saldos do ledger | ✅ | `wallet/domain/ledger.ts` | `sdd-flows.test.ts` |
| RN-REE-01/04 falha técnica reembolsa, sem receita | ✅ | `failOrder`, `reverseOrder` | `sdd-flows.test.ts` |
| RN-REE-03 reclamar até 90 dias | 🟡 | `claimRefund` | — |
| RN-LEV-01..06 KYC + 2FA, mínimo 5.000, taxa 300, IBAN bloqueia 48 h, revisão >500 mil ou conta <30 dias, devolução com taxa | 🟡 | `withdrawals.service.ts`, `kyc.service.ts` | — (próxima fase de testes) |

## Conta e antifraude

| Regra | Estado | Código | Teste |
|---|---|---|---|
| RN-CON-03 nome muda 1 vez a cada 30 dias | ✅ | `PUT /v1/streamer/handle` | `sdd-flows.test.ts` |
| RN-CON-04 limite sem KYC 50.000 Kz | 🟡 | `acceptState` (kyc_limit) | — |
| RN-FRA-01 20 mensagens / 100.000 Kz por dia por doador | ✅ | `createOrder` | `sdd-flows.test.ts` |
| RN-FRA-02 pagar a si próprio: bloqueado e sinalizado | ✅ | `assertNotSelfPayment` | `sdd-flows.test.ts` |

## Requisitos não funcionais tratados nesta fase

- RNF-02 heartbeat de 20 s (ping WebSocket) e saída desligada após 60 s sem resposta.
- RNF-10 valores inteiros, idempotência por chave, ledger imutável.
- RNF-19 CI em `.github/workflows/api.yml` (typecheck + testes em cada PR).

## Diferenças conhecidas em relação ao SDD

- RNF-08 pede Argon2id. Hoje é scrypt (nativo do Node 22). Trocar quando houver dependência aprovada (`@node-rs/argon2`).
- RNF-14 pede áudio em Opus ou AAC. O TTS de teste gera WAV; o fornecedor real (Q3) define o formato.
- RNF-19 pede cobertura acima de 80%: ainda não é medida no CI.
