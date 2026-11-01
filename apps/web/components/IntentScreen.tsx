"use client";

import { useEffect, useRef, useState } from "react";
import { SERVICE_CATALOG, type ServiceMeta } from "@experto/orchestrator/catalog";
import type { JobStatus, OutputKind, PublicJob, ServiceId, SubmitResult } from "@experto/orchestrator";
import { ExpertoMark } from "./ExpertoMark";

const STATUS_AR: Record<JobStatus, string> = {
  stub: "تجريبي",
  queued: "في الانتظار",
  ready: "جاهز للمعاينة",
  failed: "ما تم",
};

interface Payload {
  output: OutputKind | null;
  service: ServiceId | null;
  freeText: string;
  description: string;
}

type ChatMessage =
  | { id: string; role: "user"; text: string; at: string }
  | { id: string; role: "assistant"; text: string; at: string; pending?: boolean }
  | { id: string; role: "assistant"; text: string; at: string; job: PublicJob }
  | { id: string; role: "assistant"; text: string; at: string; error: true; retry: Payload }
  | { id: string; role: "assistant"; text: string; at: string; info: ServiceMeta };

const NETWORK_ERROR = "ما قدرنا نصل للسيرفر. جرّب مرة ثانية.";

function nowLabel(): string {
  return new Intl.DateTimeFormat("ar", { hour: "numeric", minute: "2-digit" }).format(new Date());
}

function userText(payload: Payload): string {
  const outputLabel = payload.output === "website" ? "موقع" : payload.output === "app" ? "تطبيق" : payload.output === "video" ? "فيديو" : null;
  const service = payload.service ? SERVICE_CATALOG.find((item) => item.id === payload.service)?.labelAr : null;
  return [service, outputLabel, payload.freeText.trim()].filter(Boolean).join("\n");
}

async function postIntent(body: Payload): Promise<SubmitResult> {
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
  const record = value as { ok?: unknown; error?: { messageAr?: unknown } };
  if (record.ok === true) return true;
  return record.ok === false && typeof record.error?.messageAr === "string";
}

function isJob(value: unknown): value is PublicJob {
  if (!value || typeof value !== "object") return false;
  const job = value as { id?: unknown; status?: unknown; opportunityUrl?: unknown };
  return typeof job.id === "string" && typeof job.status === "string" && typeof job.opportunityUrl === "string";
}

export function IntentScreen() {
  const [output, setOutput] = useState<OutputKind | null>(null);
  const [service, setService] = useState<ServiceId | null>(null);
  const [freeText, setFreeText] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const requestSeq = useRef(0);
  const threadRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    return () => {
      requestSeq.current += 1;
    };
  }, []);

  useEffect(() => {
    const thread = threadRef.current;
    if (!thread) return;
    thread.scrollTop = thread.scrollHeight;
  }, [messages, sending]);

  function reveal(meta: ServiceMeta) {
    setMessages((current) => {
      if (current.some((message) => "info" in message && message.info.id === meta.id)) return current;
      return [...current, { id: `info-${meta.id}`, role: "assistant", text: meta.detailAr, at: nowLabel(), info: meta }];
    });
  }

  function chooseService(id: ServiceId) {
    const meta = SERVICE_CATALOG.find((item) => item.id === id);
    setService((current) => (current === id ? null : id));
    if (id === "studio") setOutput((current) => (service === "studio" && current === "video" ? null : "video"));
    if (meta && service !== id) reveal(meta);
  }

  async function send(payload: Payload) {
    if (!payload.output && !payload.freeText.trim()) return;
    const text = userText(payload);
    if (!text) return;
    const token = requestSeq.current + 1;
    requestSeq.current = token;
    const pendingId = `pending-${token}`;
    const at = nowLabel();
    setSending(true);
    setMessages((current) => [
      ...current,
      { id: `user-${token}`, role: "user", text, at },
      { id: pendingId, role: "assistant", text: "أقرأ الطلب وأوجّهه.", at, pending: true },
    ]);
    setFreeText("");
    const result = await postIntent(payload);
    if (token !== requestSeq.current) return;
    setSending(false);
    setMessages((current) =>
      current.map((message) => {
        if (message.id !== pendingId) return message;
        if (!result.ok) {
          return { id: pendingId, role: "assistant", text: result.error.messageAr, at, error: true, retry: payload };
        }
        return { id: pendingId, role: "assistant", text: result.job.messageAr, at, job: result.job };
      }),
    );
    if (result.ok && result.job.status === "queued") void poll(result.job.id, pendingId, token, payload);
    boxRef.current?.focus();
  }

  async function poll(id: string, messageId: string, token: number, payload: Payload) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      if (token !== requestSeq.current) return;
      try {
        const response = await fetch(`/api/jobs/${id}`, { headers: { accept: "application/json" } });
        const data: unknown = await response.json();
        if (!data || typeof data !== "object" || !("job" in data) || !isJob(data.job)) return;
        const job = data.job;
        setMessages((current) =>
          current.map((message) => {
            if (message.id !== messageId || !("job" in message)) return message;
            if (job.status === "failed") {
              return { id: messageId, role: "assistant", text: job.messageAr, at: message.at, error: true, retry: payload };
            }
            return { ...message, text: job.messageAr, job };
          }),
        );
        if (job.status !== "queued") return;
      } catch {
        return;
      }
    }
  }

  const draft: Payload = { output, service, freeText, description: "" };
  const following = sending || messages.some((message) => "job" in message && message.job.status === "queued");

  return (
    <div className={messages.length > 0 ? "stage has-thread" : "stage"}>
      <section className="hero">
        <ExpertoMark size={92} />
        <p className="hello">مرحباً بك</p>
        <h1>كيف يمكنني مساعدتك اليوم؟</h1>
      </section>

      <form
        className="ask"
        onSubmit={(event) => {
          event.preventDefault();
          if (!sending) void send(draft);
        }}
      >
        <div className="capsule">
          <label className="sr-only" htmlFor="ask">
            اكتب سؤالك
          </label>
          <textarea
            id="ask"
            ref={boxRef}
            rows={1}
            maxLength={500}
            value={freeText}
            placeholder="...اكتب سؤالك هنا"
            onChange={(event) => setFreeText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                if (!sending) void send(draft);
              }
            }}
          />
          <button className="mic" type="submit" disabled={sending} aria-label="إرسال">
            <MicIcon />
          </button>
        </div>
        <div className="chips" role="group" aria-label="الخدمات">
          <button type="button" className="chip" aria-pressed={service === "experto"} onClick={() => chooseService("experto")}>
            حسابات
          </button>
          <button type="button" className="chip" aria-pressed={service === "studio"} onClick={() => chooseService("studio")}>
            فيديو
          </button>
          <button type="button" className="chip" aria-pressed={service === "marketer"} onClick={() => chooseService("marketer")}>
            تسويق
          </button>
          <button type="button" className="chip" aria-pressed={moreOpen} onClick={() => setMoreOpen((open) => !open)}>
            المزيد
          </button>
        </div>
        {moreOpen ? (
          <div className="chips" role="group" aria-label="نوع المخرج">
            <button
              type="button"
              className="chip"
              aria-pressed={output === "website"}
              onClick={() => setOutput((current) => (current === "website" ? null : "website"))}
            >
              موقع
            </button>
            <button
              type="button"
              className="chip"
              aria-pressed={output === "app"}
              onClick={() => setOutput((current) => (current === "app" ? null : "app"))}
            >
              تطبيق
            </button>
          </div>
        ) : null}
      </form>

      <div className="thread" ref={threadRef} aria-live="polite">
        {messages.map((message) => (
          <Message key={message.id} message={message} onRetry={(payload) => void send(payload)} />
        ))}
      </div>

      {following ? (
        <div className="follow" role="status">
          <span className="follow-dot" aria-hidden="true" />
          طلبك قيد المتابعة
        </div>
      ) : null}
    </div>
  );
}

