import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

/**
 * O site tem duas entradas no mesmo build e no mesmo domínio (RN-WID-01):
 *  - index.html → a app React (página pública, checkout, painel, back-office);
 *  - o/index.html → os widgets W1–W6, uma página leve sem React, servida em /o/<token>.
 * Em desenvolvimento, este plugin faz o mesmo que o rewrite da Vercel: /o/* → /o/index.html.
 */
function widgetRoute(): Plugin {
  const rewrite = (req: { url?: string }, _res: unknown, next: () => void) => {
    if (req.url && /^\/o\/[^.]*$/.test(req.url.split("?")[0]!)) {
      const q = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
      req.url = `/o/index.html${q}`;
    }
    next();
  };
  return {
    name: "fedha-widget-route",
    configureServer(server) { server.middlewares.use(rewrite); },
    configurePreviewServer(server) { server.middlewares.use(rewrite); },
  };
}

export default defineConfig({
  plugins: [react(), widgetRoute()],
  server: { port: 5173 },
  build: {
    rollupOptions: {
      input: {
        site: resolve(__dirname, "index.html"),
        widget: resolve(__dirname, "o/index.html"),
      },
    },
  },
});
