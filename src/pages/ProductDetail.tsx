import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Star, ShoppingCart, Heart, ChevronLeft, ChevronRight, Minus, Plus, Truck, Shield, RotateCcw, Share2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const productImages = [
  "https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&h=600&fit=crop",
  "https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=600&h=600&fit=crop",
  "https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?w=600&h=600&fit=crop",
  "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=600&h=600&fit=crop",
];

const specs = [
  { label: "Processor", value: "ARM Cortex-A72 1.8GHz" },
  { label: "RAM", value: "8GB LPDDR4" },
  { label: "Connectivity", value: "WiFi, Bluetooth 5.0, Ethernet" },
  { label: "USB", value: "2x USB 3.0, 2x USB 2.0" },
  { label: "GPIO", value: "40-pin header" },
  { label: "Display", value: "Dual micro-HDMI (4K)" },
  { label: "Storage", value: "MicroSD card slot" },
  { label: "Power", value: "USB-C (5V/3A)" },
];

const reviews = [
  { name: "Kasun P.", rating: 5, date: "2 days ago", comment: "Excellent board! Fast shipping and well packaged. Works perfectly for my IoT project." },
  { name: "Dilini F.", rating: 4, date: "1 week ago", comment: "Great product, a bit warm under heavy load but overall fantastic performance." },
  { name: "Ravindu S.", rating: 5, date: "2 weeks ago", comment: "Best Pi I've owned. The 8GB RAM makes a huge difference for multitasking." },
];

