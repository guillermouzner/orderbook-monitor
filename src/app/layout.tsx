import type {Metadata} from "next";

import "./globals.css";
import {ThemeProvider} from "@/components/theme-provider";
import {TailwindIndicator} from "@/components/tailwind-indicator";

export const metadata: Metadata = {
  title: "nextjs-initial-stack",
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html suppressHydrationWarning lang="en">
      <body className="container m-auto grid min-h-screen grid-rows-[auto_1fr_auto] px-4 font-sans antialiased">
        <ThemeProvider>
          {children}
          <TailwindIndicator />
        </ThemeProvider>
      </body>
    </html>
  );
}
