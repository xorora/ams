import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfkit"],
  experimental: {
    optimizePackageImports: ["lucide-react", "date-fns", "date-fns-tz"],
  },
};

export default nextConfig;
