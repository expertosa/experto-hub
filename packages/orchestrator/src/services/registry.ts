import type { OrchestratorConfig, ServiceId } from "../types";
import { createAbeetAdapter } from "./abeet";
import { createMarketerAdapter } from "./marketer";
import { createStudioAdapter } from "./studio";
import type { ServiceAdapter } from "./types";

/** Launch order: Experto entry uses this map; Abeet is the first backend, then Studio, then Marketer. */
export function createServiceRegistry(config: OrchestratorConfig): Record<ServiceId, ServiceAdapter> {
  return {
    abeet: createAbeetAdapter(config),
    studio: createStudioAdapter(config),
    marketer: createMarketerAdapter(config),
  };
}
