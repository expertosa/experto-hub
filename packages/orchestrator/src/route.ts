import type { InterpretedIntent, RouteDecision } from "./types";

/**
 * One service per request.
 * Video deliverables go to Studio, campaigns to Marketer, property work to Abeet.
 * A generic website or app with no domain signal is not routed — v0 does not invent a builder.
 */
export function routeIntent(intent: InterpretedIntent): RouteDecision {
  if (intent.signals.video) {
    return {
      service: "studio",
      reasonAr: "توجيه: الطلب فيديو، والاستوديو هو الخدمة.",
    };
  }
  if (intent.signals.marketing) {
    return {
      service: "marketer",
      reasonAr: "توجيه: الطلب حملة تسويق، والمسوّق هو الخدمة.",
    };
  }
  if (intent.signals.realEstate) {
    return {
      service: "abeet",
      reasonAr: "توجيه: الطلب عقاري، وأبيت هو الخدمة.",
    };
  }
  return {
    service: null,
    reasonAr: "ما قدرنا نحدد الخدمة. وضّح إذا الطلب عن عقار، أو فيديو، أو حملة تسويق.",
  };
}
