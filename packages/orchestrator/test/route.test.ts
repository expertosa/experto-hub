import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { configFromEnv, createOrchestrator, interpretIntent, routeIntent, SERVICE_CATALOG, type IntentInput, type OrchestratorConfig } from "../src/index";

function input(partial: Partial<IntentInput> & Pick<IntentInput, "freeText">): IntentInput {
  return {
    output: partial.output ?? null,
    service: partial.service ?? null,
    freeText: partial.freeText,
    description: partial.description ?? "",
  };
}

function testConfig(overrides: Partial<OrchestratorConfig> = {}): OrchestratorConfig {
  return {
    identityAudience: "experto-intent-hub",
    sessionCookieName: "experto_session",
    timeoutMs: 1000,
    fetchImpl: async () => {
      throw new Error("fetch should not be called");
    },
    ...overrides,
  };
}

describe("routeIntent", () => {
  const cases: Array<{ name: string; value: IntentInput; service: "studio" | "marketer" | null }> = [
    { name: "video output alone routes to Studio", value: input({ output: "video", freeText: "" }), service: "studio" },
    { name: "video ad routes to Studio", value: input({ freeText: "فيديو إعلان للمنتج" }), service: "studio" },
    { name: "campaign routes to Marketer", value: input({ freeText: "حملة تسويق لافتتاح الفرع" }), service: "marketer" },
    { name: "a property sentence with no video or campaign is not routed", value: input({ output: "website", freeText: "وساطة شقة في جدة" }), service: null },
    { name: "generic website is not a fake builder job", value: input({ output: "website", freeText: "أبي موقع" }), service: null },
  ];

  for (const testCase of cases) {
    it(testCase.name, () => {
      const decision = routeIntent(interpretIntent(testCase.value));
      assert.equal(decision.service, testCase.service);
    });
  }

  it("returns an Arabic reason the screen can show", () => {
    const decision = routeIntent(interpretIntent(input({ output: "video", freeText: "" })));
    assert.match(decision.reasonAr, /استوديو فيديو/);
  });
});

