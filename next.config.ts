import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ffmpeg-static ermittelt den Pfad zur Binärdatei relativ zum eigenen Paket,
  // das funktioniert nur ungebündelt
  serverExternalPackages: ["ffmpeg-static"],
  poweredByHeader: false,
  // Die automatischen Tests starten einen zweiten Server mit eigenem Build-Ordner
  distDir: process.env.NEXT_DIST_DIR || ".next",
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "Permissions-Policy", value: "microphone=(self), camera=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        ],
      },
    ];
  },
};

export default nextConfig;
