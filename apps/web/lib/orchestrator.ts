import "server-only";
import { configFromEnv, createOrchestrator, type Orchestrator } from "@experto/orchestrator";

const globalStore = globalThis as unknown as { __expertoOrchestrator?: Orchestrator };

export const orchestrator = globalStore.__expertoOrchestrator ?? createOrchestrator(configFromEnv());

globalStore.__expertoOrchestrator = orchestrator;
