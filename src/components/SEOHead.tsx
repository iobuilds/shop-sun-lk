import { Helmet } from "react-helmet-async";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface SEOHeadProps {
  title?: string;
  description?: string;
  keywords?: string;
  canonical?: string;
  ogImage?: string;
  ogType?: string;
  jsonLd?: Record<string, any>;
}

const SEOHead = ({
  title,
  description,
  keywords,
  canonical,
  ogImage,
  ogType = "website",
  jsonLd,
}: SEOHeadProps) => {
  const { data: seoSettings } = useQuery({
    queryKey: ["site-seo-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_settings" as any)
        .select("*")
        .eq("key", "seo")
        .maybeSingle();
      if (error) throw error;
      return (data as any)?.value as any || null;
    },
    staleTime: 5 * 60 * 1000,
  });

  const storeName = seoSettings?.store_name || "TechLK";
  const tagline = seoSettings?.tagline || "Electronics & Components Store | Sri Lanka";
  const defaultDescription = seoSettings?.meta_description || "TechLK - Sri Lanka's trusted electronics & components store. Arduino, sensors, 3D printing, tools and more. Island-wide delivery.";
  const defaultKeywords = seoSettings?.meta_keywords || "electronics Sri Lanka, Arduino, sensors, components, TechLK, Colombo";
  const defaultOgImage = seoSettings?.og_image || "https://lovable.dev/opengraph-image-p98pqg.png";
  const faviconUrl = seoSettings?.favicon_url || "/favicon.ico";

  const finalTitle = title
    ? (title.includes(storeName) ? title : `${title} | ${storeName}`)
    : `${storeName} — ${tagline}`;
  const finalDescription = description || defaultDescription;
  const finalKeywords = keywords || defaultKeywords;
  const finalOgImage = ogImage || defaultOgImage;

  const defaultJsonLd = {
    "@context": "https://schema.org",
    "@type": "Store",
    name: storeName,
    description: finalDescription,
    url: window.location.origin,
    address: {
      "@type": "PostalAddress",
      addressCountry: "LK",
    },
    priceRange: "$$",
  };

  return (
    <Helmet>
      <title>{finalTitle}</title>
      <link rel="icon" href={faviconUrl} />
      <meta name="description" content={finalDescription} />
      <meta name="keywords" content={finalKeywords} />
      {canonical && <link rel="canonical" href={canonical} />}
      <meta property="og:title" content={finalTitle} />
      <meta property="og:description" content={finalDescription} />
      <meta property="og:type" content={ogType} />
      <meta property="og:image" content={finalOgImage} />
      {canonical && <meta property="og:url" content={canonical} />}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={finalTitle} />
      <meta name="twitter:description" content={finalDescription} />
      <meta name="twitter:image" content={finalOgImage} />
      <script type="application/ld+json">
        {JSON.stringify(jsonLd || defaultJsonLd)}
      </script>
    </Helmet>
  );
};

export default SEOHead;
