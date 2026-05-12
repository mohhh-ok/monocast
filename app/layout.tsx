import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "monocast",
  description:
    "Claude Haiku + VOICEVOX で生成する、ひとり用の情報ききながしラジオ",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
