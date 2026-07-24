import type { MetadataRoute } from "next";

import { POPULAR_ROUTES } from "@/lib/seo/popular-routes";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tripradar.ai";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/login`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${SITE_URL}/registro`, changeFrequency: "monthly", priority: 0.5 },
  ];

  const routePages: MetadataRoute.Sitemap = POPULAR_ROUTES.map((route) => ({
    url: `${SITE_URL}/voos/${route.originIata}/${route.destinationIata}`,
    changeFrequency: "daily",
    priority: 0.8,
  }));

  return [...staticPages, ...routePages];
}
