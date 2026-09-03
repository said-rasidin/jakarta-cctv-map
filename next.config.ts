import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["cheerio"],
  async headers() {
    return [
      { source: "/models/:path*.onnx", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
      { source: "/models/:path*/manifest.json", headers: [{ key: "Cache-Control", value: "no-cache" }] },
      { source: "/ort/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=86400" }] },
    ];
  },
};

export default nextConfig;
