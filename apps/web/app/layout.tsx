import type { Metadata } from "next";
import type { ReactNode } from "react";
import { IBM_Plex_Sans_Arabic } from "next/font/google";
import { Shell } from "@/components/Shell";
import "./globals.css";

const arabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-arabic",
  display: "swap",
});

export const metadata: Metadata = {
  title: "قل وش تبي · Experto Intent Hub",
  description: "مدخل إكسبرتو: اختر موقع أو فيديو أو تطبيق، أو اكتب طلبك.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={arabic.variable}>
      <body className={arabic.className}>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
