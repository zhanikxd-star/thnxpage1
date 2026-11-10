import { defineConfig } from "vite";

// Для локальной проверки формы: VLS_API_PROXY=http://127.0.0.1:8080 npm run dev,
// где на 8080 запущен php -S с папкой public.
const apiProxy = process.env.VLS_API_PROXY;

export default defineConfig({
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    proxy: apiProxy ? { "/api": { target: apiProxy, changeOrigin: false } } : undefined,
  },
  preview: {
    host: "0.0.0.0",
    port: 4173,
    strictPort: true,
  },
});
