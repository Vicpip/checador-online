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
          // Precache the full app shell (HTML/CSS/JS/icons) so the PWA boots
          // with no network at all, and fall back to it for SPA navigations
          // (e.g. a hard refresh on /mis-jornadas while offline).
          globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
          navigateFallback: "/index.html",
          navigateFallbackDenylist: [/^\/api\//],
          runtimeCaching: [
            {
              // GET /me/jornada/hoy — read-only status, safe to serve stale.
              urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname === "/api/me/jornada/hoy",
              handler: "NetworkFirst",
              options: {
                cacheName: "api-jornada-hoy",
                networkTimeoutSeconds: 5,
                cacheableResponse: { statuses: [0, 200] },
                expiration: { maxEntries: 5, maxAgeSeconds: 60 * 60 * 24 },
              },
            },
            {
              // GET /jornadas/historial — técnico's own attendance history.
              urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname === "/api/jornadas/historial",
              handler: "NetworkFirst",
              options: {
                cacheName: "api-jornadas-historial",
                networkTimeoutSeconds: 5,
                cacheableResponse: { statuses: [0, 200] },
                expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 },
              },
            },
            {
              // GET /config — branding + working-hours config.
              urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname === "/api/config",
              handler: "NetworkFirst",
              options: {
                cacheName: "api-config",
                networkTimeoutSeconds: 5,
                cacheableResponse: { statuses: [0, 200] },
                expiration: { maxEntries: 5, maxAgeSeconds: 60 * 60 * 24 },
              },
            },
          ],
        },
      }),
    ],
    server: {
      port: 5173,
    },
  };
});
