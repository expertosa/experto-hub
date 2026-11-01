import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyAbeetKind, createOrchestrator, type OrchestratorConfig } from "../src/index";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function config(fetchImpl: typeof fetch, overrides: Partial<OrchestratorConfig> = {}): OrchestratorConfig {
  return {
    identityAudience: "experto-intent-hub",
    sessionCookieName: "experto_session",
    timeoutMs: 1000,
    abeetBaseUrl: "https://abeet.example",
    fetchImpl,
    ...overrides,
  };
}

describe("classifyAbeetKind", () => {
  it("distinguishes brokerage, management, and listings", () => {
    assert.equal(classifyAbeetKind("وساطة شقة في جدة"), "brokerage");
    assert.equal(classifyAbeetKind("تطبيق لإدارة الأملاك"), "property_management");
    assert.equal(classifyAbeetKind("شقة للإيجار في الخبر"), "listing");
    assert.equal(classifyAbeetKind("موقع عقاري"), "general_real_estate");
  });
});

describe("Abeet HTTP", () => {
  it("posts a typed job and does not leak the Experto subject to the hub response", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input);
      calls.push({ url, init });
      if (url.endsWith("/session")) return jsonResponse({ subject: "user-subject-42" });
      return jsonResponse({
        serviceJobId: "abeet_remote_1",
        status: "queued",
        previewUrl: null,
        messageAr: "استلم أبيت الطلب",
      });
    };
    const orchestrator = createOrchestrator(
      config(fetchImpl, {
        identityUrl: "https://identity.example/v1",
        serviceToken: "token-placeholder",
      }),
    );
    const result = await orchestrator.submitIntent(
      { output: "website", freeText: "وساطة شقة في جدة", description: "غرفة وصالة" },
      { cookieHeader: "experto_session=session-placeholder; other=1" },
    );

    assert.equal(calls.length, 2);
    assert.equal(calls[0]?.url, "https://identity.example/v1/session");
    assert.equal(calls[1]?.url, "https://abeet.example/v0/intent-jobs");

    const identityHeaders = new Headers(calls[0]?.init?.headers);
    assert.match(identityHeaders.get("cookie") ?? "", /experto_session=session-placeholder/);

    const abeetHeaders = new Headers(calls[1]?.init?.headers);
    assert.equal(abeetHeaders.get("authorization"), "Bearer token-placeholder");
    assert.equal(abeetHeaders.get("cookie"), null);
    const body = JSON.parse(String(calls[1]?.init?.body)) as {
      kind: string;
      identity: { subject: string };
      source: string;
    };
    assert.equal(body.source, "experto-intent-hub");
    assert.equal(body.kind, "brokerage");
    assert.equal(body.identity.subject, "user-subject-42");

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.job.status, "queued");
      assert.equal(result.job.remote, true);
      assert.equal(result.job.serviceJobId, "abeet_remote_1");
      assert.equal(result.job.previewUrl, null);
      assert.equal(JSON.stringify(result.job).includes("user-subject-42"), false);
      assert.equal(JSON.stringify(result.job).includes("token-placeholder"), false);
    }
  });

  it("refreshes a queued Abeet job from the service status call", async () => {
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input);
      if (init?.method === "GET" && url.includes("/v0/intent-jobs/")) {
        return jsonResponse({
          serviceJobId: "abeet_remote_9",
          status: "ready",
          previewUrl: "https://preview.example/unit",
          messageAr: "المعاينة جاهزة عند أبيت",
        });
      }
      return jsonResponse({
        serviceJobId: "abeet_remote_9",
        status: "queued",
        previewUrl: null,
        messageAr: "استلم أبيت الطلب",
      });
    };
    const orchestrator = createOrchestrator(config(fetchImpl));
    const created = await orchestrator.submitIntent(
      { output: null, freeText: "شقة للبيع", description: "" },
      { cookieHeader: null },
    );
    assert.equal(created.ok, true);
    if (!created.ok) return;
    assert.equal(created.job.status, "queued");
    const refreshed = await orchestrator.getJob(created.job.id);
    assert.equal(refreshed?.status, "ready");
    assert.equal(refreshed?.previewUrl, "https://preview.example/unit");
  });

  it("drops an unsafe preview URL instead of rendering it", async () => {
    const fetchImpl: typeof fetch = async () =>
      jsonResponse({
        serviceJobId: "abeet_remote_2",
        status: "ready",
        previewUrl: "javascript:alert(1)",
        messageAr: "جاهز",
      });
    const orchestrator = createOrchestrator(config(fetchImpl));
    const result = await orchestrator.submitIntent({ output: null, freeText: "فيلا للبيع", description: "" }, { cookieHeader: null });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.job.status, "ready");
      assert.equal(result.job.previewUrl, null);
    }
  });

  it("treats an Abeet HTTP error as failure", async () => {
    const orchestrator = createOrchestrator(config(async () => jsonResponse({ error: "down" }, 502)));
    const result = await orchestrator.submitIntent(
      { output: "app", freeText: "إدارة أملاك", description: "" },
      { cookieHeader: null },
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, "service_unavailable");
      assert.match(result.error.messageAr, /أبيت/);
      assert.match(result.error.messageAr, /502/);
      assert.equal(result.job?.status, "failed");
      assert.equal(result.job?.previewUrl, null);
      assert.notEqual(result.job?.status, "ready");
    }
  });

  it("does not treat a malformed 200 as success", async () => {
    const orchestrator = createOrchestrator(config(async () => jsonResponse({ ok: true })));
    const result = await orchestrator.submitIntent({ output: null, freeText: "عقار في الدمام", description: "" }, { cookieHeader: null });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.error.messageAr, /ما اعتبرنا الطلب ناجح/);
      assert.equal(result.job?.status, "failed");
    }
  });

  it("reports a network failure in Arabic", async () => {
    const orchestrator = createOrchestrator(
      config(async () => {
        throw new Error("connect ECONNREFUSED");
      }),
    );
    const result = await orchestrator.submitIntent({ output: null, freeText: "مكتب عقاري", description: "" }, { cookieHeader: null });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, "service_unavailable");
      assert.match(result.error.messageAr, /تعذّر الاتصال بأبيت/);
      assert.equal(result.job?.previewUrl, null);
    }
  });

  it("refuses an invalid Abeet base URL instead of stubbing success", async () => {
    const orchestrator = createOrchestrator(config(async () => jsonResponse({}), { abeetBaseUrl: "ftp://abeet.example" }));
    const result = await orchestrator.submitIntent({ output: null, freeText: "أملاك", description: "" }, { cookieHeader: null });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, "misconfigured");
      assert.match(result.error.messageAr, /ABEET_API_BASE_URL/);
      assert.equal(result.job?.status, "failed");
    }
  });
});
