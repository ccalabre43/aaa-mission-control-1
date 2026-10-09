import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { attachExcShellBearer } from "./lib/workfront/userBearer";

// Open Sans is the brand guide's designated web substitute for Gotham, which is licensed
// and cannot be shipped. Self-hosted via @fontsource so no request goes to a third party.
import "@fontsource/open-sans/400.css";
import "@fontsource/open-sans/600.css";
import "@fontsource/open-sans/700.css";
import "./index.css";

/**
 * `BASE_URL` is whatever `APP_BASE_PATH` was set to at build time, normalized by vite.config.ts.
 * Giving the router the same value Vite gave the assets is what lets this app be served from a
 * subpath such as https://intranet/creative/ without a code change.
 *
 * React Router wants the basename without a trailing slash, while Vite requires one, so the slash
 * is stripped here rather than asking the deployer to keep two spellings in sync.
 */
const basename = import.meta.env.BASE_URL.replace(/\/$/, "");

// Path A: capture IMS token when hosted in Experience Cloud Shell. No-op for local Vite.
void attachExcShellBearer();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter basename={basename}>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
