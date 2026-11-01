import { OUTPUTS, type IntentInput, type OutputKind, type SubmitError } from "./types";

type ValidationResult = { ok: true; value: IntentInput } | { ok: false; error: SubmitError };

const FREE_TEXT_MAX = 500;
const DESCRIPTION_MAX = 2000;

function invalid(messageAr: string): ValidationResult {
  return { ok: false, error: { code: "invalid_input", messageAr } };
}

function parseOutput(value: unknown): OutputKind | null | "invalid" {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return "invalid";
  return OUTPUTS.includes(value as OutputKind) ? (value as OutputKind) : "invalid";
}

function parseText(value: unknown): string | null {
  if (value === undefined || value === null) return "";
  return typeof value === "string" ? value : null;
}

export function validateIntentInput(raw: unknown): ValidationResult {
  if (!raw || typeof raw !== "object") {
    return invalid("الطلب غير مفهوم. أعد الإرسال.");
  }
  const body = raw as Record<string, unknown>;
  const output = parseOutput(body.output);
  if (output === "invalid") {
    return invalid("نوع المخرج غير معروف. اختر موقع أو فيديو أو تطبيق.");
  }
  const freeText = parseText(body.freeText);
  const description = parseText(body.description);
  if (freeText === null || description === null) {
    return invalid("النص لازم يكون مكتوبًا.");
  }
  if (freeText.length > FREE_TEXT_MAX || description.length > DESCRIPTION_MAX) {
    return invalid("النص أطول من اللازم. اختصره وأعد الإرسال.");
  }
  if (!output && !freeText.trim() && !description.trim()) {
    return invalid("اكتب طلبك أو اختر نوع المخرج.");
  }
  return { ok: true, value: { output, freeText, description } };
}
