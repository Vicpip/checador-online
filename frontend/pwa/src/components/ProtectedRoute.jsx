import { useEffect } from "react";
import { useAuth } from "../context/AuthContext";

// A hard browser navigation here — not React Router's <Navigate> — guarantees
// a full reload regardless of router/service-worker state. The PWA now has
// its own origin (separate nginx port), so this is just "/login".
const PWA_LOGIN_URL = "/login";

export default function ProtectedRoute({ children }) {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      window.location.href = PWA_LOGIN_URL;
    }
  }, [user]);

  if (!user) return null;
  return children;
}
