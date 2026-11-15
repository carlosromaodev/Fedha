# Spec — Reprodução (`playback`)

> Estado: rascunho · Referências na especificação funcional: S3, S6, W1–W5, capítulo Saídas · Estratégia: https://claude.ai/artifact/916qoRFhGb3XDAugvVSwaa

## Objetivo
Motor TTS, armazenamento de áudio, sessões do Player e tokens dos widgets OBS.

O overlay W1 é a saída principal; o Player S3 é o plano B só-áudio. Contrato em `docs/outputs/README.md`.

## Âmbito
- Dentro:
- Fora:

## Entidades
AudioAsset, PlayerSession, WidgetToken

## Requisitos
| ID | Requisito | Prioridade (MVP/F2) |
|----|-----------|---------------------|
| PLAYBACK-R1 | W1: um só link com texto e áudio sincronizados, layouts 1920×1080 e 1080×1920 | MVP |
| PLAYBACK-R2 | TTS gerado no servidor como ficheiro de áudio, com cache | MVP |
| PLAYBACK-R3 | Modo de saída por streamer (`overlay` ou `audio_only`); uma mensagem nunca toca nas duas saídas | MVP |
| PLAYBACK-R4 | A saída confirma (`AlertAck`) quando acaba; só então a mensagem passa a "tocada" | MVP |
| PLAYBACK-R5 | Token do overlay secreto e revogável; botão "alerta de teste" | MVP |
| PLAYBACK-R6 | S6: aparência do alerta (posição, tema, duração pelo tamanho do texto, mostrar ou esconder valor) | MVP |
| PLAYBACK-R7 | W5 (QR) desligado quando o destino é TikTok ou Instagram, com aviso | MVP |
| PLAYBACK-R8 | Enviar a mensagem como alerta da Streamlabs / StreamElements | F2 |

## Critérios de aceitação
- [ ] Dado o overlay desligado, quando chega um pedido pago, então fica na fila até o overlay voltar
- [ ] Dado o modo `overlay`, quando a mensagem toca, então o Player não a recebe
- [ ] Dado o destino TikTok, quando o streamer abre os widgets, então o W5 aparece desligado com o motivo

## Questões em aberto
- Confirmar em teste: PRISM para TikTok e Instagram; Link Source na versão atual do TikTok LIVE Studio
