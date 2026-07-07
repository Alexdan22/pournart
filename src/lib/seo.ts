import type { Metadata } from "next";

export const siteConfig = {
  name: "Pour n Art",
  title: "Pour n Art | Handcrafted Custom Gifts & Resin Art",
  description:
    "Boutique handmade resin art, custom gifts, personalized keepsakes, and gift-ready decor crafted around memories, nature, and the ocean.",
  url: (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.EMAIL_APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://pournart.in"
  ).replace(/\/$/, ""),
  ogImage: "/assets/optimized/resin-hero-home.webp",
  logo: "/assets/brand/pour-n-art-resin-art-logo.jpg",
  instagramUrl: "https://www.instagram.com/pour_n_art/",
  keywords: [
    "Pour n Art",
    "custom gifts",
    "handmade resin art",
    "personalized gifts",
    "resin decor",
    "handcrafted gifts India",
    "custom keepsakes",
    "gift-ready decor",
  ],
};

type MetadataInput = {
  title: string;
  description: string;
  path?: string;
  image?: string;
  keywords?: string[];
  noIndex?: boolean;
};

export function absoluteUrl(path = "/") {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  return new URL(path, siteConfig.url).toString();
}

function titleWithBrand(title: string) {
  return title.includes(siteConfig.name) ? title : `${title} | ${siteConfig.name}`;
}

export function createMetadata({
  title,
  description,
  path = "/",
  image = siteConfig.ogImage,
  keywords = [],
  noIndex = false,
}: MetadataInput): Metadata {
  const fullTitle = titleWithBrand(title);
  const imageUrl = absoluteUrl(image);

  return {
    title: fullTitle,
    description,
    keywords: [...siteConfig.keywords, ...keywords],
    alternates: {
      canonical: absoluteUrl(path),
    },
    openGraph: {
      title: fullTitle,
      description,
      url: absoluteUrl(path),
      siteName: siteConfig.name,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: siteConfig.name,
        },
      ],
      locale: "en_IN",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [imageUrl],
    },
    robots: noIndex
      ? {
          index: false,
          follow: false,
          googleBot: {
            index: false,
            follow: false,
          },
        }
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            "max-image-preview": "large",
            "max-snippet": -1,
            "max-video-preview": -1,
          },
        },
  };
}

export const privatePageMetadata = createMetadata({
  title: "Private Page",
  description: "Private Pour n Art account and checkout area.",
  path: "/",
  noIndex: true,
});

export function organizationJsonLd() {
  return {
    "@type": "Organization",
    "@id": absoluteUrl("/#organization"),
    name: siteConfig.name,
    url: siteConfig.url,
    logo: absoluteUrl(siteConfig.logo),
    sameAs: [siteConfig.instagramUrl],
  };
}

export function websiteJsonLd() {
  return {
    "@type": "WebSite",
    "@id": absoluteUrl("/#website"),
    url: siteConfig.url,
    name: siteConfig.name,
    publisher: { "@id": absoluteUrl("/#organization") },
    potentialAction: {
      "@type": "SearchAction",
      target: `${absoluteUrl("/products")}?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}
