import { orchestrator } from "@/lib/orchestrator";
import type { ErrorCode } from "@experto/orchestrator";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function statusFor(code: ErrorCode): number {
  switch (code) {
    case "invalid_input":
    case "unroutable":
      return 400;
    case "identity_failed":
      return 401;
    case "misconfigured":
    case "service_unavailable":
      return 502;
    default:
      return 500;
  }
}

export async function POST(request: Request) {
  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const result = await orchestrator.submitIntent(body, {
    cookieHeader: request.headers.get("cookie"),
  });
  if (!result.ok) {
    return Response.json(result, { status: statusFor(result.error.code) });
  }
  return Response.json(result);
}
