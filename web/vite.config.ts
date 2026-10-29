import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/orders-api": {
        target: "http://localhost:3001",
        rewrite: (path) => path.replace(/^\/orders-api/, ""),
      },
      "/fulfillment-api": {
        target: "http://localhost:8000",
        rewrite: (path) => path.replace(/^\/fulfillment-api/, ""),
      },
    },
  },
});
