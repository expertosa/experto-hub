"use client";

import { useEffect, useRef, useState } from "react";
import { SERVICE_CATALOG, type ServiceMeta } from "@experto/orchestrator/catalog";
import type { JobStatus, OutputKind, PublicJob, ServiceId, SubmitResult } from "@experto/orchestrator";

const OUTPUTS: Array<{ id: OutputKind; label: string }> = [
  { id: "website", label: "موقع" },
  { id: "video", label: "فيديو" },
  { id: "app", label: "تطبيق" },
];

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
  | { id: string; role: "user"; text: string }
  | { id: string; role: "assistant"; text: string; pending?: boolean }
  | { id: string; role: "assistant"; text: string; job: PublicJob }
  | { id: string; role: "assistant"; text: string; error: true; retry: Payload }
  | { id: string; role: "assistant"; text: string; info: ServiceMeta };

const NETWORK_ERROR = "ما قدرنا نصل للسيرفر. جرّب مرة ثانية.";

function userText(payload: Payload): string {
  const output = OUTPUTS.find((item) => item.id === payload.output)?.label;
  const service = payload.service ? SERVICE_CATALOG.find((item) => item.id === payload.service)?.labelAr : null;
  return [service, output, payload.freeText.trim(), payload.description.trim()].filter(Boolean).join("\n");
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
  const [description, setDescription] = useState("");
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "قل وش تبي. أقدر أوجّه الطلب لأبيت، أو استوديو فيديو، أو ماركتير.",
    },
  ]);
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

  function showService(meta: ServiceMeta) {
    setService((current) => (current === meta.id ? null : meta.id));
    setMessages((current) => {
      if (current.some((message) => message.role === "assistant" && "info" in message && message.info.id === meta.id)) {
        return current;
      }
      return [...current, { id: `info-${meta.id}`, role: "assistant", text: meta.detailAr, info: meta }];
    });
  }

  async function send(payload: Payload) {
    if (!payload.output && !payload.freeText.trim() && !payload.description.trim()) return;
    const text = userText(payload);
    if (!text) return;
    const token = requestSeq.current + 1;
    requestSeq.current = token;
    const pendingId = `pending-${token}`;
    setSending(true);
    setMessages((current) => [
      ...current,
      { id: `user-${token}`, role: "user", text },
      { id: pendingId, role: "assistant", text: "أقرأ الطلب وأوجّهه.", pending: true },
    ]);
    setFreeText("");
    setDescription("");
    const result = await postIntent(payload);
    if (token !== requestSeq.current) return;
    setSending(false);
    setMessages((current) =>
      current.map((message) => {
        if (message.id !== pendingId) return message;
        if (!result.ok) {
          return { id: pendingId, role: "assistant", text: result.error.messageAr, error: true, retry: payload };
        }
        return { id: pendingId, role: "assistant", text: result.job.messageAr, job: result.job };
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
              return {
                id: messageId,
                role: "assistant",
                text: job.messageAr,
                error: true,
                retry: payload,
              };
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

  const draft: Payload = { output, service, freeText, description };

  return (
    <div className="chat">
      <div className="thread" ref={threadRef} aria-live="polite">
        {messages.map((message) => (
          <Message key={message.id} message={message} onRetry={(payload) => void send(payload)} />
        ))}
      </div>
      <form
        className="composer"
        onSubmit={(event) => {
          event.preventDefault();
          if (!sending) void send(draft);
        }}
      >
        <div className="chips" role="group" aria-label="نوع المخرج">
          {OUTPUTS.map((item) => (
            <button
              key={item.id}
              type="button"
              className="chip"
              aria-pressed={output === item.id}
              onClick={() => setOutput((current) => (current === item.id ? null : item.id))}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="chips" role="group" aria-label="الخدمات">
          {SERVICE_CATALOG.map((item) => (
            <button
              key={item.id}
              type="button"
              className="chip"
              aria-pressed={service === item.id}
              onClick={() => showService(item)}
            >
              {item.labelAr}
            </button>
          ))}
        </div>
        <label className="composer-note">
          <span className="sr-only">وصف قصير</span>
          <input
            value={description}
            maxLength={2000}
            placeholder="وصف قصير، إذا تبي"
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
        <div className="composer-row">
          <textarea
            ref={boxRef}
            rows={2}
            maxLength={500}
            value={freeText}
            placeholder="قل وش تبي"
            onChange={(event) => setFreeText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                if (!sending) void send(draft);
              }
            }}
          />
          <button className="send" type="submit" disabled={sending} aria-label="إرسال">
            {sending ? "…" : "إرسال"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Message({ message, onRetry }: { message: ChatMessage; onRetry: (payload: Payload) => void }) {
  if (message.role === "user") {
    return <p className="bubble bubble-user">{message.text}</p>;
  }
  if ("error" in message) {
    return (
      <div className="bubble bubble-assistant bubble-error" role="alert">
        <p>{message.text}</p>
        <button className="retry" type="button" onClick={() => onRetry(message.retry)}>
          أعد المحاولة
        </button>
      </div>
    );
  }
  if ("info" in message) {
    return (
      <div className="bubble bubble-assistant">
        <p className="bubble-kicker">{message.info.labelAr}</p>
        <p>{message.text}</p>
        <a className="explorer" href={message.info.opportunityUrl}>
          {message.info.opportunityUrl}
        </a>
        {message.info.publicUrl ? (
          <a className="text-link" href={message.info.publicUrl}>
            {message.info.publicUrl}
          </a>
        ) : null}
        {message.info.testflightUrl ? (
          <a className="text-link" href={message.info.testflightUrl}>
            TestFlight
          </a>
        ) : null}
      </div>
    );
  }
  if ("job" in message) {
    const job = message.job;
    const showPreview = (job.status === "stub" || job.status === "ready") && Boolean(job.previewUrl);
    return (
      <div className="bubble bubble-assistant">
        <p className="bubble-kicker">
          {job.serviceLabelAr} <span className={`status status-${job.status}`}>{STATUS_AR[job.status]}</span>
        </p>
        <p>{job.messageAr}</p>
        <p className="quiet">{job.reasonAr}</p>
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
      </div>
    );
  }
  return <p className={`bubble bubble-assistant${message.pending ? " is-pending" : ""}`}>{message.text}</p>;
}
