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

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="TechLK — Electronics & Components Store | Sri Lanka"
        description="Sri Lanka's trusted electronics store. Arduino, sensors, 3D printing, tools and more. Island-wide delivery."
        keywords="electronics Sri Lanka, Arduino, sensors, components, TechLK, Colombo, online electronics store"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Store",
          name: "TechLK",
          description: "Sri Lanka's trusted electronics & components store",
          url: window.location.origin,
          address: { "@type": "PostalAddress", addressCountry: "LK" },
          priceRange: "$$",
        }}
      />
      <Navbar />
      <main className="pt-[136px] md:pt-[160px]">
        <div className="container mx-auto px-4 space-y-12 py-6">
          <HeroBanner />
          <TrustBanner />
          <DailyDeals />
          <PromoBanners />
          <CategoryGrid />
          <FeaturedProducts />
          <ComboPacks />
          {/* 3D Print Service CTA */}
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
          <NewArrivals />
          <Testimonials />
          <Newsletter />
        </div>
        <Footer />
      </main>
    </div>
  );
};

export default Index;