function Message({ message, onRetry }: { message: ChatMessage; onRetry: (payload: Payload) => void }) {
  if (message.role === "user") {
    return (
      <div className="msg msg-user">
        <p className="bubble bubble-user">{message.text}</p>
        <time dateTime={message.at}>{message.at}</time>
      </div>
    );
  }
  return (
    <div className="msg msg-assistant">
      <div className={`bubble bubble-assistant${"error" in message ? " is-error" : ""}${ "pending" in message && message.pending ? " is-pending" : ""}`}>
        {"job" in message ? (
          <p className="bubble-kicker">
            {message.job.serviceLabelAr} <span className={`status status-${message.job.status}`}>{STATUS_AR[message.job.status]}</span>
          </p>
        ) : null}
        {"info" in message ? <p className="bubble-kicker">{message.info.labelAr}</p> : null}
        <p>{message.text}</p>
        {"job" in message ? <p className="quiet">{message.job.reasonAr}</p> : null}
        {"info" in message ? <Explorer meta={message.info} /> : null}
        {"job" in message ? <JobLinks job={message.job} /> : null}
        {"error" in message ? (
          <button className="retry" type="button" onClick={() => onRetry(message.retry)}>
            أعد المحاولة
          </button>
        ) : null}
      </div>
      <time dateTime={message.at}>{message.at}</time>
    </div>
  );
}

function Explorer({ meta }: { meta: ServiceMeta }) {
  return (
    <>
      <a className="explorer" href={meta.opportunityUrl}>
        {meta.opportunityUrl}
      </a>
      {meta.publicUrl ? (
        <a className="text-link" href={meta.publicUrl}>
          {meta.publicUrl}
        </a>
      ) : null}
      {meta.testflightUrl ? (
        <a className="text-link" href={meta.testflightUrl}>
          TestFlight
        </a>
      ) : null}
    </>
  );
}

function JobLinks({ job }: { job: PublicJob }) {
  const showPreview = (job.status === "stub" || job.status === "ready") && Boolean(job.previewUrl);
  return (
    <>
      <a className="explorer" href={job.opportunityUrl}>
        {job.opportunityUrl}
      </a>
      {job.publicUrl ? (
        <a className="text-link" href={job.publicUrl}>
          {job.publicUrl}
        </a>
      ) : null}
      {showPreview && job.previewUrl ? (
        <a className="text-link" href={job.previewUrl}>
          {job.status === "stub" ? "بطاقة المعاينة التجريبية" : "المعاينة"}
        </a>
      ) : null}
    </>
  );
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="9" y="3" width="6" height="10" rx="3" />
      <path d="M6.5 11a5.5 5.5 0 0 0 11 0M12 16.5V20" />
    </svg>
  );
}
