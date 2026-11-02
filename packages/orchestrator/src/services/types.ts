import type {
  ErrorCode,
  ExpertoIdentity,
  IntentInput,
  InterpretedIntent,
  JobStatus,
  ServiceId,
} from "../types";

export interface ServiceSubmitInput {
  intent: InterpretedIntent;
  input: IntentInput;
  identity: ExpertoIdentity;
  hubJobId: string;
}

export interface ServiceSubmitOutput {
  serviceJobId: string | null;
  status: JobStatus;
  remote: boolean;
  previewUrl: string | null;
  messageAr: string;
  errorCode?: ErrorCode;
}

export interface ServiceAdapter {
  id: ServiceId;
  labelAr: string;
  submit(input: ServiceSubmitInput): Promise<ServiceSubmitOutput>;
  /** Null means keep the stored status (stub, or the upstream poll failed open). */
  pull(serviceJobId: string): Promise<ServiceSubmitOutput | null>;
}

export function failedOutput(messageAr: string, errorCode: ErrorCode): ServiceSubmitOutput {
  return {
    serviceJobId: null,
    status: "failed",
    remote: false,
    previewUrl: null,
    messageAr,
    errorCode,
  };
}
