/**
 * Short-lived IMS user token for Workfront API calls (Path A — ExC Shell).
 *
 * Token stays in memory only — never localStorage, never VITE_*, never logged.
 * Outside Experience Cloud Shell there is no token; the proxy falls back to S2S.
 *
 * DEV-only: `sessionStorage.setItem("__mc_dev_ims__", "<token>")` then reload —
 * use a token from `npm run aio:login` (do not paste tokens into chat).
 */

export type WorkfrontUserAuthSource = "exc-shell" | "dev-session" | "none";

export interface WorkfrontUserAuth {
  source: WorkfrontUserAuthSource;
  /** Present when source is exc-shell or (DEV only) dev-session. */
  bearerToken?: string;
  /** Best-effort email from IMS profile (for Entered By copy). */
  email?: string;
}

/** DEV-only sessionStorage key. Never use in production builds. Never commit the value. */
const DEV_SESSION_KEY = "__mc_dev_ims__";

let current: WorkfrontUserAuth = { source: "none" };

function readDevSessionBearer(): string | undefined {
  if (!import.meta.env.DEV) return undefined;
  try {
    const raw = sessionStorage.getItem(DEV_SESSION_KEY);
    const token = typeof raw === "string" ? raw.trim() : "";
    return token || undefined;
  } catch {
    return undefined;
  }
}

export function getWorkfrontUserAuth(): WorkfrontUserAuth {
  if (current.source !== "none" && current.bearerToken) {
    return current;
  }
  const devToken = readDevSessionBearer();
  if (devToken) {
    return { source: "dev-session", bearerToken: devToken };
  }
  return current;
}

/** Bearer for Authorization header, or undefined when using S2S on the proxy. */
export function getWorkfrontUserBearer(): string | undefined {
  const auth = getWorkfrontUserAuth();
  const token = auth.bearerToken?.trim();
  return token || undefined;
}

export function hasWorkfrontUserBearer(): boolean {
  return Boolean(getWorkfrontUserBearer());
}

/**
 * @internal Test / shell callback only. Never call with a token from localStorage.
 */
export function setWorkfrontUserBearer(
  token: string,
  profile?: { email?: string; userId?: string },
): void {
  const trimmed = token.trim();
  if (!trimmed) {
    current = { source: "none" };
    return;
  }
  const email =
    typeof profile?.email === "string" && profile.email.trim()
      ? profile.email.trim()
      : typeof profile?.userId === "string" && profile.userId.includes("@")
        ? profile.userId.trim()
        : undefined;
  current = { source: "exc-shell", bearerToken: trimmed, email };
}

export function clearWorkfrontUserBearer(): void {
  current = { source: "none" };
}

function profileEmail(profile: unknown): string | undefined {
  if (!profile || typeof profile !== "object") return undefined;
  const record = profile as Record<string, unknown>;
  for (const key of ["email", "userId", "preferred_username"]) {
    const value = record[key];
    if (typeof value === "string" && value.includes("@")) return value.trim();
  }
  return undefined;
}

/**
 * When Mission Control is loaded inside Experience Cloud Shell, capture Chris’s IMS token.
 * Outside the shell this is a no-op so local Vite keeps working (proxy uses S2S).
 */
export async function attachExcShellBearer(): Promise<WorkfrontUserAuth> {
  try {
    const exc = await import("@adobe/exc-app");
    const emr = typeof exc.getEMR === "function" ? exc.getEMR() : null;
    if (!emr) {
      return current;
    }

    await new Promise<void>((resolve) => {
      exc.init(() => {
        void (async () => {
          try {
            const user = (await import("@adobe/exc-app/user")).default;
            const page = (await import("@adobe/exc-app/page")).default;
            const [token, profile] = await Promise.all([
              user.get("imsToken"),
              user.get("imsProfile"),
            ]);
            if (typeof token === "string" && token.trim()) {
              setWorkfrontUserBearer(token, { email: profileEmail(profile) });
            }
            user.on("change:imsToken", (next?: string) => {
              if (typeof next === "string" && next.trim()) {
                setWorkfrontUserBearer(next, {
                  email: current.email,
                });
              } else {
                clearWorkfrontUserBearer();
              }
            });
            await page.done();
          } catch {
            // Shell present but token unavailable — leave S2S fallback.
          } finally {
            resolve();
          }
        })();
      });
    });
  } catch {
    // Package or shell wire missing — standalone Mission Control.
  }
  return current;
}
