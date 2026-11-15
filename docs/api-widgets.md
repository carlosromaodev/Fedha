# Widgets W1–W6: protocolo entre a API e o overlay

Implementado em `apps/api` (ramo `feat/backend-api`). Contratos Zod em `packages/contracts/src/api/widgets.ts` e `realtime.ts`.
Testes de ponta a ponta: `apps/api/test/e2e/widgets.test.ts` (`pnpm --filter @fedha/api test`).

## Arrancar em modo sandbox

```bash
cd apps/api
SEED_DEMO=true NODE_ENV=development pnpm dev     # http://localhost:3333, base de dados PGlite local
# streamer de demonstração: kiami@fedha.test / fedha2026
```

No frontend: `VITE_API_URL=http://localhost:3333`. Os widgets abrem no próprio site: `http://localhost:5173/o/<token>?w=1` (PUBLIC_OVERLAY_URL, por omissão igual a PUBLIC_WEB_URL).

## WebSocket `/v1/realtime/overlay?token=<token>&w=<1..6>`

O token vem de `GET /v1/widgets`. `w` escolhe o widget (1 alerta, 2 meta, 3 últimas mensagens, 4 top doadores, 5 QR, 6 combinado; RF-WID-08).
Token inválido ou revogado: a ligação fecha com o código 4001. Conta suspensa: 4003.

Servidor → overlay (`{ type, data }`):

| type | quando | data |
|---|---|---|
| `config` | ao ligar e sempre que o painel guarda | `theme, accent, size, showName, showValue, karaoke, reduceMotion, highlightFrom, superFrom, enterMs, exitMs, gapMs, volume (0–1), destination, qrCall, handle, enabled` |
| `state` | ao ligar, depois de cada pagamento e de cada mensagem tocada | `{ goal: {title,current,target} \| null, ranking: [{name,kz}], latest: [{name,kz,text}], queueSize }` |
| `alert` | um de cada vez, só para W1 ou W6 (ou Player no modo só áudio); o seguinte só depois do ack | `AlertEvent` + `tier`, `voice`, `voiceId`, `priority`, `effectUrl`, `isTest`, `isReplay` |
| `revoked` | o streamer gerou um link novo | `{}` (a seguir a ligação fecha com 4001) |
| `pong` | resposta a `ping` | `{ at }` |

Também são enviados `hello`, `settings`, `goal`, `ranking` e `latest` (formato antigo); o overlay pode ignorá-los.

Overlay → servidor:

| type | data | efeito |
|---|---|---|
| `hello` | `{ widget, scenario, userAgent }` | regista onde está aberto (aparece em `where` no painel) |
| `ack` | `{ id, playedAt? }` | a mensagem passa a "tocada"; liberta a seguinte depois do intervalo do streamer |
| `started` | `{ id }` | opcional |
| `error` | `{ id, reason: autoplay_blocked \| load_failed \| decode_failed }` | a mensagem volta à fila e o painel recebe aviso |
| `ping` | — | mantém a ligação (recomendado a cada 25 s) |

Sem ack em `durationMs + 45 s`, ou se o overlay desligar a meio, a mensagem volta à fila e toca de novo. Nunca se perde.
Uma mensagem toca numa só saída: se o W1 estiver aberto em dois sítios, só o primeiro recebe.

## REST (autenticado como streamer, `Authorization: Bearer <accessToken>`)

| Método e rota | Resposta |
|---|---|
| `GET /v1/widgets` | `[{ id: "w1".."w6", token, url, conn: "aberto" \| "fechado" \| "a_religar", where, openCount, warning, blocked, blockedReason, config }]` |
| `PUT /v1/widgets/:id` | corpo: qualquer campo de `config` exceto `destination` e `handle`; devolve o widget; os overlays abertos recebem `config` |
| `POST /v1/widgets/:id/token` | `{ id, token, url }`; o link antigo deixa de funcionar e o overlay recebe `revoked` |
| `POST /v1/widgets/test` | `{ sent, outputs }`; alerta de teste sem cobrança, só se houver saída aberta |
| `GET /v1/widgets/last-test` | `{ sentAt, pageOpen, played }` |
| `GET/PUT /v1/streamer/destination` | `{ destination }` (tiktok, instagram, youtube, twitch, kick, facebook); TikTok e Instagram desligam o W5 |

`a_religar` = nenhuma ligação aberta, mas uma fechou há menos de 30 s.

## Simular uma mensagem paga (fora de produção)

```bash
curl -X POST localhost:3333/v1/public/orders -H 'content-type: application/json' \
  -d '{"handle":"kiami","kind":"text","text":"Boa noite!","donorName":"Luana","phone":"923456789","acceptTerms":true}'
curl -X POST localhost:3333/v1/public/orders/<id>/payments -H 'content-type: application/json' -d '{"method":"reference"}'
curl -X POST localhost:3333/v1/dev/payments/<id do pedido ou do pagamento>/confirm
```

Com Multicaixa Express no sandbox: telefone acabado em 000 é recusado, em 999 fica pendente, qualquer outro confirma sozinho ao fim de `SANDBOX_AUTO_CONFIRM_MS` (5 s por omissão).
