import type { OrchestratorConfig } from "./types";

function readOptional(env: NodeJS.ProcessEnv, key: string): string | undefined {
  const value = env[key];
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export function configFromEnv(
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch,
): OrchestratorConfig {
  const timeoutRaw = readOptional(env, "ABEET_API_TIMEOUT_MS");
  const parsedTimeout = timeoutRaw ? Number(timeoutRaw) : 8000;
  const timeoutMs = Number.isFinite(parsedTimeout) && parsedTimeout > 0 ? parsedTimeout : 8000;

  return {
    identityUrl: readOptional(env, "EXPERTO_IDENTITY_URL"),
    identityAudience: readOptional(env, "EXPERTO_IDENTITY_AUDIENCE") ?? "experto-intent-hub",
    sessionCookieName: readOptional(env, "EXPERTO_SESSION_COOKIE_NAME") ?? "experto_session",
    serviceToken: readOptional(env, "EXPERTO_SERVICE_TOKEN"),
    abeetBaseUrl: readOptional(env, "ABEET_API_BASE_URL"),
    studioBaseUrl: readOptional(env, "STUDIO_API_BASE_URL"),
    marketerBaseUrl: readOptional(env, "MARKETER_API_BASE_URL"),
    timeoutMs,
    fetchImpl,
  };
}
