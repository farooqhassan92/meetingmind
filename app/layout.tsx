import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";

import { ToastProvider } from "@/components/ui/toast";

import "./globals.css";

export const metadata: Metadata = {
  title: "MeetingMind",
  description: "AI meeting notes with MCP-powered transcription and analysis."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const hydrationAttributeCleanup = (
    <script
      dangerouslySetInnerHTML={{
        __html: `
          (function () {
            function cleanup() {
              document.querySelectorAll("[bis_skin_checked]").forEach(function (node) {
                node.removeAttribute("bis_skin_checked");
              });
            }

            cleanup();
            var runs = 0;
            var interval = window.setInterval(function () {
              cleanup();
              runs += 1;
              if (runs > 60) {
                window.clearInterval(interval);
              }
            }, 16);
          })();
        `
      }}
    />
  );

  if (!publishableKey) {
    return (
      <html lang="en" suppressHydrationWarning>
        <head>{hydrationAttributeCleanup}</head>
        <body suppressHydrationWarning>
          <ToastProvider>{children}</ToastProvider>
        </body>
      </html>
    );
  }

  return (
    <ClerkProvider publishableKey={publishableKey}>
      <html lang="en" suppressHydrationWarning>
        <head>{hydrationAttributeCleanup}</head>
        <body suppressHydrationWarning>
          <ToastProvider>{children}</ToastProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
