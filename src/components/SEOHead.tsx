import { Helmet } from "react-helmet-async";

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
  title = "TechLK — Electronics & Components Store | Sri Lanka",
  description = "TechLK - Sri Lanka's trusted electronics & components store. Arduino, sensors, 3D printing, tools and more. Island-wide delivery.",
  keywords = "electronics Sri Lanka, Arduino, sensors, components, TechLK, Colombo",
  canonical,
  ogImage = "https://lovable.dev/opengraph-image-p98pqg.png",
  ogType = "website",
  jsonLd,
}: SEOHeadProps) => {
  const fullTitle = title.includes("TechLK") ? title : `${title} | TechLK`;

  const defaultJsonLd = {
    "@context": "https://schema.org",
    "@type": "Store",
    name: "TechLK",
    description,
    url: window.location.origin,
    address: {
      "@type": "PostalAddress",
      addressCountry: "LK",
    },
    priceRange: "$$",
  };

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      {canonical && <link rel="canonical" href={canonical} />}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={ogType} />
      <meta property="og:image" content={ogImage} />
      {canonical && <meta property="og:url" content={canonical} />}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />
      <script type="application/ld+json">
        {JSON.stringify(jsonLd || defaultJsonLd)}
      </script>
    </Helmet>
  );
};

export default SEOHead;
