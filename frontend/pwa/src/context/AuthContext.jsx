import { createContext, useContext, useState } from "react";
import api from "../api/client";

// See ProtectedRoute.jsx — every exit from the app goes to this literal,
// absolute path via a real browser navigation.
const PWA_LOGIN_URL = "/login";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const token = localStorage.getItem("fc_token");
    const rol = localStorage.getItem("fc_rol");
    const nombre = localStorage.getItem("fc_nombre");
    return token ? { token, rol, nombre } : null;
  });

  async function login(email, password) {
    const res = await api.post("/auth/login", { email, password });
    const { access_token, rol, nombre } = res.data;
    if (rol !== "tecnico") {
      throw new Error("This app is for field workers only.");
    }
    localStorage.setItem("fc_token", access_token);
    localStorage.setItem("fc_rol", rol);
    localStorage.setItem("fc_nombre", nombre);
    setUser({ token: access_token, rol, nombre });
  }

  function logout() {
    localStorage.removeItem("fc_token");
    localStorage.removeItem("fc_rol");
    localStorage.removeItem("fc_nombre");
    sessionStorage.removeItem("fc_jornada_hoy");
    setUser(null);
    window.location.href = PWA_LOGIN_URL;
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