const ProductDetail = () => {
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<"description" | "specs" | "reviews">("description");

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-[136px] md:pt-[160px]">
        <div className="container mx-auto px-4 py-8">
          {/* Breadcrumb */}
          <nav className="text-sm text-muted-foreground mb-6 flex items-center gap-2">
            <a href="/" className="hover:text-secondary transition-colors">Home</a>
            <span>/</span>
            <a href="/category/arduino-boards" className="hover:text-secondary transition-colors">Arduino & Boards</a>
            <span>/</span>
            <span className="text-foreground">Raspberry Pi 4 Model B 8GB</span>
          </nav>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
            {/* Image gallery */}
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
              <div className="relative overflow-hidden rounded-xl bg-muted aspect-square">
                <img
                  src={productImages[selectedImage]}
                  alt="Product"
                  className="w-full h-full object-cover"
                />
                <button onClick={() => setSelectedImage((s) => (s - 1 + productImages.length) % productImages.length)} className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-card/80 backdrop-blur-sm flex items-center justify-center hover:bg-card transition-colors">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button onClick={() => setSelectedImage((s) => (s + 1) % productImages.length)} className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-card/80 backdrop-blur-sm flex items-center justify-center hover:bg-card transition-colors">
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
              <div className="flex gap-3">
                {productImages.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedImage(i)}
                    className={`w-20 h-20 rounded-lg overflow-hidden border-2 transition-all ${i === selectedImage ? "border-secondary" : "border-border hover:border-secondary/50"}`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </motion.div>

            {/* Product info */}
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-5">
              <div>
                <span className="text-xs font-semibold text-secondary uppercase tracking-wider">In Stock</span>
                <h1 className="text-2xl sm:text-3xl font-bold font-display text-foreground mt-1">Raspberry Pi 4 Model B 8GB</h1>
                <p className="text-sm text-muted-foreground mt-1">SKU: RPI4-8GB-001</p>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex">{[...Array(5)].map((_, i) => <Star key={i} className={`w-4 h-4 ${i < 5 ? "text-accent fill-accent" : "text-border"}`} />)}</div>
                <span className="text-sm text-muted-foreground">(124 reviews)</span>
              </div>

              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-bold text-foreground">Rs. 18,500</span>
                <span className="text-lg text-muted-foreground line-through">Rs. 22,000</span>
                <span className="bg-destructive/10 text-destructive text-xs font-bold px-2 py-0.5 rounded">-16%</span>
              </div>

              <p className="text-muted-foreground text-sm leading-relaxed">
                The Raspberry Pi 4 Model B with 8GB RAM is the most powerful Pi yet. Perfect for desktop computing, media centers, 
                IoT projects, and more. Features dual 4K HDMI output, USB 3.0, and Gigabit Ethernet.
              </p>

              {/* Quantity */}
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-foreground">Quantity:</span>
                <div className="flex items-center border border-border rounded-lg">
                  <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-10 h-10 flex items-center justify-center hover:bg-muted transition-colors rounded-l-lg">
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-12 text-center text-sm font-semibold">{quantity}</span>
                  <button onClick={() => setQuantity(quantity + 1)} className="w-10 h-10 flex items-center justify-center hover:bg-muted transition-colors rounded-r-lg">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <Button variant="default" size="lg" className="flex-1 gap-2">
                  <ShoppingCart className="w-4 h-4" /> Add to Cart
                </Button>
                <Button variant="outline" size="lg" className="gap-2">
                  <Heart className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="lg" className="gap-2">
                  <Share2 className="w-4 h-4" />
                </Button>
              </div>

              {/* Benefits */}
              <div className="grid grid-cols-3 gap-3 pt-4 border-t border-border">
                {[
                  { icon: Truck, label: "Free Shipping", sub: "Over Rs. 5,000" },
                  { icon: Shield, label: "Warranty", sub: "6 months" },
                  { icon: RotateCcw, label: "Returns", sub: "7-day policy" },
                ].map((b) => (
                  <div key={b.label} className="text-center">
                    <b.icon className="w-5 h-5 text-secondary mx-auto mb-1" />
                    <p className="text-xs font-semibold text-foreground">{b.label}</p>
                    <p className="text-[10px] text-muted-foreground">{b.sub}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Tabs */}
          <div className="border-b border-border mb-6">
            <div className="flex gap-6">
              {(["description", "specs", "reviews"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`pb-3 text-sm font-medium transition-colors border-b-2 capitalize ${
                    activeTab === tab ? "border-secondary text-secondary" : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab === "specs" ? "Specifications" : tab}
                </button>
              ))}
            </div>
          </div>

          {activeTab === "description" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="prose prose-sm max-w-none text-muted-foreground">
              <p>The Raspberry Pi 4 Model B 8GB represents a significant step forward, offering a level of performance comparable to entry-level x86 PC systems.</p>
              <p>Key features include a high-performance 64-bit quad-core processor, dual-display support via dual micro-HDMI ports at resolutions up to 4K, hardware video decode at up to 4Kp60, up to 8GB RAM, dual-band 2.4/5.0GHz wireless LAN, Bluetooth 5.0, Gigabit Ethernet, USB 3.0, and PoE capability via a separate PoE HAT.</p>
            </motion.div>
          )}

          {activeTab === "specs" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl">
              {specs.map((s, i) => (
                <div key={s.label} className={`flex justify-between py-3 text-sm ${i < specs.length - 1 ? "border-b border-border" : ""}`}>
                  <span className="font-medium text-foreground">{s.label}</span>
                  <span className="text-muted-foreground">{s.value}</span>
                </div>
              ))}
            </motion.div>
          )}

          {activeTab === "reviews" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 max-w-2xl">
              {reviews.map((r) => (
                <div key={r.name} className="bg-card rounded-xl border border-border p-5">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-secondary/10 flex items-center justify-center text-secondary font-bold text-sm">{r.name[0]}</div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{r.name}</p>
                        <p className="text-xs text-muted-foreground">{r.date}</p>
                      </div>
                    </div>
                    <div className="flex">{[...Array(5)].map((_, i) => <Star key={i} className={`w-3 h-3 ${i < r.rating ? "text-accent fill-accent" : "text-border"}`} />)}</div>
                  </div>
                  <p className="text-sm text-muted-foreground">{r.comment}</p>
                </div>
              ))}
            </motion.div>
          )}
        </div>
        <Footer />
      </main>
    </div>
  );
};

export default ProductDetail;
