import { resolveExpertoIdentity } from "./identity";
import { interpretIntent } from "./interpret";
import { createJobStore, type JobStore } from "./jobs";
import { routeIntent } from "./route";
import { createServiceRegistry } from "./services/registry";
import type { ServiceSubmitOutput } from "./services/types";
import type { IdentityContext, IntentInput, OrchestratorConfig, OutputKind, PublicJob, SubmitResult } from "./types";
import { validateIntentInput } from "./validate";

const OUTPUT_AR: Record<OutputKind, string> = {
  website: "موقع",
  video: "فيديو",
  app: "تطبيق",
};

function summarize(input: IntentInput): string {
  const parts = [input.output ? OUTPUT_AR[input.output] : null, input.freeText.trim() || null, input.description.trim() || null].filter(
    (part): part is string => Boolean(part),
  );
  const text = parts.join(" — ");
  return text.length > 180 ? `${text.slice(0, 177)}…` : text;
}

function toPublicJob(
  hubJobId: string,
  labelAr: string,
  decisionReason: string,
  summaryAr: string,
  output: ServiceSubmitOutput,
  service: PublicJob["service"],
): PublicJob {
  const failed = output.status === "failed";
  return {
    id: hubJobId,
    service,
    serviceLabelAr: labelAr,
    serviceJobId: output.serviceJobId,
    status: failed ? "failed" : output.status,
    remote: output.remote,
    previewUrl: failed ? null : output.previewUrl,
    messageAr: output.messageAr,
    reasonAr: decisionReason,
    summaryAr,
    createdAt: new Date().toISOString(),
  };
}

export interface Orchestrator {
  submitIntent(raw: unknown, ctx: IdentityContext): Promise<SubmitResult>;
  getJob(id: string): Promise<PublicJob | null>;
}

export function createOrchestrator(config: OrchestratorConfig, store: JobStore = createJobStore()): Orchestrator {
  const services = createServiceRegistry(config);

  async function refresh(job: PublicJob): Promise<PublicJob> {
    if (!job.remote || !job.serviceJobId || job.status !== "queued") return job;
    const adapter = services[job.service];
    const next = await adapter.pull(job.serviceJobId);
    if (!next || next.status === "queued") return job;
    const updated = toPublicJob(job.id, job.serviceLabelAr, job.reasonAr, job.summaryAr, next, job.service);
    updated.createdAt = job.createdAt;
    store.save(updated);
    return updated;
  }

  return {
    async submitIntent(raw, ctx) {
      const validated = validateIntentInput(raw);
      if (!validated.ok) return validated;

      const identity = await resolveExpertoIdentity(config, ctx);
      if (!identity.ok) return identity;

      const intent = interpretIntent(validated.value);
      const decision = routeIntent(intent);
      if (!decision.service) {
        return { ok: false, error: { code: "unroutable", messageAr: decision.reasonAr } };
      }

      const adapter = services[decision.service];
      const hubJobId = `hub_${crypto.randomUUID()}`;
      let submitted: ServiceSubmitOutput;
      try {
        submitted = await adapter.submit({
          intent,
          input: validated.value,
          identity: identity.identity,
          hubJobId,
        });
      } catch (error) {
        console.error("orchestrator submit failed", adapter.id, error instanceof Error ? error.name : "unknown");
        submitted = {
          serviceJobId: null,
          status: "failed",
          remote: false,
          previewUrl: null,
          messageAr: "صار خلل أثناء توجيه الطلب. جرّب مرة ثانية.",
          errorCode: "service_unavailable",
        };
      }

      const job = toPublicJob(hubJobId, adapter.labelAr, decision.reasonAr, summarize(validated.value), submitted, adapter.id);
      store.save(job);

      if (job.status === "failed") {
        return {
          ok: false,
          error: {
            code: submitted.errorCode ?? "service_unavailable",
            messageAr: job.messageAr,
          },
          job,
        };
      }

      return { ok: true, job };
    },

    async getJob(id) {
      const job = store.get(id);
      if (!job) return null;
      return refresh(job);
    },
  };
}
