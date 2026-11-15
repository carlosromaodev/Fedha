# @fedha/overlay

Aplicação separada e leve que serve os links de overlay. Não é uma rota do painel React: corre durante horas nos navegadores embutidos do OBS, Streamlabs, TikTok LIVE Studio e PRISM, por isso não usa dependências pesadas.

URL: `/o/<token>?layout=h|v` (token secreto e revogável pelo streamer).

## Requisitos
- Fundo transparente; layouts horizontal 1920×1080 e vertical 1080×1920.
- O áudio toca na própria página, para o programa de transmissão o captar como fonte.
- O alerta fica no ecrã enquanto o áudio toca e sai quando acaba.
- Confirma ao servidor (`ack`) quando acaba de tocar; só então a mensagem passa a "tocada". Desligado = a fila espera.
- Volta a ligar-se sozinho e retoma a fila depois de uma queda de rede.
- Recebe o evento `AlertEvent` de `@fedha/contracts`, igual ao do Player.

## Estrutura
- `src/runtime/`: ligação em tempo real, reconexão, fila local, ack.
- `src/audio/`: reprodução do áudio gerado no servidor.
- `src/widgets/`: W1–W5.

Contrato: `docs/outputs/README.md`. Estratégia: https://claude.ai/artifact/916qoRFhGb3XDAugvVSwaa
