import { hasTerm } from "../text";
import type { ExpertoIdentity, OrchestratorConfig } from "../types";
import { parseBaseUrl, postServiceJob, pullServiceJob, type ServiceHttpMessages } from "./http";
import { failedOutput, type ServiceAdapter, type ServiceSubmitInput, type ServiceSubmitOutput } from "./types";

export type AbeetKind = "brokerage" | "property_management" | "listing" | "general_real_estate";

const STUB_MESSAGE = "وصلنا الطلب إلى وصلة أبيت التجريبية. ما فيه تنفيذ على أبيت في هالنسخة.";
const MISCONFIGURED = "عنوان أبيت (ABEET_API_BASE_URL) غير صالح. ما أرسلنا الطلب.";

const HTTP_MESSAGES: ServiceHttpMessages = {
  timeout: "انتهت مهلة الاتصال بأبيت. جرّب مرة ثانية.",
  network: "تعذّر الاتصال بأبيت. جرّب مرة ثانية.",
  http: (status) => `تعذّر الوصول إلى أبيت (HTTP ${status}). جرّب مرة ثانية.`,
  badBody: "رد أبيت غير مفهوم. ما اعتبرنا الطلب ناجحًا.",
};

/** Abeet is the first real backend: brokerage, property management, then listings. */
export function classifyAbeetKind(text: string): AbeetKind {
  if (hasTerm(text, "وساطة") || hasTerm(text, "وسيط") || hasTerm(text, "مكتب عقاري") || hasTerm(text, "brokerage")) {
    return "brokerage";
  }
  if (
    hasTerm(text, "إدارة أملاك") ||
    hasTerm(text, "أملاك") ||
    hasTerm(text, "مستأجر") ||
    hasTerm(text, "property management")
  ) {
    return "property_management";
  }
  if (["شقة", "فيلا", "أرض", "أراضي", "إيجار", "للبيع", "للشراء"].some((term) => hasTerm(text, term))) {
    return "listing";
  }
  return "general_real_estate";
}

function payload(input: ServiceSubmitInput, kind: AbeetKind) {
  return {
    source: "experto-intent-hub",
    locale: "ar",
    hubJobId: input.hubJobId,
    output: input.input.output,
    freeText: input.input.freeText,
    description: input.input.description,
    kind,
    identity: identityClaim(input.identity),
  };
}

function identityClaim(identity: ExpertoIdentity) {
  return {
    mode: identity.mode,
    authenticated: identity.authenticated,
    subject: identity.subject,
  };
}

function stub(input: ServiceSubmitInput): ServiceSubmitOutput {
  return {
    serviceJobId: `abeet_${crypto.randomUUID()}`,
    status: "stub",
    remote: false,
    previewUrl: `/preview/${input.hubJobId}`,
    messageAr: STUB_MESSAGE,
  };
}

export function createAbeetAdapter(config: OrchestratorConfig): ServiceAdapter {
  return {
    id: "abeet",
    labelAr: "أبيت",
    async submit(input) {
      const base = parseBaseUrl(config.abeetBaseUrl);
      const kind = classifyAbeetKind(input.intent.text);
      if (base.kind === "invalid") return failedOutput(MISCONFIGURED, "misconfigured");
      if (base.kind === "unset") return stub(input);
      return postServiceJob({
        config,
        baseUrl: base.url,
        service: "abeet",
        payload: payload(input, kind),
        messages: HTTP_MESSAGES,
      });
    },
    pull(serviceJobId) {
      const base = parseBaseUrl(config.abeetBaseUrl);
      if (base.kind !== "ok") return Promise.resolve(null);
      return pullServiceJob({
        config,
        baseUrl: base.url,
        service: "abeet",
        serviceJobId,
        messages: HTTP_MESSAGES,
      });
    },
  };
}
