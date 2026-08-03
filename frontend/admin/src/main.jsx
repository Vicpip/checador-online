import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { ConfigProvider } from "./context/ConfigContext";
import "./index.css";

// This build is served at both "/" and "/admin/" (see nginx.conf) — pick the
// basename that matches whichever prefix actually loaded the page, so
// client-side links/redirects stay under the same prefix the user is on.
const basename = import.meta.env.PROD
  ? window.location.pathname.startsWith("/admin")
    ? "/admin"
    : "/"
  : "/";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter basename={basename}>
      <ConfigProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ConfigProvider>
    </BrowserRouter>
  </React.StrictMode>
);
