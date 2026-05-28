import type { MetadataRoute } from "next";
import { productConfig } from "@/lib/product-config";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: productConfig.name,
    short_name: productConfig.shortName,
    description: productConfig.description,
    start_url: "/login",
    scope: "/",
    display: "standalone",
    background_color: productConfig.colors.themeColorPwa,
    theme_color: productConfig.colors.themeColorPwa,
    orientation: "portrait",
    icons: [
      {
        src: productConfig.assets.icon192,
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: productConfig.assets.icon512,
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: productConfig.assets.iconMaskable,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: productConfig.assets.badge72,
        sizes: "72x72",
        type: "image/png",
        purpose: "monochrome",
      },
    ],
  };
}
