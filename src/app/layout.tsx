import type { Metadata, Viewport } from "next";
// Self-hosted fonts: no Google request, so they still load on school Wi-Fi that blocks Google Fonts.
import "@fontsource-variable/big-shoulders-display";
import "@fontsource-variable/atkinson-hyperlegible-next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "EcoPoints", template: "%s | EcoPoints" },
  description: "Class-wise sustainability scoring: daily eco checks, peer checks and a live Green Champion leaderboard.",
};

export const viewport: Viewport = {
  themeColor: "#0d3b2e",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-dvh flex-col">{children}</body>
    </html>
  );
}
