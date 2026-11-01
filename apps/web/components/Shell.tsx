import type { ReactNode } from "react";
import { ExpertoMark } from "./ExpertoMark";

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="home">
      <header className="topbar">
        <a className="mark-link" href="/" aria-label="إكسبرتو">
          <ExpertoMark size={34} />
        </a>
        <button type="button" className="icon-btn" aria-label="الإشعارات">
          <BellIcon />
        </button>
      </header>
      <main className="home-main">{children}</main>
      <nav className="tabbar" aria-label="التنقل">
        <a className="tab is-active" href="/" aria-current="page">
          <HomeIcon />
          <span>الرئيسية</span>
        </a>
        <button type="button" className="tab" tabIndex={-1}>
          <ListIcon />
          <span>طلباتي</span>
        </button>
        <button type="button" className="tab" tabIndex={-1}>
          <BellIcon />
          <span>الإشعارات</span>
        </button>
        <button type="button" className="tab" tabIndex={-1}>
          <UserIcon />
          <span>حسابي</span>
        </button>
      </nav>
    </div>
  );
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6.5 16.5h11l-1.2-2V10.2a4.3 4.3 0 0 0-8.6 0v4.3l-1.2 2z" />
      <path d="M10 16.5a2 2 0 0 0 4 0" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 11.2 12 4l8 7.2V20a1 1 0 0 1-1 1h-5.2v-6.2H10.2V21H5a1 1 0 0 1-1-1v-8.8z" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 7h11M8 12h11M8 17h11" />
      <path d="M5 7h.01M5 12h.01M5 17h.01" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5.5 19.2c1.4-3 3.6-4.4 6.5-4.4s5.1 1.4 6.5 4.4" />
    </svg>
  );
}
