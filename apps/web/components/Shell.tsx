import type { ReactNode } from "react";

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="page">
      <header className="top">
        <a className="brand" href="/">
          <span>إكسبرتو</span>
          <span className="brand-sep" aria-hidden="true" />
          <h1>قل وش تبي</h1>
        </a>
      </header>
      <main className="chat-main">{children}</main>
      <footer className="foot">نسخة تجريبية · بدون نشر</footer>
    </div>
  );
}
