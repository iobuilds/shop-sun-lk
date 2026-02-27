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
