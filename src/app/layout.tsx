import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Napkin AI — from napkin to real",
  description:
    "Turn a hand-drawn sketch into a responsive interface you can actually build. Open-source, code-first, and made for the what if.",
  applicationName: "Napkin AI",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html data-theme="dark" lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
