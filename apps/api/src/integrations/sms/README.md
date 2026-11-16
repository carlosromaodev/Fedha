# sms

Códigos de verificação (RN-CON-02), recibos (RF-DOA-13) e avisos de reembolso. Fornecedor em `SMS_PROVIDER`:

- `ombala`: [Ombala](https://useombala.ao), o mesmo do MUTH e do UOR Connect. `OMBALA_API_TOKEN` e um `SMS_SENDER` aprovado na conta.
- `http`: outro gateway (POST JSON `{to, from, text}` com Bearer `SMS_HTTP_TOKEN`).
- `console`: só escreve no log (desenvolvimento e testes; recusado em produção).

Teste real: `pnpm --filter @fedha/api messaging check` e `pnpm --filter @fedha/api messaging sms 9XXXXXXXX`.
