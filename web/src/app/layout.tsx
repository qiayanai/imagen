import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Imagen",
  description: "面向团队的批量生图控制台。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="dark h-full antialiased">
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
