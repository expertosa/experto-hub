import type { OrchestratorConfig, ServiceId } from "../types";
import { createAbeetAdapter } from "./abeet";
import { createExpertoAdapter } from "./experto";
import { createMarketerAdapter } from "./marketer";
import { createStudioAdapter } from "./studio";
import type { ServiceAdapter } from "./types";

/** Launch order: Experto entry, then Abeet (first HTTP backend), then Studio, then Marketeer. */
export function createServiceRegistry(config: OrchestratorConfig): Record<ServiceId, ServiceAdapter> {
  return {
    experto: createExpertoAdapter(config),
    abeet: createAbeetAdapter(config),
    studio: createStudioAdapter(config),
    marketer: createMarketerAdapter(config),
  };
}
