import { existsSync } from "node:fs";
import { buildApp } from "./app";

if (existsSync(".env")) process.loadEnvFile(".env");

const { app, ctx } = await buildApp();
await app.listen({ port: ctx.env.PORT, host: ctx.env.HOST });

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    app.log.info({ sig }, "a encerrar");
    void app.close().then(() => process.exit(0));
  });
}
