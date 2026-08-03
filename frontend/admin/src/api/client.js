import axios from "axios";

// In production (docker-compose + nginx) this is "/api"; in local dev point
// it straight at uvicorn. Configure via frontend/admin/.env → VITE_API_URL.
const baseURL = import.meta.env.VITE_API_URL || "/api";

export const api = axios.create({ baseURL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("fc_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("fc_token");
      localStorage.removeItem("fc_rol");
      localStorage.removeItem("fc_nombre");
      if (!window.location.pathname.endsWith("/login")) {
        const prefix = window.location.pathname.startsWith("/admin") ? "/admin" : "";
        window.location.href = `${prefix}/login`;
      }
    }
    return Promise.reject(error);
  }
);

/**
 * Fetch a photo through the authenticated /fotos endpoint (never a direct
 * static path) and hand back a blob object URL for use in <img src>.
 * Caller is responsible for URL.revokeObjectURL when done with it.
 */
export async function fetchFotoUrl(relativePath) {
  const res = await api.get(`/fotos/${relativePath}`, { responseType: "blob" });
  return URL.createObjectURL(res.data);
}

export default api;
