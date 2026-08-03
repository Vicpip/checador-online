import axios from "axios";

// In production (docker-compose + nginx) this is "/api"; in local dev point
// it straight at uvicorn. Configure via frontend/pwa/.env → VITE_API_URL.
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
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default api;
