import { serviceById } from "./services/catalog";
import type { InterpretedIntent, RouteDecision, ServiceId } from "./types";

/**
 * One service per request.
 * An explicit chip wins. Otherwise: video → Studio, campaign → Marketeer, property → Abeet.
 * A generic website or app with no domain signal is not routed — v0 does not invent a builder.
 */
export function routeIntent(intent: InterpretedIntent, pinned: ServiceId | null = null): RouteDecision {
  if (pinned) {
    const label = serviceById(pinned).labelAr;
    return {
      service: pinned,
      reasonAr: pinned === "experto" ? "توجيه: الطلب عند مساعد إكسبرتو." : `توجيه: اخترت ${label}.`,
    };
  }
  if (intent.signals.video) {
    return {
      service: "studio",
      reasonAr: "توجيه: الطلب فيديو، واستوديو فيديو هو الخدمة.",
    };
  }
  if (intent.signals.marketing) {
    return {
      service: "marketer",
      reasonAr: "توجيه: الطلب حملة تسويق، وماركتير هو الخدمة.",
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
    reasonAr: "ما قدرنا نحدد الخدمة. وضّح إذا الطلب عن عقار (أبيت)، أو فيديو (استوديو فيديو)، أو حملة (ماركتير).",
  };
}
