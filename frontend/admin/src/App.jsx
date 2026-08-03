import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import Calendario from "./pages/Calendario";
import Clientes from "./pages/Clientes";
import Configuracion from "./pages/Configuracion";
import Dashboard from "./pages/Dashboard";
import Jornadas from "./pages/Jornadas";
import Login from "./pages/Login";
import Reportes from "./pages/Reportes";
import Usuarios from "./pages/Usuarios";

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
        <Route index element={<Dashboard />} />
        <Route path="jornadas" element={<Jornadas />} />
        <Route path="reportes" element={<Reportes />} />
        <Route path="calendario" element={<Calendario />} />
        <Route path="usuarios" element={<Usuarios />} />
        <Route path="clientes" element={<Clientes />} />
        <Route path="configuracion" element={<Configuracion />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
