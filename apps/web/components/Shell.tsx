import type { ReactNode } from "react";

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="page">
      <header className="top">
        <a className="brand" href="/">
          <span>إكسبرتو</span>
          <span className="brand-sep" aria-hidden="true" />
          <span className="brand-en">Intent Hub</span>
        </a>
      </header>
      <main>{children}</main>
      <footer className="foot">نسخة v0 · الربط تجريبي إلى أن تتصل الخدمات · بدون نشر</footer>
    </div>
  );
}
