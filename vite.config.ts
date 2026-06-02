import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("/react/") || id.includes("/react-dom/")) return "vendor-react";
          if (
            id.includes("/@mui/") ||
            id.includes("/@emotion/react/") ||
            id.includes("/@emotion/styled/")
          ) {
            return "vendor-mui";
          }
          if (id.includes("/@tauri-apps/api/")) return "vendor-tauri";
          if (
            id.includes("/@tanstack/react-query/") ||
            id.includes("/@tanstack/react-virtual/") ||
            id.includes("/lucide-react/")
          ) {
            return "vendor-utils";
          }
          return "vendor";
        },
      },
    },
  },
  server: {
    port: 1420,
    strictPort: true,
    host: "127.0.0.1",
  },
});
