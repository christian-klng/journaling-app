import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Journaling – Audio-Tagebuch",
    short_name: "Journaling",
    description: "Dein Audio-Tagebuch für Projekt- und Gründungsarbeit.",
    start_url: "/",
    display: "standalone",
    lang: "de",
    background_color: "#faf7f2",
    theme_color: "#0f766e",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
