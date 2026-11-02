import type { JobStatus, OrchestratorConfig, ServiceId } from "../types";
import { failedOutput, type ServiceSubmitOutput } from "./types";

const JOB_ID_PATTERN = /^[A-Za-z0-9_.:-]{1,80}$/;
const STATUSES = new Set<JobStatus>(["stub", "queued", "ready", "failed"]);

export interface ServiceHttpMessages {
  timeout: string;
  network: string;
  http: (status: number) => string;
  badBody: string;
}

export function parseBaseUrl(value: string | undefined): { kind: "unset" } | { kind: "invalid" } | { kind: "ok"; url: string } {
  if (!value?.trim()) return { kind: "unset" };
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return { kind: "invalid" };
    return { kind: "ok", url: url.toString().replace(/\/$/, "") };
  } catch {
    return { kind: "invalid" };
  }
}

export function sanitizePreviewUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return trimmed;
  try {
    const url = new URL(trimmed);
    if (url.protocol === "https:" || url.protocol === "http:") return url.toString();
  } catch {
    return null;
  }
  return null;
}

function readMessage(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const message = value.trim();
  if (!message || message.length > 300 || message.includes("<")) return fallback;
  return message;
}

function isTimeout(error: unknown): boolean {
  return error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
}

function authHeaders(config: OrchestratorConfig, service: ServiceId): Record<string, string> {
  const headers: Record<string, string> = {
    accept: "application/json",
    "x-experto-audience": config.identityAudience,
    "x-experto-service": service,
  };
  if (config.serviceToken) {
    headers.authorization = `Bearer ${config.serviceToken}`;
  }
  return headers;
}

async function readServiceResponse(response: Response, messages: ServiceHttpMessages): Promise<ServiceSubmitOutput> {
  if (!response.ok) {
    return failedOutput(messages.http(response.status), "service_unavailable");
  }
  const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  const serviceJobId = body?.serviceJobId;
  const status = body?.status;
  if (typeof serviceJobId !== "string" || !JOB_ID_PATTERN.test(serviceJobId)) {
    return failedOutput(messages.badBody, "service_unavailable");
  }
  if (typeof status !== "string" || !STATUSES.has(status as JobStatus)) {
    return failedOutput(messages.badBody, "service_unavailable");
  }
  const resolved = status as JobStatus;
  if (resolved === "failed") {
    return {
      ...failedOutput(readMessage(body?.messageAr, messages.badBody), "service_unavailable"),
      serviceJobId,
      remote: true,
    };
  }
  return {
    serviceJobId,
    status: resolved,
    remote: true,
    previewUrl: sanitizePreviewUrl(body?.previewUrl),
    messageAr: readMessage(body?.messageAr, "استلمت الخدمة الطلب."),
  };
}

export async function postServiceJob(options: {
  config: OrchestratorConfig;
  baseUrl: string;
  service: ServiceId;
  payload: unknown;
  messages: ServiceHttpMessages;
}): Promise<ServiceSubmitOutput> {
  try {
    const response = await options.config.fetchImpl(`${options.baseUrl}/v0/intent-jobs`, {
      method: "POST",
      headers: {
        ...authHeaders(options.config, options.service),
        "content-type": "application/json",
      },
      body: JSON.stringify(options.payload),
      signal: AbortSignal.timeout(options.config.timeoutMs),
    });
    return await readServiceResponse(response, options.messages);
  } catch (error) {
    return failedOutput(isTimeout(error) ? options.messages.timeout : options.messages.network, "service_unavailable");
  }
}

export async function pullServiceJob(options: {
  config: OrchestratorConfig;
  baseUrl: string;
  service: ServiceId;
  serviceJobId: string;
  messages: ServiceHttpMessages;
}): Promise<ServiceSubmitOutput | null> {
  try {
    const response = await options.config.fetchImpl(
      `${options.baseUrl}/v0/intent-jobs/${encodeURIComponent(options.serviceJobId)}`,
      {
        method: "GET",
        headers: authHeaders(options.config, options.service),
        signal: AbortSignal.timeout(options.config.timeoutMs),
      },
    );
    return await readServiceResponse(response, options.messages);
  } catch {
    return null;
  }
}
