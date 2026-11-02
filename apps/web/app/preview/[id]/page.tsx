import { JobCard } from "@/components/JobCard";
import { orchestrator } from "@/lib/orchestrator";

export const dynamic = "force-dynamic";

export default async function PreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await orchestrator.getJob(id);

  return (
    <div className="preview-page">
      <section>
        <p className="eyebrow">معاينة</p>
        <h1>بطاقة الطلب</h1>
        <p className="lede">هذي بطاقة حالة داخل إكسبرتو هب. الوصلة التجريبية مو تسليم من الخدمة.</p>
      </section>
      <section className="panel result">
        {job ? <JobCard job={job} linkPreview={false} /> : <p className="alert">ما لقينا هذا الطلب.</p>}
        <p>
          <a className="text-link" href="/">
            ارجع للمحادثة
          </a>
        </p>
      </section>
    </div>
  );
}
