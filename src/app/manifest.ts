import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LimeJournal – Audio-Tagebuch",
    short_name: "LimeJournal",
    description: "Dein Audio-Tagebuch für Projekt- und Gründungsarbeit.",
    start_url: "/",
    display: "standalone",
    lang: "de",
    background_color: "#faf7f2",
    theme_color: "#6fb337",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
