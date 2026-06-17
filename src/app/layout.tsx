import type { Metadata } from "next";
import { DM_Sans, Space_Mono } from "next/font/google";
import type { Session } from "next-auth";
import { auth } from "@/auth";
import { ApplicationShell } from "@/components/layout/application-shell";
import { getCompanies, getSelectedCompanyId } from "@/lib/admin/selected-company";
import { hasLinkedEmployee } from "@/lib/auth/attendance-access";
import "./globals.css";

const fontSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
});

const fontMono = Space_Mono({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-space-mono",
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
  const linkedEmployee = session?.user
    ? hasLinkedEmployee({ user: session.user } as Session)
    : false;
  const isAdmin = session?.user?.role === "admin";
  const companies = isAdmin ? await getCompanies() : [];
  const selectedCompanyId = isAdmin ? await getSelectedCompanyId() : null;

  return (
    <html lang="en" className={`${fontSans.variable} ${fontMono.variable} h-full antialiased`}>
      <body className="min-h-svh font-sans">
        <ApplicationShell
          user={session?.user}
          hasLinkedEmployee={linkedEmployee}
          companies={companies}
          selectedCompanyId={selectedCompanyId}
        >
          {children}
        </ApplicationShell>
      </body>
    </html>
  );
}
