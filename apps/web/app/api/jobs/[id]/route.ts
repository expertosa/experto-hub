import { orchestrator } from "@/lib/orchestrator";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const job = await orchestrator.getJob(id);
  if (!job) {
    return Response.json(
      { ok: false, error: { code: "not_found", messageAr: "ما لقينا هذا الطلب." } },
      { status: 404 },
    );
  }
  return Response.json({ ok: true, job });
}
