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
| Telemóvel, app nativa TikTok / Instagram / YouTube | Não | Player só-áudio |

Estratégia completa: https://claude.ai/artifact/916qoRFhGb3XDAugvVSwaa
