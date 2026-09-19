import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "commerce-storefront-index",
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          const url = req.url && req.url.split("?")[0];
          if (url === "/" || url === "/index.html") req.url = "/commerce.html";
          next();
        });
      }
    }
  ],
  server: {
    host: "0.0.0.0",
    port: 8080,
    strictPort: true,
    allowedHosts: true,
    proxy: {
      "/health": "http://127.0.0.1:8787",
      "/v1": "http://127.0.0.1:8787",
      "/api": "http://127.0.0.1:8787"
    }
  }
});
