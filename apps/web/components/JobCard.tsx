import type { JobStatus, PublicJob } from "@experto/orchestrator";

const STATUS_AR: Record<JobStatus, string> = {
  stub: "تجريبي",
  queued: "في الانتظار",
  ready: "جاهز للمعاينة",
  failed: "ما تم",
};

export function JobCard({ job, linkPreview = true }: { job: PublicJob; linkPreview?: boolean }) {
  const showPreview = linkPreview && (job.status === "stub" || job.status === "ready") && Boolean(job.previewUrl);
  return (
    <article className="job">
      <dl className="meta">
        <div>
          <dt>الخدمة</dt>
          <dd>{job.serviceLabelAr}</dd>
        </div>
        <div>
          <dt>الحالة</dt>
          <dd>
            <span className={`status status-${job.status}`}>{STATUS_AR[job.status]}</span>
          </dd>
        </div>
        <div>
          <dt>رقم الطلب</dt>
          <dd className="id">{job.id}</dd>
        </div>
        {job.serviceJobId ? (
          <div>
            <dt>رقم الخدمة</dt>
            <dd className="id">{job.serviceJobId}</dd>
          </div>
        ) : null}
      </dl>
      <p>{job.messageAr}</p>
      <p className="quiet">{job.reasonAr}</p>
      {job.summaryAr ? (
        <div className="preview">
          <div className="kicker">ملخص الطلب</div>
          <p>{job.summaryAr}</p>
          {job.status === "queued" ? <p className="quiet">ما فيه معاينة بعد.</p> : null}
          {showPreview && job.previewUrl ? (
            <a className="text-link" href={job.previewUrl}>
              {job.status === "stub" ? "افتح بطاقة المعاينة التجريبية" : "افتح المعاينة"}
            </a>
          ) : null}
          {job.status === "ready" && !job.previewUrl ? <p className="quiet">الخدمة قالت إن الطلب جاهز، بدون رابط معاينة.</p> : null}
        </div>
      ) : null}
    </article>
  );
}
