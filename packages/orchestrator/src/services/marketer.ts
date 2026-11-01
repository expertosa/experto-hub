import type { OrchestratorConfig } from "../types";
import { parseBaseUrl, postServiceJob, pullServiceJob, type ServiceHttpMessages } from "./http";
import { failedOutput, type ServiceAdapter, type ServiceSubmitInput, type ServiceSubmitOutput } from "./types";

const STUB_MESSAGE = "وصلنا الطلب إلى وصلة المسوّق التجريبية. التنفيذ الحقيقي مو متصل بعد.";
const MISCONFIGURED = "عنوان المسوّق (MARKETER_API_BASE_URL) غير صالح. ما أرسلنا الطلب.";

const HTTP_MESSAGES: ServiceHttpMessages = {
  timeout: "انتهت مهلة الاتصال بالمسوّق. جرّب مرة ثانية.",
  network: "تعذّر الاتصال بالمسوّق. جرّب مرة ثانية.",
  http: (status) => `تعذّر الوصول إلى المسوّق (HTTP ${status}). جرّب مرة ثانية.`,
  badBody: "رد المسوّق غير مفهوم. ما اعتبرنا الطلب ناجحًا.",
};

function stub(input: ServiceSubmitInput): ServiceSubmitOutput {
  return {
    serviceJobId: `marketer_${crypto.randomUUID()}`,
    status: "stub",
    remote: false,
    previewUrl: `/preview/${input.hubJobId}`,
    messageAr: STUB_MESSAGE,
  };
}

/** Marketer is last in the v0 launch order. Campaign jobs only; no extra product surface. */
export function createMarketerAdapter(config: OrchestratorConfig): ServiceAdapter {
  return {
    id: "marketer",
    labelAr: "المسوّق",
    async submit(input) {
      const base = parseBaseUrl(config.marketerBaseUrl);
      if (base.kind === "invalid") return failedOutput(MISCONFIGURED, "misconfigured");
      if (base.kind === "unset") return stub(input);
      return postServiceJob({
        config,
        baseUrl: base.url,
        service: "marketer",
        payload: {
          source: "experto-intent-hub",
          locale: "ar",
          hubJobId: input.hubJobId,
          output: input.input.output,
          freeText: input.input.freeText,
          description: input.input.description,
          kind: "campaign",
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
      const base = parseBaseUrl(config.marketerBaseUrl);
      if (base.kind !== "ok") return Promise.resolve(null);
      return pullServiceJob({
        config,
        baseUrl: base.url,
        service: "marketer",
        serviceJobId,
        messages: HTTP_MESSAGES,
      });
    },
  };
}
