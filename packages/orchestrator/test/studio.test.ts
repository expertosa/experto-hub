import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createOrchestrator, type OrchestratorConfig } from "../src/index";

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
    studioBaseUrl: "https://studio.example",
    fetchImpl,
    ...overrides,
  };
}

const VIDEO = { output: "video" as const, freeText: "إعلان للمنتج", description: "" };

describe("Studio HTTP", () => {
  it("posts a typed job and does not leak the Experto subject to the hub response", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input);
      calls.push({ url, init });
      if (url.endsWith("/session")) return jsonResponse({ subject: "user-subject-42" });
      return jsonResponse({
        serviceJobId: "studio_remote_1",
        status: "queued",
        previewUrl: null,
        messageAr: "استلم الاستوديو الطلب",
      });
    };
    const orchestrator = createOrchestrator(
      config(fetchImpl, {
        identityUrl: "https://identity.example/v1",
        serviceToken: "token-placeholder",
      }),
    );
    const result = await orchestrator.submitIntent(VIDEO, {
      cookieHeader: "experto_session=session-placeholder; other=1",
    });

    assert.equal(calls.length, 2);
    assert.equal(calls[0]?.url, "https://identity.example/v1/session");
    assert.equal(calls[1]?.url, "https://studio.example/v0/intent-jobs");

    const identityHeaders = new Headers(calls[0]?.init?.headers);
    assert.match(identityHeaders.get("cookie") ?? "", /experto_session=session-placeholder/);

    const studioHeaders = new Headers(calls[1]?.init?.headers);
    assert.equal(studioHeaders.get("authorization"), "Bearer token-placeholder");
    assert.equal(studioHeaders.get("cookie"), null);
    const body = JSON.parse(String(calls[1]?.init?.body)) as {
      kind: string;
      identity: { subject: string };
      source: string;
    };
    assert.equal(body.source, "experto-intent-hub");
    assert.equal(body.kind, "video_ad");
    assert.equal(body.identity.subject, "user-subject-42");

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.job.service, "studio");
      assert.equal(result.job.status, "queued");
      assert.equal(result.job.remote, true);
      assert.equal(result.job.serviceJobId, "studio_remote_1");
      assert.equal(result.job.previewUrl, null);
      assert.equal(
        result.job.opportunityUrl,
        "https://experto.sa/ar/admin/opportunities/18d6d182-fb15-457c-97ba-5f1ca0be9271",
      );
      assert.equal(JSON.stringify(result.job).includes("user-subject-42"), false);
      assert.equal(JSON.stringify(result.job).includes("token-placeholder"), false);
    }
  });

  it("refreshes a queued Studio job from the service status call", async () => {
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input);
      if (init?.method === "GET" && url.includes("/v0/intent-jobs/")) {
        return jsonResponse({
          serviceJobId: "studio_remote_9",
          status: "ready",
          previewUrl: "https://preview.example/unit",
          messageAr: "المعاينة جاهزة",
        });
      }
      return jsonResponse({
        serviceJobId: "studio_remote_9",
        status: "queued",
        previewUrl: null,
        messageAr: "استلم الاستوديو الطلب",
      });
    };
    const orchestrator = createOrchestrator(config(fetchImpl));
    const created = await orchestrator.submitIntent(
      { output: "video", freeText: "", description: "" },
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
        serviceJobId: "studio_remote_2",
        status: "ready",
        previewUrl: "javascript:alert(1)",
        messageAr: "جاهز",
      });
    const orchestrator = createOrchestrator(config(fetchImpl));
    const result = await orchestrator.submitIntent({ output: "video", freeText: "مقطع", description: "" }, { cookieHeader: null });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.job.status, "ready");
      assert.equal(result.job.previewUrl, null);
    }
  });

  it("treats a Studio HTTP error as failure", async () => {
    const orchestrator = createOrchestrator(config(async () => jsonResponse({ error: "down" }, 502)));
    const result = await orchestrator.submitIntent({ output: "video", freeText: "", description: "" }, { cookieHeader: null });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, "service_unavailable");
      assert.match(result.error.messageAr, /استوديو فيديو/);
      assert.match(result.error.messageAr, /502/);
      assert.equal(result.job?.status, "failed");
      assert.equal(result.job?.previewUrl, null);
      assert.notEqual(result.job?.status, "ready");
    }
  });

  it("does not treat a malformed 200 as success", async () => {
    const orchestrator = createOrchestrator(config(async () => jsonResponse({ ok: true })));
    const result = await orchestrator.submitIntent({ output: "video", freeText: "ريل", description: "" }, { cookieHeader: null });
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
    const result = await orchestrator.submitIntent({ output: "video", freeText: "", description: "" }, { cookieHeader: null });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, "service_unavailable");
      assert.match(result.error.messageAr, /تعذّر الاتصال باستوديو فيديو/);
      assert.equal(result.job?.previewUrl, null);
    }
  });

  it("refuses an invalid Studio base URL instead of stubbing success", async () => {
    const orchestrator = createOrchestrator(config(async () => jsonResponse({}), { studioBaseUrl: "ftp://studio.example" }));
    const result = await orchestrator.submitIntent({ output: "video", freeText: "", description: "" }, { cookieHeader: null });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, "misconfigured");
      assert.match(result.error.messageAr, /STUDIO_API_BASE_URL/);
      assert.equal(result.job?.status, "failed");
    }
  });
});
