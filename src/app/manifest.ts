import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Smash Pong App",
    short_name: "Smash Pong App",
    description: "Ranking de tênis de mesa",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#a421d2",
    theme_color: "#a421d2",
    orientation: "portrait",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/badge-72.png",
        sizes: "72x72",
        type: "image/png",
        purpose: "monochrome",
      },
    ],
  };
}
