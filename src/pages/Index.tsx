import Navbar from "@/components/Navbar";
import HeroBanner from "@/components/HeroBanner";
import TrustBanner from "@/components/TrustBanner";
import DailyDeals from "@/components/DailyDeals";
import CategoryGrid from "@/components/CategoryGrid";
import FeaturedProducts from "@/components/FeaturedProducts";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-[136px] md:pt-[160px]">
        <div className="container mx-auto px-4 space-y-10 py-6">
          <HeroBanner />
          <TrustBanner />
          <DailyDeals />
          <CategoryGrid />
          <FeaturedProducts />
        </div>
        <Footer />
      </main>
    </div>
  );
};

export default Index;
