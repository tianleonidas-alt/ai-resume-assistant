import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Career Brief — AI 求职助手",
  description: "让你的简历更贴近目标岗位。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
