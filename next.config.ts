import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  headers: async () => [
    {
      // HTML pages and API routes — always revalidate (ETag still works for 304s)
      source: "/((?!_next/static|_next/image|favicon\\.ico).*)",
      headers: [
        {
          key: "Cache-Control",
          value: "no-cache, must-revalidate",
        },
      ],
    },
  ],
};

export default nextConfig;
