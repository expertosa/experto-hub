"use client";

import { useEffect, useRef, useState } from "react";
import type { OutputKind, PublicJob, SubmitResult } from "@experto/orchestrator";
import { JobCard } from "./JobCard";

const OUTPUTS: Array<{ id: OutputKind; label: string }> = [
  { id: "website", label: "موقع" },
  { id: "video", label: "فيديو" },
  { id: "app", label: "تطبيق" },
];

type Phase =
  | { type: "idle" }
  | { type: "submitting" }
  | { type: "job"; job: PublicJob }
  | { type: "error"; messageAr: string; job: PublicJob | null };

const NETWORK_ERROR = "ما قدرنا نصل للسيرفر. جرّب مرة ثانية.";

async function postIntent(body: { output: OutputKind | null; freeText: string; description: string }): Promise<SubmitResult> {
  let response: Response;
  try {
    response = await fetch("/api/intents", {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, error: { code: "service_unavailable", messageAr: NETWORK_ERROR } };
  }
  const data: unknown = await response.json().catch(() => null);
  if (!isSubmitResult(data)) {
    return { ok: false, error: { code: "service_unavailable", messageAr: "صار خلل في الاستجابة. جرّب مرة ثانية." } };
  }
  return data;
}

function isSubmitResult(value: unknown): value is SubmitResult {
  if (!value || typeof value !== "object") return false;
  const record = value as { ok?: unknown; error?: { messageAr?: unknown }; job?: unknown };
  if (record.ok === true) return true;
  return record.ok === false && typeof record.error?.messageAr === "string";
}

function isJob(value: unknown): value is PublicJob {
  if (!value || typeof value !== "object") return false;
  const job = value as { id?: unknown; status?: unknown; messageAr?: unknown };
  return typeof job.id === "string" && typeof job.status === "string" && typeof job.messageAr === "string";
}

export function IntentScreen() {
  const [output, setOutput] = useState<OutputKind | null>(null);
  const [freeText, setFreeText] = useState("");
  const [description, setDescription] = useState("");
  const [phase, setPhase] = useState<Phase>({ type: "idle" });
  const requestSeq = useRef(0);

  useEffect(() => {
    return () => {
      requestSeq.current += 1;
    };
  }, []);

  const submitting = phase.type === "submitting";

  async function submit() {
    const token = requestSeq.current + 1;
    requestSeq.current = token;
    setPhase({ type: "submitting" });
    const result = await postIntent({ output, freeText, description });
    if (token !== requestSeq.current) return;
    if (!result.ok) {
      setPhase({ type: "error", messageAr: result.error.messageAr, job: result.job ?? null });
      return;
    }
    setPhase({ type: "job", job: result.job });
    if (result.job.status === "queued") void poll(result.job.id, token);
  }

  async function poll(id: string, token: number) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      if (token !== requestSeq.current) return;
      let next: PublicJob | null = null;
      try {
        const response = await fetch(`/api/jobs/${id}`, { headers: { accept: "application/json" } });
        const data: unknown = await response.json();
        if (data && typeof data === "object" && "job" in data && isJob(data.job)) next = data.job;
      } catch {
        return;
      }
      if (!next || token !== requestSeq.current) return;
      if (next.status === "failed") {
        setPhase({ type: "error", messageAr: next.messageAr, job: next });
        return;
      }
      setPhase({ type: "job", job: next });
      if (next.status !== "queued") return;
    }
  }

  return (
    <div className="layout">
      <section>
        <p className="eyebrow">مدخل واحد</p>
        <h1>قل وش تبي</h1>
        <p className="lede">اختر نوع المخرج، أو اكتب طلبك. نقرأ القصد على السيرفر ونوصّله للخدمة المناسبة.</p>
        <ul className="services">
          <li>أبيت · عقارات</li>
          <li>الاستوديو · فيديو</li>
          <li>المسوّق · حملات</li>
        </ul>
        <form
          className="panel"
          onSubmit={(event) => {
            event.preventDefault();
            if (!submitting) void submit();
          }}
        >
          <fieldset>
            <legend>
              نوع المخرج <span className="hint">اختياري إذا كتبت الطلب بوضوح</span>
            </legend>
            <div className="outputs">
              {OUTPUTS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="output"
                  aria-pressed={output === item.id}
                  onClick={() => setOutput((current) => (current === item.id ? null : item.id))}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </fieldset>
          <label>
            <span>قل وش تبي</span>
            <textarea
              name="freeText"
              rows={3}
              maxLength={500}
              value={freeText}
              placeholder="مثال: أبي فيديو إعلان لشقة في الرياض"
              onChange={(event) => setFreeText(event.target.value)}
            />
          </label>
          <label>
            <span>وصف قصير</span>
            <textarea
              name="description"
              rows={3}
              maxLength={2000}
              value={description}
              placeholder="تفاصيل تساعدنا نوجّه الطلب"
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
          <button className="primary" type="submit" disabled={submitting}>
            {submitting ? "جارٍ الإرسال…" : "أرسل الطلب"}
          </button>
        </form>
      </section>
      <section className="panel result" aria-live="polite">
        <h2>النتيجة</h2>
        {phase.type === "idle" || phase.type === "submitting" ? (
          <p className="quiet">
            {phase.type === "submitting"
              ? "نوجّه الطلب الآن."
              : "بعد الإرسال تظهر هنا الخدمة ورقم الطلب والحالة. إذا ما قدرنا نوجّه الطلب، نعرض الخطأ وما نعتبره نجاح."}
          </p>
        ) : null}
        {phase.type === "error" ? (
          <div className="alert" role="alert">
            <p>{phase.messageAr}</p>
            <button className="retry" type="button" onClick={() => void submit()} disabled={submitting}>
              أعد المحاولة
            </button>
          </div>
        ) : null}
        {phase.type === "error" && phase.job ? <JobCard job={phase.job} /> : null}
        {phase.type === "job" ? <JobCard job={phase.job} /> : null}
      </section>
    </div>
  );
}
