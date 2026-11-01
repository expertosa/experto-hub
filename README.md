# Experto Intent Hub

Arabic entry for Experto. One screen, «قل وش تبي», plus a server-side linking layer that routes an intent to an existing service. This is not a site builder and not a Lovable or Etlaq competitor.

The repo name stays `experto-hub`. The product name is Experto Intent Hub.

v0 is a local MVP. Do not merge it to production, publish it, or deploy it until the owner says so.

## What v0 does

1. The screen follows the Experto app home (Home2VC): white RTL page, spiral mark, «كيف يمكنني مساعدتك اليوم؟», a capsule field, chips under it, and a visual tab bar. Replies, when they exist, use the in-thread bubble colors inside that home.
2. The person picks an output (موقع، فيديو، تطبيق) or one of the real projects, and writes a request plus an optional short description.
3. The browser posts that to the Next.js server. No service key is ever sent to the browser.
4. The orchestrator reads the intent, chooses one service, and returns a hub job id, the service job id, a status, and either a preview or an Arabic error inside the thread.
5. Failures stay failures. A local stub is labeled `stub`. An HTTP error, a bad payload, or an unreachable service is `failed` with a retry. Nothing is marked ready unless that service said so.

## Architecture

```text
apps/web                         Arabic RTL chat (Next.js)
  app/api/intents                POST intent
  app/api/jobs/[id]              GET status (polls upstream only when queued)
packages/orchestrator            server-only routing and service calls
  services/catalog.ts            project metadata and Opportunity Explorer URLs
  interpret + route              one service per request
  identity                       Experto session placeholder
  services/experto.ts            assistant entry stub
  services/studio.ts             first HTTP backend (video)
  services/marketer.ts           campaigns, after Studio
```

Launch order: Experto assistant, then Studio video, then Marketeer.

Owner removed Abeet from Intent Hub on 2026-11-02.

### Projects

Each service stores `id`, `labelAr`, `opportunityId`, `opportunityUrl`, and an optional `publicUrl`. The home chips, from the right, are حسابات (Experto assistant), فيديو (Studio), تسويق (Marketeer), and المزيد (موقع and تطبيق only). Opening a chip shows that service's Opportunity Explorer URL.

| Service | Arabic | Opportunity Explorer | Public |
| --- | --- | --- | --- |
| experto | إكسبرتو | https://experto.sa/ar/admin/opportunities/6d17a9b9-7780-4f8e-9e63-dddb0e70680d | https://experto.sa (TestFlight https://testflight.apple.com/join/RzTNGVph) |
| studio | استوديو فيديو | https://experto.sa/ar/admin/opportunities/18d6d182-fb15-457c-97ba-5f1ca0be9271 | https://video.opps.dev |
| marketer | ماركتير | https://experto.sa/ar/admin/opportunities/e8f44802-d2f5-4eb0-bb79-dea19eb54c85 | https://marketeer.opps.dev |

Repos, for operators: [video-order-site](https://github.com/expertosa/video-order-site), [marketeer](https://github.com/expertosa/marketeer).

A related pipeline note, not a fifth product: https://experto.sa/ar/admin/opportunities/2fb88efa-cc4a-4d98-a866-56034ad73de1

Arabic RTL design references live with MCP designs: https://experto.sa/ar/admin/opportunities/835a436a-2f3f-4fa5-b520-db95cbbb2c92

### Routing

An explicit service chip wins. Otherwise:

| Signal | Service | Domain |
| --- | --- | --- |
| Video, reel, or output «فيديو» | استوديو فيديو | فيديو وإعلانات فيديو |
| Campaign or marketing, and not a video | ماركتير | تسويق وحملات |

A generic «أبي موقع» with no chosen project is rejected in Arabic. v0 does not invent a website generator.

### Service contract

When `STUDIO_API_BASE_URL` or `MARKETER_API_BASE_URL` is set, the orchestrator calls:

```text
POST {BASE}/v0/intent-jobs
GET  {BASE}/v0/intent-jobs/{serviceJobId}
```

The JSON body includes `source: "experto-intent-hub"`, the Arabic text, an output kind, a service-specific `kind`, and the Experto identity claim (`mode`, `authenticated`, `subject`). The server adds `Authorization: Bearer ${EXPERTO_SERVICE_TOKEN}` only when that variable is set. The browser session cookie is sent to Experto identity, not to Studio or Marketeer.

A successful service response:

```json
{
  "serviceJobId": "studio_123",
  "status": "queued",
  "previewUrl": null,
  "messageAr": "استلم الاستوديو الطلب"
}
```

`status` is `stub`, `queued`, `ready`, or `failed`. Any other shape is a failure. `previewUrl` must be `http`, `https`, or a same-app path.

Studio `kind` is `video` or `video_ad`. Marketer `kind` is `campaign`.

If the base URL is empty, the adapter returns an in-memory stub job and a preview card at `/preview/{hubJobId}`. The card says the link is a stub. If the base URL is set but invalid, the request fails and is not silently stubbed.

Jobs live in process memory for v0. Run one server process. Restarting clears them.

### Auth

v0 does not add a new login product. Identity uses these names only:

- `EXPERTO_IDENTITY_URL`
- `EXPERTO_IDENTITY_AUDIENCE` (default `experto-intent-hub`)
- `EXPERTO_SESSION_COOKIE_NAME` (default `experto_session`)
- `EXPERTO_SERVICE_TOKEN`
- `EXPERTO_API_TIMEOUT_MS` (default 8000)

Leave `EXPERTO_IDENTITY_URL` empty to try the screen locally. The identity mode is then `placeholder` and no session is invented. When the URL is set, a missing or rejected Experto session stops the request with an Arabic error.

## Run locally

Requires Node.js 22+.

```bash
npm install
cp .env.example apps/web/.env.local
npm test
npm run typecheck
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Try:

- فيديو with no extra text → استوديو فيديو، حالة تجريبي، with the explorer link in the thread
- «حملة تسويق لافتتاح» → ماركتير
- «أبي موقع» with no project chip → Arabic error and retry inside the chat

`npm run build` builds the web app after the orchestrator typecheck.

## Out of scope

Billing, a multi-tenant IDE, generation quality, new product brands, Experto mobile home chips, and a website taxonomy.

## Tests

Orchestrator tests live in `packages/orchestrator/test`. They cover routing, the Studio HTTP contract, honest stubs, and failed calls. They do not need network access or real secrets.
