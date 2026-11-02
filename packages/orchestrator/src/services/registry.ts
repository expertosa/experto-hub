import type { OrchestratorConfig, ServiceId } from "../types";
import { createExpertoAdapter } from "./experto";
import { createMarketerAdapter } from "./marketer";
import { createStudioAdapter } from "./studio";
import type { ServiceAdapter } from "./types";

/** Launch order: Experto entry, then Studio (first HTTP backend), then Marketeer. */
export function createServiceRegistry(config: OrchestratorConfig): Record<ServiceId, ServiceAdapter> {
  return {
    experto: createExpertoAdapter(config),
    studio: createStudioAdapter(config),
    marketer: createMarketerAdapter(config),
  };
}
