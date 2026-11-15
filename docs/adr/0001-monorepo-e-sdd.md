# ADR 0001 — Monorepo e spec-driven development

Decisão: monorepo pnpm com `apps/api` (Fastify + Zod), `apps/web` (React + Vite) e `packages/contracts`. Cada módulo da API tem `spec/`, escrita e aprovada antes do código.
