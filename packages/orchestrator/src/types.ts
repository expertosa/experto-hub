export const OUTPUTS = ["website", "video", "app"] as const;
export type OutputKind = (typeof OUTPUTS)[number];

export const SERVICE_IDS = ["abeet", "studio", "marketer"] as const;
export type ServiceId = (typeof SERVICE_IDS)[number];

export const JOB_STATUSES = ["stub", "queued", "ready", "failed"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const ERROR_CODES = [
  "invalid_input",
  "unroutable",
  "service_unavailable",
  "identity_failed",
  "misconfigured",
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export interface IntentInput {
  output: OutputKind | null;
  freeText: string;
  description: string;
}

export interface IntentSignals {
  realEstate: boolean;
  video: boolean;
  marketing: boolean;
}

export interface InterpretedIntent {
  output: OutputKind | null;
  text: string;
  signals: IntentSignals;
}

export interface RouteDecision {
  service: ServiceId | null;
  reasonAr: string;
}

/** Session facts from Experto identity. v0 does not mint its own accounts. */
export interface ExpertoIdentity {
  mode: "placeholder" | "verified";
  authenticated: boolean;
  subject: string | null;
}

export interface IdentityContext {
  cookieHeader: string | null;
}

export interface PublicJob {
  id: string;
  service: ServiceId;
  serviceLabelAr: string;
  serviceJobId: string | null;
  status: JobStatus;
  /** True only after a real HTTP backend accepted or rejected the call. */
  remote: boolean;
  previewUrl: string | null;
  messageAr: string;
  reasonAr: string;
  summaryAr: string;
  createdAt: string;
}

export interface SubmitError {
  code: ErrorCode;
  messageAr: string;
}

export type SubmitResult =
  | { ok: true; job: PublicJob }
  | { ok: false; error: SubmitError; job?: PublicJob };

export interface OrchestratorConfig {
  identityUrl?: string;
  identityAudience: string;
  sessionCookieName: string;
  serviceToken?: string;
  abeetBaseUrl?: string;
  studioBaseUrl?: string;
  marketerBaseUrl?: string;
  timeoutMs: number;
  fetchImpl: typeof fetch;
}
