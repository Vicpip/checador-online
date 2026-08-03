import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig(({ command }) => ({
  // Built assets are always requested at /admin/assets/... — this holds
  // regardless of whether the page itself was loaded from "/" or "/admin/"
  // (nginx serves this same build under both prefixes).
  base: command === "build" ? "/admin/" : "/",
  plugins: [react()],
  server: {
    port: 5174,
  },
}));