describe("submitIntent routing outcomes", () => {
  it("rejects an empty request before any service call", async () => {
    let called = false;
    const orchestrator = createOrchestrator(
      testConfig({
        fetchImpl: async () => {
          called = true;
          throw new Error("no");
        },
      }),
    );
    const result = await orchestrator.submitIntent({ output: null, freeText: "  ", description: "" }, { cookieHeader: null });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.code, "invalid_input");
    assert.equal(called, false);
  });

  it("does not create a job when nothing routes", async () => {
    let called = false;
    const orchestrator = createOrchestrator(
      testConfig({
        studioBaseUrl: "https://studio.example",
        fetchImpl: async () => {
          called = true;
          throw new Error("no");
        },
      }),
    );
    const result = await orchestrator.submitIntent(
      { output: "website", freeText: "أبي موقع", description: "" },
      { cookieHeader: null },
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, "unroutable");
      assert.match(result.error.messageAr, /استوديو فيديو/);
      assert.equal(result.job, undefined);
    }
    assert.equal(called, false);
  });

  it("keeps a local Studio stub honest", async () => {
    const orchestrator = createOrchestrator(testConfig());
    const result = await orchestrator.submitIntent(
      { output: "video", freeText: "عرض المنتج", description: "١٥ ثانية" },
      { cookieHeader: null },
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.job.service, "studio");
      assert.equal(result.job.serviceLabelAr, "استوديو فيديو");
      assert.equal(result.job.opportunityId, "18d6d182-fb15-457c-97ba-5f1ca0be9271");
      assert.equal(
        result.job.opportunityUrl,
        "https://experto.sa/ar/admin/opportunities/18d6d182-fb15-457c-97ba-5f1ca0be9271",
      );
      assert.equal(result.job.status, "stub");
      assert.notEqual(result.job.status, "ready");
      assert.equal(result.job.remote, false);
      assert.match(result.job.serviceJobId ?? "", /^studio_/);
      assert.match(result.job.previewUrl ?? "", /^\/preview\/hub_/);
      assert.match(result.job.messageAr, /تجريب/);
      const stored = await orchestrator.getJob(result.job.id);
      assert.equal(stored?.status, "stub");
    }
  });

  it("does not call the network for Studio or Marketer stubs", async () => {
    let called = false;
    const orchestrator = createOrchestrator(
      testConfig({
        fetchImpl: async () => {
          called = true;
          throw new Error("no");
        },
      }),
    );
    const video = await orchestrator.submitIntent({ output: "video", freeText: "", description: "" }, { cookieHeader: null });
    const campaign = await orchestrator.submitIntent(
      { output: null, freeText: "حملة تسويق", description: "" },
      { cookieHeader: null },
    );
    assert.equal(video.ok && video.job.service, "studio");
    assert.equal(video.ok && video.job.status, "stub");
    assert.equal(campaign.ok && campaign.job.service, "marketer");
    assert.equal(campaign.ok && campaign.job.status, "stub");
    assert.equal(called, false);
  });

  it("stops when Experto identity is configured and the session cookie is missing", async () => {
    let called = false;
    const orchestrator = createOrchestrator(
      testConfig({
        identityUrl: "https://identity.example/v1",
        studioBaseUrl: "https://studio.example",
        fetchImpl: async () => {
          called = true;
          throw new Error("no");
        },
      }),
    );
    const result = await orchestrator.submitIntent(
      { output: "video", freeText: "فيديو تعريفي", description: "" },
      { cookieHeader: null },
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, "identity_failed");
      assert.match(result.error.messageAr, /إكسبرتو/);
    }
    assert.equal(called, false);
  });

  it("keeps an explicit Experto pin on the assistant stub", async () => {
    let called = false;
    const orchestrator = createOrchestrator(
      testConfig({
        fetchImpl: async () => {
          called = true;
          throw new Error("no");
        },
      }),
    );
    const result = await orchestrator.submitIntent(
      { output: null, service: "experto", freeText: "وش تقدر تسوي", description: "" },
      { cookieHeader: null },
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.job.service, "experto");
      assert.equal(result.job.status, "stub");
      assert.equal(result.job.opportunityId, "6d17a9b9-7780-4f8e-9e63-dddb0e70680d");
      assert.equal(result.job.publicUrl, "https://experto.sa");
      assert.equal(result.job.testflightUrl, "https://testflight.apple.com/join/RzTNGVph");
      assert.match(result.job.messageAr, /تجريب/);
    }
    assert.equal(called, false);
  });

  it("lets a chosen project chip override a vague sentence", async () => {
    const orchestrator = createOrchestrator(testConfig());
    const result = await orchestrator.submitIntent(
      { output: "website", service: "studio", freeText: "أبي موقع", description: "" },
      { cookieHeader: null },
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.job.service, "studio");
      assert.equal(result.job.status, "stub");
      assert.match(result.job.reasonAr, /استوديو فيديو/);
    }
  });
});

describe("service catalog", () => {
  it("lists the Experto projects in launch order with explorer links", () => {
    assert.deepEqual(
      SERVICE_CATALOG.map((service) => service.id),
      ["experto", "studio", "marketer"],
    );
    assert.equal(SERVICE_CATALOG[1]?.labelAr, "استوديو فيديو");
    assert.equal(SERVICE_CATALOG[1]?.publicUrl, "https://video.opps.dev");
    assert.equal(
      SERVICE_CATALOG[1]?.opportunityUrl,
      "https://experto.sa/ar/admin/opportunities/18d6d182-fb15-457c-97ba-5f1ca0be9271",
    );
    assert.equal(SERVICE_CATALOG[2]?.labelAr, "ماركتير");
    assert.equal(
      SERVICE_CATALOG[2]?.opportunityUrl,
      "https://experto.sa/ar/admin/opportunities/e8f44802-d2f5-4eb0-bb79-dea19eb54c85",
    );
  });
});

describe("configFromEnv", () => {
  it("reads Experto and service env names and ignores blanks", () => {
    const config = configFromEnv({
      EXPERTO_IDENTITY_URL: "https://identity.example",
      EXPERTO_IDENTITY_AUDIENCE: "experto-intent-hub",
      EXPERTO_SESSION_COOKIE_NAME: "experto_session",
      EXPERTO_SERVICE_TOKEN: "token-placeholder",
      STUDIO_API_BASE_URL: "https://studio.example",
      MARKETER_API_BASE_URL: "",
      EXPERTO_API_TIMEOUT_MS: "1500",
    });
    assert.equal(config.identityUrl, "https://identity.example");
    assert.equal(config.identityAudience, "experto-intent-hub");
    assert.equal(config.sessionCookieName, "experto_session");
    assert.equal(config.serviceToken, "token-placeholder");
    assert.equal(config.studioBaseUrl, "https://studio.example");
    assert.equal(config.marketerBaseUrl, undefined);
    assert.equal(config.timeoutMs, 1500);
  });
});
