# Experto Intent Hub

Arabic entry for Experto. One screen, «قل وش تبي», plus a server-side linking layer that routes an intent to an existing service. This is not a site builder and not a Lovable or Etlaq competitor.

The repo name stays `experto-hub`. The product name is Experto Intent Hub.

v0 is a local MVP. Do not merge it to production, publish it, or deploy it until the owner says so.

## What v0 does

1. The person picks an output (موقع، فيديو، تطبيق) or writes a free-text request, plus a short description.
2. The browser posts that to the Next.js server. No service key is ever sent to the browser.
3. The orchestrator reads the intent, chooses one service, and returns a hub job id, the service job id, a status, and either a preview or an Arabic error.
4. Failures stay failures. A local stub is labeled `stub`. An HTTP error, a bad payload, or an unreachable service is `failed` with a retry. Nothing is marked ready unless that service said so.

## Architecture

```text
apps/web                         Arabic RTL UI (Next.js)
  app/api/intents                POST intent
  app/api/jobs/[id]              GET status (polls upstream only when queued)
packages/orchestrator            server-only routing and service calls
  interpret + route              one service per request
  identity                       Experto session placeholder
  services/abeet                 first wired backend
  services/studio                video, after Abeet
  services/marketer              campaigns, after Studio
```

Launch order in the code matches the product order: the Experto entry and the orchestrator skeleton, then Abeet, then Studio, then Marketer.

### Routing

| Signal | Service | Domain |
| --- | --- | --- |
| Video, reel, or output «فيديو» | Studio | فيديو وإعلانات فيديو |
| Campaign or marketing, and not a video | Marketer | تسويق وحملات |
| Property, brokerage, or property management | Abeet | عقارات / إدارة أملاك / وساطة |

A video ad for a property goes to Studio because the deliverable is a video. A marketing campaign about property goes to Marketer. A generic «أبي موقع» with no domain is rejected in Arabic. v0 does not invent a website generator.

### Service contract

When `ABEET_API_BASE_URL`, `STUDIO_API_BASE_URL`, or `MARKETER_API_BASE_URL` is set, the orchestrator calls:

```text
POST {BASE}/v0/intent-jobs
GET  {BASE}/v0/intent-jobs/{serviceJobId}
```

The JSON body includes `source: "experto-intent-hub"`, the Arabic text, an output kind, a service-specific `kind`, and the Experto identity claim (`mode`, `authenticated`, `subject`). The server adds `Authorization: Bearer ${EXPERTO_SERVICE_TOKEN}` only when that variable is set. The browser session cookie is sent to Experto identity, not to Abeet, Studio, or Marketer.

A successful service response:

```json
{
  "serviceJobId": "abeet_123",
  "status": "queued",
  "previewUrl": null,
  "messageAr": "استلم أبيت الطلب"
}
```

`status` is `stub`, `queued`, `ready`, or `failed`. Any other shape is a failure. `previewUrl` must be `http`, `https`, or a same-app path.

Abeet `kind` is `brokerage`, `property_management`, `listing`, or `general_real_estate`. Studio `kind` is `video` or `video_ad`. Marketer `kind` is `campaign`.

If the base URL is empty, the adapter returns an in-memory stub job and a preview card at `/preview/{hubJobId}`. The card says the link is a stub. If the base URL is set but invalid, the request fails and is not silently stubbed.

Jobs live in process memory for v0. Run one server process. Restarting clears them.

### Auth

v0 does not add a new login product. Identity uses these names only:

- `EXPERTO_IDENTITY_URL`
- `EXPERTO_IDENTITY_AUDIENCE` (default `experto-intent-hub`)
- `EXPERTO_SESSION_COOKIE_NAME` (default `experto_session`)
- `EXPERTO_SERVICE_TOKEN`

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

- موقع + «وساطة شقة في جدة» → أبيت، حالة تجريبي
- فيديو without extra text → الاستوديو
- «حملة تسويق لافتتاح» → المسوّق
- موقع + «أبي موقع» → Arabic error, no job

`npm run build` builds the web app after the orchestrator typecheck.

## Out of scope

Billing, a multi-tenant IDE, generation quality, new product brands, the Abeet office UI, Experto mobile home chips, and a website taxonomy.

## Tests

Orchestrator tests live in `packages/orchestrator/test`. They cover routing, the Abeet HTTP contract, honest stubs, and failed calls. They do not need network access or real secrets.
