import type { ExpertoIdentity, IdentityContext, OrchestratorConfig, SubmitError } from "./types";

type IdentityResult = { ok: true; identity: ExpertoIdentity } | { ok: false; error: SubmitError };

function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    const key = part.slice(0, separator).trim();
    if (key !== name) continue;
    const value = part.slice(separator + 1).trim();
    return value || null;
  }
  return null;
}

function readSubject(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  const value = record.subject ?? record.sub;
  if (typeof value !== "string") return null;
  const subject = value.trim();
  if (!subject || subject.length > 200 || /[\r\n]/.test(subject)) return null;
  return subject;
}

function isTimeout(error: unknown): boolean {
  return error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
}

/**
 * Placeholder when EXPERTO_IDENTITY_URL is empty.
 * When it is set, a missing or rejected Experto session fails closed.
 */
export async function resolveExpertoIdentity(
  config: OrchestratorConfig,
  ctx: IdentityContext,
): Promise<IdentityResult> {
  if (!config.identityUrl) {
    return {
      ok: true,
      identity: { mode: "placeholder", authenticated: false, subject: null },
    };
  }

  let endpoint: URL;
  try {
    const base = config.identityUrl.endsWith("/") ? config.identityUrl : `${config.identityUrl}/`;
    endpoint = new URL("session", base);
  } catch {
    return {
      ok: false,
      error: {
        code: "misconfigured",
        messageAr: "عنوان هوية إكسبرتو غير صالح. ما أرسلنا الطلب.",
      },
    };
  }
  if (endpoint.protocol !== "http:" && endpoint.protocol !== "https:") {
    return {
      ok: false,
      error: {
        code: "misconfigured",
        messageAr: "عنوان هوية إكسبرتو غير صالح. ما أرسلنا الطلب.",
      },
    };
  }

  const cookie = readCookie(ctx.cookieHeader, config.sessionCookieName);
  if (!cookie) {
    return {
      ok: false,
      error: {
        code: "identity_failed",
        messageAr: "يلزم دخول إكسبرتو قبل إرسال الطلب.",
      },
    };
  }

  try {
    const response = await config.fetchImpl(endpoint, {
      method: "GET",
      headers: {
        accept: "application/json",
        cookie: `${config.sessionCookieName}=${cookie}`,
        "x-experto-audience": config.identityAudience,
      },
      signal: AbortSignal.timeout(config.timeoutMs),
    });
    if (response.status === 401 || response.status === 403) {
      return {
        ok: false,
        error: {
          code: "identity_failed",
          messageAr: "جلسة إكسبرتو غير مقبولة. ادخل من جديد ثم أعد المحاولة.",
        },
      };
    }
    if (!response.ok) {
      return {
        ok: false,
        error: {
          code: "identity_failed",
          messageAr: "تعذّر التحقق من هوية إكسبرتو. جرّب مرة ثانية.",
        },
      };
    }
    const subject = readSubject(await response.json().catch(() => null));
    if (!subject) {
      return {
        ok: false,
        error: {
          code: "identity_failed",
          messageAr: "تعذّر التحقق من هوية إكسبرتو. جرّب مرة ثانية.",
        },
      };
    }
    return {
      ok: true,
      identity: { mode: "verified", authenticated: true, subject },
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "identity_failed",
        messageAr: isTimeout(error)
          ? "انتهت مهلة التحقق من هوية إكسبرتو. جرّب مرة ثانية."
          : "تعذّر التحقق من هوية إكسبرتو. جرّب مرة ثانية.",
      },
    };
  }
}
