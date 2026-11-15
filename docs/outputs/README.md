# Saídas: overlay e Player

O servidor faz o trabalho pesado (filtros, pagamento, TTS, fila) e entrega a cada saída um `AlertEvent` pronto a mostrar.

| Saída | Quando | O que faz |
|---|---|---|
| Overlay (W1) | Saída principal. PC (OBS, Streamlabs, TikTok LIVE Studio) e telemóvel com PRISM | Texto no ecrã + áudio, um só link |
| Player (S3) | Plano B "só áudio" para quem transmite pela app nativa | Só áudio, noutro aparelho ou coluna |

Regra: o streamer escolhe o modo (`OutputMode`). A mesma mensagem nunca toca nas duas saídas.

## Contrato
- Evento: `packages/contracts/src/alert-event.ts` (`AlertEvent`).
- Confirmação: `AlertAck`, enviado pela saída quando o áudio acaba. Só então a mensagem passa a "tocada".
- TTS gerado no servidor como ficheiro de áudio, nunca com a voz do navegador.

## Cenários
| Cenário | Visual | Como se liga |
|---|---|---|
| PC + OBS / Streamlabs | Sim | Browser Source |
| PC + TikTok LIVE Studio | Sim | Link Source (bug 0×0: contorno com OBS Virtual Camera) |
| Telemóvel + PRISM | Sim | Widget Web |
| Telemóvel + CameraFi Live | Sim | Overlay web |
| TikTok por partilha de ecrã | Parcial (experimental) | Página Fedha aberta no ecrã |
| Telemóvel, app nativa TikTok / Instagram / YouTube | Não | Player só-áudio |

Estratégia completa: https://claude.ai/artifact/916qoRFhGb3XDAugvVSwaa

## Protocolo do overlay (WebSocket)

`WS /v1/realtime/overlay?token=<token>&w=<1..6>`

Servidor → overlay:
- `{type:"config", data: WidgetConfig}` ao ligar e sempre que o streamer guarda no painel (aplica-se sem recarregar a fonte).
- `{type:"state", data:{goal, ranking, latest, queueSize}}` ao ligar e quando muda (W2–W6).
- `{type:"alert", data: AlertEvent}` um de cada vez; o seguinte só depois do `ack`.
- `{type:"revoked"}` quando o token é regenerado. `{type:"ping"}` → o overlay responde `pong`.

Overlay → servidor:
- `{type:"hello", data:{widget, scenario, userAgent}}` ao ligar (o painel mostra onde cada widget está aberto).
- `{type:"ack", data:{id, playedAt}}` quando o alerta acaba; só então a mensagem passa a "tocada".
- `{type:"ping"}` a cada 25 s.

Se o som não carregar em 5 s, o texto fica 6 s no ecrã sem som e o overlay envia o `ack` na mesma.

## Endpoints do painel (Widgets)

`GET /v1/widgets` · `PUT /v1/widgets/:id` · `POST /v1/widgets/:id/token` · `POST /v1/widgets/test` · `GET|PUT /v1/streamer/destination` · `GET /v1/widgets/last-test`
