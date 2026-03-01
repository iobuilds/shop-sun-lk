import { useState } from "react";
import SEOHead from "@/components/SEOHead";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Star, ShoppingCart, Heart, ChevronLeft, ChevronRight, Minus, Plus, Truck, Shield, RotateCcw, Share2, Video, FileDown, Clock, ExternalLink, Link2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import type { Json } from "@/integrations/supabase/types";
import { useCart } from "@/contexts/CartContext";
import { useWishlist } from "@/hooks/useWishlist";
import { useRecentlyViewed } from "@/hooks/useRecentlyViewed";

const ProductDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<"description" | "specs" | "reviews" | "documents">("description");
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

  const { data: relatedProducts } = useQuery({
    queryKey: ["related-products", product?.category_id, product?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("category_id", product!.category_id!)
        .neq("id", product!.id)
        .eq("is_active", true)
        .order("rating", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
    enabled: !!product?.id && !!product?.category_id,
  });

  // External links
  const { data: externalLinks } = useQuery({
    queryKey: ["product-external-links-public", product?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_external_links" as any)
        .select("*")
        .eq("product_id", product!.id)
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data as any[];
    },
    enabled: !!product?.id,
  });

  // Similar products
  const { data: similarProducts } = useQuery({
    queryKey: ["product-similar-public", product?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_similar_items" as any)
        .select("*, products:similar_product_id(id, name, slug, price, discount_price, images, rating, review_count)")
        .eq("product_id", product!.id);
      if (error) throw error;
      return data as any[];
    },
    enabled: !!product?.id,
  });

  const recentlyViewed = useRecentlyViewed(product || undefined);

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
  const videoUrl = (product as any).video_url as string | null;
  const datasheetUrl = (product as any).datasheet_url as string | null;
  const hasDocuments = !!videoUrl || !!datasheetUrl;

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={`${product.name} | TechLK`}
        description={product.description?.slice(0, 160) || `Buy ${product.name} at TechLK Sri Lanka`}
        keywords={`${product.name}, ${category?.name || "electronics"}, buy online, Sri Lanka, TechLK`}
        canonical={`${window.location.origin}/product/${product.slug}`}
        ogImage={images[0] !== "/placeholder.svg" ? images[0] : undefined}
        ogType="product"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Product",
          name: product.name,
          description: product.description,
          image: images[0],
          sku: product.sku,
          offers: {
            "@type": "Offer",
            price: product.price,
            priceCurrency: "LKR",
            availability: (product.stock_quantity || 0) > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
          },
          aggregateRating: product.review_count ? {
            "@type": "AggregateRating",
            ratingValue: product.rating,
            reviewCount: product.review_count,
          } : undefined,
        }}
      />
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

              {/* Shipping & Delivery Info */}
              <div className="bg-muted/50 rounded-xl p-4 space-y-3 border border-border">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-base">🇱🇰</span>
                  <span className="font-medium text-foreground">Ships From: Colombo, Sri Lanka</span>
                  <span className="ml-auto bg-secondary/10 text-secondary text-[10px] font-bold px-2 py-0.5 rounded-md">Local</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center">
                    <Truck className="w-5 h-5 text-secondary mx-auto mb-1" />
                    <p className="text-xs font-semibold text-foreground">
                      {product.price >= 5000 ? "Free Shipping" : "Rs. 350"}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {product.price >= 5000 ? "Included" : "Delivery fee"}
                    </p>
                  </div>
                  <div className="text-center">
                    <Clock className="w-5 h-5 text-secondary mx-auto mb-1" />
                    <p className="text-xs font-semibold text-foreground">ETA: 2-4 Days</p>
                    <p className="text-[10px] text-muted-foreground">After payment</p>
                  </div>
                  <div className="text-center">
                    <Shield className="w-5 h-5 text-secondary mx-auto mb-1" />
                    <p className="text-xs font-semibold text-foreground">Warranty</p>
                    <p className="text-[10px] text-muted-foreground">6 months</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Tabs */}
          <div className="border-b border-border mb-6">
            <div className="flex gap-6">
              {(["description", "specs", ...(hasDocuments ? ["documents" as const] : []), "reviews"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`pb-3 text-sm font-medium transition-colors border-b-2 capitalize ${
                    activeTab === tab ? "border-secondary text-secondary" : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab === "specs" ? "Specifications" : tab === "documents" ? "වීඩියෝ / ලේඛන" : tab}
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

          {activeTab === "documents" && hasDocuments && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl space-y-6">
              {videoUrl && (
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Video className="w-4 h-4 text-secondary" /> නිෂ්පාදන වීඩියෝ / Product Video
                  </h3>
                  <div className="aspect-video rounded-xl overflow-hidden bg-muted border border-border">
                    {videoUrl.includes("youtube.com") || videoUrl.includes("youtu.be") ? (
                      <iframe
                        src={videoUrl.replace("watch?v=", "embed/").replace("youtu.be/", "youtube.com/embed/")}
                        className="w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        title="Product video"
                      />
                    ) : (
                      <video src={videoUrl} controls className="w-full h-full object-cover" />
                    )}
                  </div>
                </div>
              )}
              {datasheetUrl && (
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <FileDown className="w-4 h-4 text-secondary" /> Datasheet / තාක්ෂණික ලේඛනය
                  </h3>
                  <a
                    href={datasheetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-3 bg-card border border-border rounded-xl hover:bg-muted transition-colors text-sm font-medium text-foreground"
                  >
                    <FileDown className="w-5 h-5 text-secondary" />
                    <div>
                      <p>Datasheet බාගන්න / Download Datasheet</p>
                      <p className="text-xs text-muted-foreground">PDF ලේඛනය බලන්න</p>
                    </div>
                  </a>
                </div>
              )}
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

        {/* International Links */}
        {externalLinks && externalLinks.length > 0 && (
          <div className="container mx-auto px-4 py-8 border-t border-border">
            <h2 className="text-lg font-bold font-display text-foreground mb-4 flex items-center gap-2">
              <ExternalLink className="w-5 h-5 text-secondary" /> International Links
            </h2>
            <div className="flex flex-wrap gap-2">
              {externalLinks.map((link: any) => (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-card border border-border rounded-xl hover:bg-muted transition-colors text-sm"
                >
                  <ExternalLink className="w-4 h-4 text-secondary" />
                  <div>
                    <p className="font-medium text-foreground">{link.label}</p>
                    <p className="text-[10px] text-muted-foreground capitalize">{link.link_type}</p>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Similar / Alternative Products */}
        {similarProducts && similarProducts.length > 0 && (
          <div className="container mx-auto px-4 py-8 border-t border-border">
            <h2 className="text-lg font-bold font-display text-foreground mb-4 flex items-center gap-2">
              <Link2 className="w-5 h-5 text-secondary" /> Similar Items / Alternatives
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {similarProducts.map((item: any, i: number) => {
                const sp = item.products;
                if (!sp) return null;
                return (
                  <motion.div key={item.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                    <Link to={`/product/${sp.slug}`} className="group bg-card rounded-xl border border-border overflow-hidden block hover:shadow-md transition-shadow">
                      <div className="relative overflow-hidden">
                        <img src={sp.images?.[0] || "/placeholder.svg"} alt={sp.name} className="w-full aspect-square object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                        <span className="absolute top-2 left-2 bg-accent/80 text-accent-foreground text-[9px] font-bold px-2 py-0.5 rounded-md capitalize">{item.relation_type}</span>
                      </div>
                      <div className="p-3">
                        <h3 className="text-sm font-medium text-foreground line-clamp-2 mb-1 min-h-[2.5rem] group-hover:text-secondary transition-colors">{sp.name}</h3>
                        <div className="flex items-center gap-1 mb-1">
                          <div className="flex">{[...Array(5)].map((_, j) => <Star key={j} className={`w-3 h-3 ${j < Math.floor(sp.rating || 0) ? "text-accent fill-accent" : "text-border"}`} />)}</div>
                          <span className="text-[10px] text-muted-foreground">({sp.review_count || 0})</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-foreground">Rs. {sp.price?.toLocaleString()}</span>
                          {sp.discount_price && <span className="text-[11px] text-muted-foreground line-through">Rs. {sp.discount_price.toLocaleString()}</span>}
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {/* Related Products */}
        {relatedProducts && relatedProducts.length > 0 && (
          <div className="container mx-auto px-4 py-10 border-t border-border">
            <h2 className="text-xl font-bold font-display text-foreground mb-5">You May Also Like</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {relatedProducts.map((rp, i) => (
                <motion.div
                  key={rp.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <Link
                    to={`/product/${rp.slug}`}
                    className="group bg-card rounded-xl border border-border overflow-hidden block hover:shadow-md transition-shadow"
                  >
                    <div className="relative overflow-hidden">
                      <img
                        src={rp.images?.[0] || "/placeholder.svg"}
                        alt={rp.name}
                        className="w-full aspect-square object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                      <button
                        onClick={(e) => { e.preventDefault(); toggleWishlist(rp.id); }}
                        className={`absolute top-2 right-2 w-8 h-8 rounded-full bg-card/80 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 ${
                          isInWishlist(rp.id) ? "text-destructive" : "text-muted-foreground hover:text-destructive"
                        }`}
                      >
                        <Heart className={`w-4 h-4 ${isInWishlist(rp.id) ? "fill-current" : ""}`} />
                      </button>
                    </div>
                    <div className="p-3">
                      <h3 className="text-sm font-medium text-foreground line-clamp-2 mb-1 min-h-[2.5rem] group-hover:text-secondary transition-colors">
                        {rp.name}
                      </h3>
                      <div className="flex items-center gap-1 mb-1">
                        <div className="flex">
                          {[...Array(5)].map((_, j) => (
                            <Star key={j} className={`w-3 h-3 ${j < Math.floor(rp.rating || 0) ? "text-accent fill-accent" : "text-border"}`} />
                          ))}
                        </div>
                        <span className="text-[10px] text-muted-foreground">({rp.review_count || 0})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-foreground">Rs. {rp.price.toLocaleString()}</span>
                        {rp.discount_price && (
                          <span className="text-[11px] text-muted-foreground line-through">Rs. {rp.discount_price.toLocaleString()}</span>
                        )}
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Recently Viewed */}
        {recentlyViewed.length > 0 && (
          <div className="container mx-auto px-4 py-10">
            <h2 className="text-xl font-bold font-display text-foreground mb-5">Recently Viewed</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {recentlyViewed.slice(0, 5).map((p, i) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <Link
                    to={`/product/${p.slug}`}
                    className="group bg-card rounded-xl border border-border overflow-hidden block hover:shadow-md transition-shadow"
                  >
                    <img
                      src={p.image}
                      alt={p.name}
                      className="w-full aspect-square object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                    <div className="p-3">
                      <h3 className="text-sm font-medium text-foreground line-clamp-2 mb-1 min-h-[2.5rem] group-hover:text-secondary transition-colors">
                        {p.name}
                      </h3>
                      <div className="flex items-center gap-1 mb-1">
                        <div className="flex">
                          {[...Array(5)].map((_, j) => (
                            <Star key={j} className={`w-3 h-3 ${j < Math.floor(p.rating || 0) ? "text-accent fill-accent" : "text-border"}`} />
                          ))}
                        </div>
                        <span className="text-[10px] text-muted-foreground">({p.review_count || 0})</span>
                      </div>
                      <span className="text-sm font-bold text-foreground">Rs. {p.price.toLocaleString()}</span>
                      {p.discount_price && (
                        <span className="ml-2 text-[11px] text-muted-foreground line-through">Rs. {p.discount_price.toLocaleString()}</span>
                      )}
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        <Footer />
      </main>
    </div>
  );
};

export default ProductDetail;
