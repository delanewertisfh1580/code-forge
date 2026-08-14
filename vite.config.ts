import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Старые standalone HTML-файлы в корне не должны становиться entrypoint'ами
  // новой React-системы: один граф зависимостей гарантирует единственный React.
  resolve: {
    dedupe: ["react", "react-dom"],
  },
  optimizeDeps: {
    entries: ["index.html"],
    include: ["react", "react-dom", "react-dom/client", "@supabase/supabase-js"],
  },
  build: {
    rollupOptions: {
      input: "index.html",
    },
  },
  server: {
    host: "0.0.0.0",
    hmr: false,
  },
});
