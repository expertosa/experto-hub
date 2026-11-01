import type { ServiceId } from "../types";

/** Real Experto projects from today's Opportunity Explorer map. Order is the launch order. */
export interface ServiceMeta {
  id: ServiceId;
  labelAr: string;
  detailAr: string;
  opportunityId: string;
  opportunityUrl: string;
  publicUrl?: string;
  testflightUrl?: string;
}

export const SERVICE_CATALOG: readonly ServiceMeta[] = [
  {
    id: "experto",
    labelAr: "إكسبرتو",
    detailAr: "مساعد إكسبرتو. يقرأ الطلب ويوصّله للخدمة المناسبة.",
    opportunityId: "6d17a9b9-7780-4f8e-9e63-dddb0e70680d",
    opportunityUrl: "https://experto.sa/ar/admin/opportunities/6d17a9b9-7780-4f8e-9e63-dddb0e70680d",
    publicUrl: "https://experto.sa",
    testflightUrl: "https://testflight.apple.com/join/RzTNGVph",
  },
  {
    id: "abeet",
    labelAr: "أبيت",
    detailAr: "عقارات، إدارة أملاك، ووساطة.",
    opportunityId: "2a3ff790-3aac-402e-9439-c3b1ade2d37a",
    opportunityUrl: "https://experto.sa/ar/admin/opportunities/2a3ff790-3aac-402e-9439-c3b1ade2d37a",
    publicUrl: "https://abeet.ai",
  },
  {
    id: "studio",
    labelAr: "استوديو فيديو",
    detailAr: "فيديو وإعلانات فيديو.",
    opportunityId: "18d6d182-fb15-457c-97ba-5f1ca0be9271",
    opportunityUrl: "https://experto.sa/ar/admin/opportunities/18d6d182-fb15-457c-97ba-5f1ca0be9271",
    publicUrl: "https://video.opps.dev",
  },
  {
    id: "marketer",
    labelAr: "ماركتير",
    detailAr: "تسويق وحملات.",
    opportunityId: "e8f44802-d2f5-4eb0-bb79-dea19eb54c85",
    opportunityUrl: "https://experto.sa/ar/admin/opportunities/e8f44802-d2f5-4eb0-bb79-dea19eb54c85",
    publicUrl: "https://marketeer.opps.dev",
  },
];

const BY_ID = Object.fromEntries(SERVICE_CATALOG.map((service) => [service.id, service])) as Record<ServiceId, ServiceMeta>;

export function serviceById(id: ServiceId): ServiceMeta {
  return BY_ID[id];
}
