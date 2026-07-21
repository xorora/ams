import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfkit", "exceljs"],
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "date-fns",
      "date-fns-tz",
      "@tanstack/react-table",
    ],
  },
  images: {
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
