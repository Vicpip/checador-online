import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(() => {
  const base = "/";

  return {
    base,
    plugins: [
      react(),
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["icons/icon-192.png", "icons/icon-512.png"],
        manifest: {
          name: "field-check",
          short_name: "field-check",
          description: "Worker check-in / check-out",
          start_url: base,
          scope: base,
          display: "standalone",
          // Fallback theme color — the real branding color is applied at
          // runtime from GET /config; this only affects the OS splash/status
          // bar before the app has ever loaded config once.
          background_color: "#ffffff",
          theme_color: "#1F5FA5",
          icons: [
            { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
            { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          ],
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
        },
      }),
    ],
    server: {
      port: 5173,
    },
  };
});
