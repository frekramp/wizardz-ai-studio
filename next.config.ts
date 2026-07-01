import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  // Native addon (meme-caption font rendering) — keep external so Turbopack doesn't bundle the .node
  // binary, and force-include the Linux binary so Vercel traces it into the /api/generate function.
  serverExternalPackages: ["@resvg/resvg-js"],
  outputFileTracingIncludes: {
    "/api/generate": ["./node_modules/@resvg/resvg-js-linux-x64-gnu/**"],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
