import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Poppins } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const fontSans = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-poppins",
  display: "swap",
});

const fontMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AMS — Attendance Management",
  description: "Employee attendance management for night-shift teams (PKT)",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${fontSans.variable} ${fontMono.variable} h-full antialiased`}>
      <body className="min-h-dvh font-sans">
        {children}
        <Toaster richColors closeButton />
      </body>
    </html>
  );
}
