import type { OrchestratorConfig } from "../types";
import { serviceById } from "./catalog";
import type { ServiceAdapter, ServiceSubmitInput, ServiceSubmitOutput } from "./types";

const STUB_MESSAGE = "وصلنا الكلام لمساعد إكسبرتو. هذي وصلة تجريبية، وما فيه تنفيذ على خدمة ثانية.";

function stub(input: ServiceSubmitInput): ServiceSubmitOutput {
  return {
    serviceJobId: `experto_${crypto.randomUUID()}`,
    status: "stub",
    remote: false,
    previewUrl: `/preview/${input.hubJobId}`,
    messageAr: STUB_MESSAGE,
  };
}

/** The entry assistant. It does not call a separate product backend in v0. */
export function createExpertoAdapter(_config: OrchestratorConfig): ServiceAdapter {
  return {
    id: "experto",
    labelAr: serviceById("experto").labelAr,
    submit(input) {
      return Promise.resolve(stub(input));
    },
    pull() {
      return Promise.resolve(null);
    },
  };
}
