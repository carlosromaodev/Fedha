# ADR 0003 — Widgets dentro do site principal

Estado: aceite · SDD v2.0, secção 3 e RN-WID-01

Contexto: a primeira versão tinha os widgets numa app e num projeto Vercel à parte (`apps/overlay`). O streamer teria de lidar com dois endereços e o código ficava disperso.

Decisão:
1. Um só site (`apps/web`) e um só domínio servem a página pública, o checkout, o painel, o back-office e os widgets em `/o/<token>`.
2. Os widgets são uma segunda entrada do mesmo build Vite (`o/index.html` → `src/overlay/main.ts`), sem React, para continuarem leves dentro dos navegadores embutidos (OBS, TikTok LIVE Studio, PRISM, CameraFi).
3. A Vercel reescreve `/o/*` para `/o/index.html` antes do rewrite da SPA (`apps/web/vercel.json`); em desenvolvimento, o plugin `fedha-widget-route` do `vite.config.ts` faz o mesmo.
4. O link que o streamer copia em Widgets usa a origem do próprio site: `<site>/o/<token>?w=<n>&layout=h|v` (RF-WID-01). `VITE_PUBLIC_URL` só força outro domínio público.
5. A API continua fora da Vercel (WebSocket); o widget lê `VITE_API_URL` do mesmo build.
