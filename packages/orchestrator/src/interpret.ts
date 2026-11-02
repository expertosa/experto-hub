import { hasTerm } from "./text";
import type { IntentInput, InterpretedIntent } from "./types";

const VIDEO_TERMS = [
  "فيديو",
  "مقطع",
  "ريل",
  "ريلز",
  "مونتاج",
  "موشن",
  "يوتيوب",
  "سناب",
  "فيديوهات",
  "video",
  "reel",
];

const MARKETING_TERMS = [
  "تسويق",
  "حملة",
  "حملات",
  "إعلان",
  "جمهور",
  "مسوّق",
  "مسوق",
  "ترويج",
  "إعلانات",
  "campaign",
  "marketing",
];

export function combineIntentText(input: IntentInput): string {
  return [input.freeText, input.description]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");
}

export function interpretIntent(input: IntentInput): InterpretedIntent {
  const text = combineIntentText(input);
  return {
    output: input.output,
    text,
    signals: {
      video: input.output === "video" || VIDEO_TERMS.some((term) => hasTerm(text, term)),
      marketing: MARKETING_TERMS.some((term) => hasTerm(text, term)),
    },
  };
}
