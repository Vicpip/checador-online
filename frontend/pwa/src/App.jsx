import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import Jornada from "./pages/Jornada";
import Login from "./pages/Login";
import MisJornadas from "./pages/MisJornadas";
import MisPermisos from "./pages/MisPermisos";
import MisServicios from "./pages/MisServicios";
import SolicitarPermiso from "./pages/SolicitarPermiso";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Jornada />} />
        <Route path="mis-servicios" element={<MisServicios />} />
        <Route path="mis-jornadas" element={<MisJornadas />} />
        <Route path="mis-permisos" element={<MisPermisos />} />
        <Route path="solicitar-permiso" element={<SolicitarPermiso />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
