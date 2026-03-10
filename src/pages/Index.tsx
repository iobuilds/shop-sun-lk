import Navbar from "@/components/Navbar";
import HeroBanner from "@/components/HeroBanner";
import TrustBanner from "@/components/TrustBanner";
import DailyDeals from "@/components/DailyDeals";
import CategoryGrid from "@/components/CategoryGrid";
import FeaturedProducts from "@/components/FeaturedProducts";
import PromoBanners from "@/components/PromoBanners";
import NewArrivals from "@/components/NewArrivals";
import ComboPacks from "@/components/ComboPacks";
import Testimonials from "@/components/Testimonials";
import Newsletter from "@/components/Newsletter";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import { Printer } from "lucide-react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { HomepageSection } from "@/components/admin/HomepageSectionsManager";

const DEFAULT_SECTIONS: HomepageSection[] = [
  { id: "hero_banner",        label: "Hero Banner",       visible: true,  order: 0 },
  { id: "trust_banner",       label: "Trust Banner",      visible: true,  order: 1 },
  { id: "daily_deals",        label: "Daily Deals",       visible: true,  order: 2 },
  { id: "promo_banners",      label: "Promo Banners",     visible: true,  order: 3 },
  { id: "category_grid",      label: "Category Grid",     visible: true,  order: 4 },
  { id: "featured_products",  label: "Featured Products", visible: true,  order: 5 },
  { id: "combo_packs",        label: "Combo Packs",       visible: true,  order: 6 },
  { id: "service_3d_print",   label: "3D Printing CTA",   visible: true,  order: 7 },
  { id: "new_arrivals",       label: "New Arrivals",      visible: true,  order: 8 },
  { id: "testimonials",       label: "Testimonials",      visible: true,  order: 9 },
  { id: "newsletter",         label: "Newsletter",        visible: true,  order: 10 },
];

const SECTION_COMPONENTS: Record<string, JSX.Element> = {
  hero_banner: <HeroBanner />,
  trust_banner: <TrustBanner />,
  daily_deals: <DailyDeals />,
  promo_banners: <PromoBanners />,
  category_grid: <CategoryGrid />,
  featured_products: <FeaturedProducts />,
  combo_packs: <ComboPacks />,
  service_3d_print: (
    <motion.a
      href="https://3dprint.iobuilds.com"
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="block rounded-xl bg-gradient-to-r from-secondary to-primary p-6 md:p-8 text-primary-foreground relative overflow-hidden group"
    >
      <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.05%22%3E%3Cpath%20d%3D%22M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22%2F%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E')] opacity-50" />
      <div className="relative flex items-center gap-4 md:gap-6">
        <div className="w-14 h-14 md:w-16 md:h-16 rounded-xl bg-primary-foreground/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
          <Printer className="w-7 h-7 md:w-8 md:h-8" />
        </div>
        <div className="flex-1">
          <h3 className="text-xl md:text-2xl font-bold font-display">3D Printing Service</h3>
          <p className="text-sm md:text-base text-primary-foreground/80 mt-1">
            Custom 3D prints for your projects. Upload your design and get it printed!
          </p>
        </div>
        <span className="hidden md:flex items-center gap-2 bg-primary-foreground/20 backdrop-blur-sm px-4 py-2 rounded-lg text-sm font-medium group-hover:bg-primary-foreground/30 transition-colors">
          Visit 3DPrint →
        </span>
      </div>
    </motion.a>
  ),
  new_arrivals: <NewArrivals />,
  testimonials: <Testimonials />,
  newsletter: <Newsletter />,
};

const Index = () => {
  const { data: sectionsData } = useQuery({
    queryKey: ["homepage-sections-config"],
    queryFn: async () => {
      const { data } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "homepage_sections")
        .maybeSingle();
      if (!data?.value) return DEFAULT_SECTIONS;
      const saved = data.value as unknown as HomepageSection[];
      // Merge with defaults so new sections appear even if not yet saved
      const merged = DEFAULT_SECTIONS.map((def) => {
        const found = saved.find((s) => s.id === def.id);
        return found ? { ...def, ...found } : def;
      });
      merged.sort((a, b) => a.order - b.order);
      return merged;
    },
    staleTime: 30000,
  });

  const sections = sectionsData ?? DEFAULT_SECTIONS;

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="NanoCircuit.lk — Sri Lanka's Leading Electronics & Components Store"
        description="NanoCircuit.lk is Sri Lanka's #1 electronics supplier. Buy Arduino, sensors, 3D printing supplies, tools & components online. Best prices, island-wide delivery."
        keywords="electronics Sri Lanka, buy electronics online, Arduino Sri Lanka, sensors, components, NanoCircuit, Colombo, online electronics store, 3D printing, IoT, microcontrollers"
        canonical={window.location.origin}
        jsonLd={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "WebSite",
              "@id": `${window.location.origin}/#website`,
              name: "NanoCircuit.lk",
              url: window.location.origin,
              potentialAction: {
                "@type": "SearchAction",
                target: {
                  "@type": "EntryPoint",
                  urlTemplate: `${window.location.origin}/search?q={search_term_string}`,
                },
                "query-input": "required name=search_term_string",
              },
            },
            {
              "@type": "Store",
              "@id": `${window.location.origin}/#store`,
              name: "TechLK",
              description: "Sri Lanka's leading electronics & components supplier. Arduino, sensors, 3D printing, tools and more.",
              url: window.location.origin,
              telephone: "+94771234567",
              address: {
                "@type": "PostalAddress",
                addressCountry: "LK",
                addressLocality: "Colombo",
              },
              priceRange: "$$",
              sameAs: [],
            },
            {
              "@type": "Organization",
              name: "TechLK",
              url: window.location.origin,
              logo: `${window.location.origin}/favicon.ico`,
            },
          ],
        }}
      />
      <Navbar />
      <main className="pt-[136px] md:pt-[160px]">
        <div className="container mx-auto px-4 space-y-12 py-6">
          {sections.map((section) => {
            if (!section.visible) return null;
            const component = SECTION_COMPONENTS[section.id];
            if (!component) return null;
            return (
              <div key={section.id}>
                {component}
              </div>
            );
          })}
        </div>
        <Footer />
      </main>
    </div>
  );
};

export default Index;
