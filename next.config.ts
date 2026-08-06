import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/merge",
        destination: "/tools/merge-pdf",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
