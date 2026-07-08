import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Imagen - AI Image Generation Credits and API",
  description: "AI image generation credits, hosted results, and API workflows for creators and teams.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark h-full antialiased">
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
