import { hasTerm } from "../text";
import type { OrchestratorConfig } from "../types";
import { parseBaseUrl, postServiceJob, pullServiceJob, type ServiceHttpMessages } from "./http";
import { failedOutput, type ServiceAdapter, type ServiceSubmitInput, type ServiceSubmitOutput } from "./types";

export type StudioKind = "video_ad" | "video";

const STUB_MESSAGE = "وصلنا الطلب إلى وصلة الاستوديو التجريبية. التنفيذ الحقيقي مو متصل بعد.";
const MISCONFIGURED = "عنوان الاستوديو (STUDIO_API_BASE_URL) غير صالح. ما أرسلنا الطلب.";

const HTTP_MESSAGES: ServiceHttpMessages = {
  timeout: "انتهت مهلة الاتصال بالاستوديو. جرّب مرة ثانية.",
  network: "تعذّر الاتصال بالاستوديو. جرّب مرة ثانية.",
  http: (status) => `تعذّر الوصول إلى الاستوديو (HTTP ${status}). جرّب مرة ثانية.`,
  badBody: "رد الاستوديو غير مفهوم. ما اعتبرنا الطلب ناجحًا.",
};

export function classifyStudioKind(text: string): StudioKind {
  if (hasTerm(text, "إعلان") || hasTerm(text, "ترويج") || hasTerm(text, "ad")) return "video_ad";
  return "video";
}

function stub(input: ServiceSubmitInput): ServiceSubmitOutput {
  return {
    serviceJobId: `studio_${crypto.randomUUID()}`,
    status: "stub",
    remote: false,
    previewUrl: `/preview/${input.hubJobId}`,
    messageAr: STUB_MESSAGE,
  };
}

/** Studio is wired after Abeet. Same HTTP contract, local stub until STUDIO_API_BASE_URL is set. */
export function createStudioAdapter(config: OrchestratorConfig): ServiceAdapter {
  return {
    id: "studio",
    labelAr: "الاستوديو",
    async submit(input) {
      const base = parseBaseUrl(config.studioBaseUrl);
      if (base.kind === "invalid") return failedOutput(MISCONFIGURED, "misconfigured");
      if (base.kind === "unset") return stub(input);
      return postServiceJob({
        config,
        baseUrl: base.url,
        service: "studio",
        payload: {
          source: "experto-intent-hub",
          locale: "ar",
          hubJobId: input.hubJobId,
          output: input.input.output,
          freeText: input.input.freeText,
          description: input.input.description,
          kind: classifyStudioKind(input.intent.text),
          identity: {
            mode: input.identity.mode,
            authenticated: input.identity.authenticated,
            subject: input.identity.subject,
          },
        },
        messages: HTTP_MESSAGES,
      });
    },
    pull(serviceJobId) {
      const base = parseBaseUrl(config.studioBaseUrl);
      if (base.kind !== "ok") return Promise.resolve(null);
      return pullServiceJob({
        config,
        baseUrl: base.url,
        service: "studio",
        serviceJobId,
        messages: HTTP_MESSAGES,
      });
    },
  };
}
