import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { auth } from "@/auth";
import { ApplicationShell } from "@/components/layout/application-shell";
import { ThemeProvider } from "@/components/theme-provider";
import { canEmployeeAccessLeave } from "@/lib/leave/access";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AMS — Attendance Management",
  description: "Employee attendance management for night-shift teams (PKT)",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  const canAccessLeave = session?.user ? await canEmployeeAccessLeave(session.user) : false;

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-svh font-sans">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ApplicationShell user={session?.user} canAccessLeave={canAccessLeave}>
            {children}
          </ApplicationShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
