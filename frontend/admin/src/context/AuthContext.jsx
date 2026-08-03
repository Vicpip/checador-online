import { createContext, useContext, useState } from "react";
import api from "../api/client";

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
    if (rol !== "admin") {
      throw new Error("This panel is for administrators only.");
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
    setUser(null);
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
