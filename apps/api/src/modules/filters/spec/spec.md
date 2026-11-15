# Spec — Filtros antes do pagamento (`filters`)

> Estado: rascunho · Referências na especificação funcional: S9, B8 · Estratégia: https://claude.ai/artifact/916qoRFhGb3XDAugvVSwaa

## Objetivo
Palavras bloqueadas (lista do streamer + lista base), links, telefones e doadores bloqueados, verificados no compositor antes de pagar.

Como a mensagem aparece escrita no ecrã da live, uma infração cai na conta do streamer. Mantém-se a regra sem moderação, com filtros mais fortes.

## Âmbito
- Dentro:
- Fora:

## Entidades
BlockedWord, BlockedDonor

## Requisitos
| ID | Requisito | Prioridade (MVP/F2) |
|----|-----------|---------------------|
| FILTERS-R1 | Bloqueio de links, números de telefone e QR sempre ligado (não desativável) | MVP |
| FILTERS-R2 | Palavras bloqueadas: lista base da plataforma + lista do streamer | MVP |
| FILTERS-R3 | Doadores bloqueados | MVP |
| FILTERS-R4 | Verificação no compositor, antes do pagamento | MVP |

## Critérios de aceitação
- [ ] Dado um texto com um link ou telefone, quando o doador tenta pagar, então o pagamento fica bloqueado até corrigir
- [ ] Dado o painel S9, então os filtros de links, telefones e QR aparecem ligados e sem opção de desligar

## Questões em aberto
-
