import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/**
 * `APP_BASE_PATH` is the one place a deployment declares where the app lives.
 *
 * Vite bakes this into every emitted asset URL, and it also becomes
 * `import.meta.env.BASE_URL`, which the router reads as its basename. Both therefore come from a
 * single value and cannot drift into the state where assets resolve but routes do not.
 *
 * Vite requires a leading and trailing slash, so a value of `/creative` and `creative/` both
 * silently produce wrong URLs. Normalizing here means a deployer can write it either way.
 */
function normalizeBasePath(raw: string | undefined): string {
  const trimmed = raw?.trim();
  if (!trimmed || trimmed === "/") return "/";
  return `/${trimmed.replace(/^\/+/, "").replace(/\/+$/, "")}/`;
}

/**
 * The same policy the host configs send in production.
 *
 * Applied to `vite preview` so the policy is exercised locally rather than discovered to be wrong
 * after a deploy. Note there is no `unsafe-inline` for styles: React's `style` prop is applied
 * through CSSOM, not by writing a `style` attribute, so CSP does not intercept it. That was verified
 * against the built app rather than assumed, since it is the one part of this policy that looks
 * like it should fail.
 *
 * Kept out of the dev server on purpose. Vite's dev server injects inline scripts and styles for
 * HMR, so enforcing the production policy there would only teach people to ignore it.
 */
const SECURITY_HEADERS = {
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "font-src 'self'",
    "img-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; "),
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Cross-Origin-Opener-Policy": "same-origin",
};

/**
 * One port for both servers, because `localStorage` is scoped to scheme, host, **and port**.
 *
 * Dev on 5173 and preview on 4173 are two different origins, so each keeps its own copy of every
 * request, queue topic, and tracker row. Switching between the two therefore looked exactly like
 * losing work, and no amount of backup keys helps - the backup lives in the origin that vanished.
 *
 * `strictPort` is the other half. Without it Vite quietly moves to the next free port when this one
 * is busy, which recreates the same split silently. Failing to start is the better outcome: an error
 * you read beats a second data store you do not know about.
 */
const APP_PORT = 5173;

/**
 * Public proxy base URL only — never a secret. Empty means same-origin `/api/workfront`, which the
 * Vite dev server forwards to the local Runtime stand-in. A deployed Adobe Runtime web-action URL
 * is also fine here; it is not a credential.
 */
const WORKFRONT_PROXY_URL = (process.env.WORKFRONT_PROXY_URL || "").trim().replace(/\/+$/, "");

const WORKFRONT_PROXY_TARGET = (
  process.env.WORKFRONT_PROXY_TARGET || "http://127.0.0.1:8787"
).replace(/\/+$/, "");

/** Local Deep Dive Graph proxy (never a secret). */
const DEEP_DIVE_PROXY_TARGET = (
  process.env.DEEP_DIVE_PROXY_TARGET || "http://127.0.0.1:8788"
).replace(/\/+$/, "");

function connectSrcDirective(): string {
  const origins = new Set<string>(["'self'"]);
  if (WORKFRONT_PROXY_URL) {
    try {
      origins.add(new URL(WORKFRONT_PROXY_URL).origin);
    } catch {
      // Invalid URL stays out of CSP rather than breaking the build; the client will fail the fetch.
    }
  }
  return `connect-src ${[...origins].join(" ")}`;
}

const securityHeaders = {
  ...SECURITY_HEADERS,
  "Content-Security-Policy": SECURITY_HEADERS["Content-Security-Policy"].replace(
    "connect-src 'self'",
    connectSrcDirective(),
  ),
};

export default defineConfig({
  base: normalizeBasePath(process.env.APP_BASE_PATH),
  plugins: [react(), tailwindcss()],
  define: {
    __WORKFRONT_PROXY_URL__: JSON.stringify(WORKFRONT_PROXY_URL),
  },
  build: {
    /**
     * Never inline a font, whatever its size.
     *
     * Vite base64-inlines assets under 4 kB, and several Open Sans subsets are small enough to
     * qualify. Under `font-src 'self'` the browser then refuses every one of them and quietly falls
     * back to a system font for those glyph ranges - found by running scripts/probe-csp.mjs, not by
     * reading the config. Emitting them as files keeps the policy strict and lets the immutable
     * cache headers apply to them.
     */
    assetsInlineLimit: (filePath) =>
      /\.(woff2?|ttf|otf|eot)$/i.test(filePath) ? false : undefined,
  },
  server: {
    port: APP_PORT,
    strictPort: true,
    proxy: {
      // Keeps secrets on the local proxy and `connect-src 'self'` intact during `npm run dev`.
      "/api/workfront": {
        target: WORKFRONT_PROXY_TARGET,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/workfront/, ""),
      },
      "/api/deep-dive": {
        target: DEEP_DIVE_PROXY_TARGET,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/deep-dive/, ""),
      },
    },
  },
  preview: {
    port: APP_PORT,
    strictPort: true,
    headers: securityHeaders,
    proxy: {
      "/api/workfront": {
        target: WORKFRONT_PROXY_TARGET,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/workfront/, ""),
      },
      "/api/deep-dive": {
        target: DEEP_DIVE_PROXY_TARGET,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/deep-dive/, ""),
      },
    },
  },
});
