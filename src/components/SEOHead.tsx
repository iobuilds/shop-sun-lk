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
  noindex?: boolean;
}

const SEOHead = ({
  title,
  description,
  keywords,
  canonical,
  ogImage,
  ogType = "website",
  jsonLd,
  noindex = false,
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

  const { data: company } = useQuery({
    queryKey: ["site-company-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_settings" as any)
        .select("*")
        .eq("key", "company")
        .maybeSingle();
      if (error) throw error;
      return (data as any)?.value as any || null;
    },
    staleTime: 5 * 60 * 1000,
  });

  const storeName = company?.store_name || seoSettings?.store_name || "NanoCircuit.lk";
  const tagline = seoSettings?.tagline || "Electronics & Components Store | Sri Lanka";
  const defaultDescription = seoSettings?.meta_description || `${storeName} - Sri Lanka's trusted electronics & components store. Arduino, sensors, 3D printing, PCB design and more. Island-wide delivery.`;
  const defaultKeywords = seoSettings?.meta_keywords || `electronics Sri Lanka, Arduino, sensors, components, ${storeName}, Colombo, PCB design, 3D printing, online store`;
  const defaultOgImage = seoSettings?.og_image || company?.logo_url || "https://lovable.dev/opengraph-image-p98pqg.png";
  const faviconUrl = seoSettings?.favicon_url || "/favicon.ico";
  const sitePhone = company?.phone || company?.whatsapp || "";
  const siteEmail = company?.email || "";
  const googleSiteVerification = seoSettings?.google_site_verification || "";

  const finalTitle = title
    ? (title.includes(storeName) ? title : `${title} | ${storeName}`)
    : `${storeName} — ${tagline}`;
  const finalDescription = description || defaultDescription;
  const finalKeywords = keywords || defaultKeywords;
  const finalOgImage = ogImage || defaultOgImage;
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const defaultJsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${origin}/#website`,
        name: storeName,
        url: origin,
        description: finalDescription,
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${origin}/search?q={search_term_string}`,
          },
          "query-input": "required name=search_term_string",
        },
      },
      {
        "@type": ["Store", "ElectronicsStore"],
        "@id": `${origin}/#store`,
        name: storeName,
        url: origin,
        description: finalDescription,
        ...(sitePhone ? { telephone: sitePhone } : {}),
        ...(siteEmail ? { email: siteEmail } : {}),
        address: {
          "@type": "PostalAddress",
          addressCountry: "LK",
          addressLocality: "Sri Lanka",
        },
        priceRange: "$$",
        image: finalOgImage,
        sameAs: [
          ...(company?.facebook ? [company.facebook] : []),
          ...(company?.instagram ? [company.instagram] : []),
          ...(company?.youtube ? [company.youtube] : []),
          ...(company?.tiktok ? [company.tiktok] : []),
        ],
      },
      {
        "@type": "Organization",
        "@id": `${origin}/#organization`,
        name: storeName,
        url: origin,
        ...(finalOgImage ? { logo: finalOgImage } : {}),
        ...(siteEmail ? { email: siteEmail } : {}),
        ...(sitePhone ? { contactPoint: { "@type": "ContactPoint", telephone: sitePhone, contactType: "customer service", availableLanguage: ["English", "Sinhala"] } } : {}),
      },
      // SiteNavigationElement for Google Sitelinks
      {
        "@type": "SiteNavigationElement",
        "@id": `${origin}/#navigation`,
        name: "Main Navigation",
        hasPart: [
          { "@type": "SiteNavigationElement", name: "Store", url: `${origin}/` },
          { "@type": "SiteNavigationElement", name: "PCB Design", url: `${origin}/pcb-order` },
          { "@type": "SiteNavigationElement", name: "3D Print", url: "https://3dprint.iobuilds.com" },
          { "@type": "SiteNavigationElement", name: "Daily Deals", url: `${origin}/deals` },
          { "@type": "SiteNavigationElement", name: "Pre-Order", url: `${origin}/pre-order` },
        ],
      },
    ],
  };

  return (
    <Helmet>
      <title>{finalTitle}</title>
      <link rel="icon" href={faviconUrl} />
      <meta name="description" content={finalDescription} />
      <meta name="keywords" content={finalKeywords} />
      {googleSiteVerification && <meta name="google-site-verification" content={googleSiteVerification} />}
      {noindex ? (
        <meta name="robots" content="noindex, nofollow" />
      ) : (
        <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
      )}
      {canonical && <link rel="canonical" href={canonical} />}
      {!canonical && <link rel="canonical" href={origin + (typeof window !== "undefined" ? window.location.pathname : "")} />}
      <meta property="og:title" content={finalTitle} />
      <meta property="og:description" content={finalDescription} />
      <meta property="og:type" content={ogType} />
      <meta property="og:image" content={finalOgImage} />
      <meta property="og:site_name" content={storeName} />
      <meta property="og:locale" content="en_LK" />
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
