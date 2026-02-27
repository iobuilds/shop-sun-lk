import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Star, ShoppingCart, Heart, ChevronLeft, ChevronRight, Minus, Plus, Truck, Shield, RotateCcw, Share2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import type { Json } from "@/integrations/supabase/types";
import { useCart } from "@/contexts/CartContext";
import { useWishlist } from "@/hooks/useWishlist";

const ProductDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<"description" | "specs" | "reviews">("description");
  const { addItem } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();

  const { data: product, isLoading } = useQuery({
    queryKey: ["product", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*, categories(name, slug)")
        .eq("slug", slug!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });

  const { data: reviews } = useQuery({
    queryKey: ["reviews", product?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select("*")
        .eq("product_id", product!.id)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
    enabled: !!product?.id,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="pt-[136px] md:pt-[160px]">
          <div className="container mx-auto px-4 py-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="aspect-square bg-muted rounded-xl animate-pulse" />
              <div className="space-y-4">
                <div className="h-4 bg-muted rounded w-20" />
                <div className="h-8 bg-muted rounded w-3/4" />
                <div className="h-10 bg-muted rounded w-1/3" />
                <div className="h-20 bg-muted rounded" />
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="pt-[136px] md:pt-[160px] flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold font-display text-foreground mb-2">Product Not Found</h1>
            <p className="text-muted-foreground">The product you're looking for doesn't exist.</p>
          </div>
        </main>
      </div>
    );
  }

  const images = product.images?.length ? product.images : ["/placeholder.svg"];
  const specs = product.specifications as Record<string, string> | null;
  const category = product.categories as any;
  const discount = product.discount_price ? Math.round(((product.discount_price - product.price) / product.discount_price) * 100) : 0;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-[136px] md:pt-[160px]">
        <div className="container mx-auto px-4 py-8">
          {/* Breadcrumb */}
          <nav className="text-sm text-muted-foreground mb-6 flex items-center gap-2">
            <a href="/" className="hover:text-secondary transition-colors">Home</a>
            <span>/</span>
            {category && (
              <>
                <a href={`/category/${category.slug}`} className="hover:text-secondary transition-colors">{category.name}</a>
                <span>/</span>
              </>
            )}
            <span className="text-foreground">{product.name}</span>
          </nav>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
            {/* Image gallery */}
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
              <div className="relative overflow-hidden rounded-xl bg-muted aspect-square">
                <img src={images[selectedImage]} alt={product.name} className="w-full h-full object-cover" />
                {images.length > 1 && (
                  <>
                    <button onClick={() => setSelectedImage((s) => (s - 1 + images.length) % images.length)} className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-card/80 backdrop-blur-sm flex items-center justify-center hover:bg-card transition-colors">
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button onClick={() => setSelectedImage((s) => (s + 1) % images.length)} className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-card/80 backdrop-blur-sm flex items-center justify-center hover:bg-card transition-colors">
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </>
                )}
              </div>
              {images.length > 1 && (
                <div className="flex gap-3">
                  {images.map((img, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedImage(i)}
                      className={`w-20 h-20 rounded-lg overflow-hidden border-2 transition-all ${i === selectedImage ? "border-secondary" : "border-border hover:border-secondary/50"}`}
                    >
                      <img src={img} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </motion.div>

            {/* Product info */}
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-5">
              <div>
                <span className={`text-xs font-semibold uppercase tracking-wider ${(product.stock_quantity || 0) > 0 ? "text-secondary" : "text-destructive"}`}>
                  {(product.stock_quantity || 0) > 0 ? "In Stock" : "Out of Stock"}
                </span>
                <h1 className="text-2xl sm:text-3xl font-bold font-display text-foreground mt-1">{product.name}</h1>
                {product.sku && <p className="text-sm text-muted-foreground mt-1">SKU: {product.sku}</p>}
              </div>

              <div className="flex items-center gap-2">
                <div className="flex">{[...Array(5)].map((_, i) => <Star key={i} className={`w-4 h-4 ${i < Math.floor(product.rating || 0) ? "text-accent fill-accent" : "text-border"}`} />)}</div>
                <span className="text-sm text-muted-foreground">({product.review_count || 0} reviews)</span>
              </div>

              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-bold text-foreground">Rs. {product.price.toLocaleString()}</span>
                {product.discount_price && (
                  <>
                    <span className="text-lg text-muted-foreground line-through">Rs. {product.discount_price.toLocaleString()}</span>
                    <span className="bg-destructive/10 text-destructive text-xs font-bold px-2 py-0.5 rounded">-{discount}%</span>
                  </>
                )}
              </div>

              {product.description && (
                <p className="text-muted-foreground text-sm leading-relaxed">{product.description}</p>
              )}

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
                <Button
                  variant="default"
                  size="lg"
                  className="flex-1 gap-2"
                  disabled={(product.stock_quantity || 0) === 0}
                  onClick={() => {
                    addItem({
                      id: product.id,
                      name: product.name,
                      price: product.price,
                      image: images[0],
                      slug: product.slug,
                    }, quantity);
                    setQuantity(1);
                  }}
                >
                  <ShoppingCart className="w-4 h-4" /> Add to Cart
                </Button>
                <Button variant="outline" size="lg" onClick={() => toggleWishlist(product.id)} className={isInWishlist(product.id) ? "text-destructive border-destructive/30" : ""}><Heart className={`w-4 h-4 ${isInWishlist(product.id) ? "fill-current" : ""}`} /></Button>
                <Button variant="outline" size="lg"><Share2 className="w-4 h-4" /></Button>
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

          {activeTab === "description" && product.description && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="prose prose-sm max-w-none text-muted-foreground">
              <p>{product.description}</p>
            </motion.div>
          )}

          {activeTab === "specs" && specs && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl">
              {Object.entries(specs).map(([key, value], i, arr) => (
                <div key={key} className={`flex justify-between py-3 text-sm ${i < arr.length - 1 ? "border-b border-border" : ""}`}>
                  <span className="font-medium text-foreground">{key}</span>
                  <span className="text-muted-foreground">{value}</span>
                </div>
              ))}
            </motion.div>
          )}

          {activeTab === "reviews" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 max-w-2xl">
              {reviews && reviews.length > 0 ? reviews.map((r) => (
                <div key={r.id} className="bg-card rounded-xl border border-border p-5">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-secondary/10 flex items-center justify-center text-secondary font-bold text-sm">U</div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">Customer</p>
                        <p className="text-xs text-muted-foreground">{new Date(r.created_at!).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="flex">{[...Array(5)].map((_, i) => <Star key={i} className={`w-3 h-3 ${i < r.rating ? "text-accent fill-accent" : "text-border"}`} />)}</div>
                  </div>
                  {r.comment && <p className="text-sm text-muted-foreground">{r.comment}</p>}
                </div>
              )) : (
                <p className="text-muted-foreground text-sm">No reviews yet. Be the first to review this product!</p>
              )}
            </motion.div>
          )}
        </div>
        <Footer />
      </main>
    </div>
  );
};

export default ProductDetail;
