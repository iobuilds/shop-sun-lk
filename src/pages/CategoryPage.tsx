import { useState, useMemo } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import SEOHead from "@/components/SEOHead";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ShoppingCart, Star, Heart, ChevronRight, SlidersHorizontal, X, ChevronDown, Package, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useCart } from "@/contexts/CartContext";
import { useWishlist } from "@/hooks/useWishlist";
import { useBranding } from "@/hooks/useBranding";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import CategorySpecFilters from "@/components/CategorySpecFilters";
import MicroElectronicsSearch from "@/components/MicroElectronicsSearch";
import type { Tables } from "@/integrations/supabase/types";

type Product = Tables<"products">;
type SortOption = "newest" | "price-low" | "price-high" | "rating" | "name";

const CategoryPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const { addItem } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const { storeName } = useBranding();
  const isComboPage = slug === "combo-packs";
  const isMicroElectronics = slug === "micro-electronics";

  // Filter/sort state
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 100000]);
  const [minRating, setMinRating] = useState(0);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [visibleCount, setVisibleCount] = useState(12);
  const [selectedSpecs, setSelectedSpecs] = useState<Record<string, string[]>>({});
  const [microSearchIds, setMicroSearchIds] = useState<Set<string> | null>(null);
  const PRODUCTS_PER_PAGE = 12;

  const { data: category, isLoading: catLoading } = useQuery({
    queryKey: ["category", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("slug", slug!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });

  // Fetch combo packs when on combo-packs page
  const { data: comboPacks, isLoading: combosLoading } = useQuery({
    queryKey: ["combo-packs-page"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("combo_packs")
        .select("*, combo_pack_items(*, products(id, name, price, images, slug))")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: isComboPage,
  });

  const { data: products, isLoading: prodsLoading } = useQuery({
    queryKey: ["category-products", category?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("category_id", category!.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!category?.id && !isComboPage,
  });

  // Compute max price for slider
  const maxPrice = useMemo(() => {
    if (!products || products.length === 0) return 100000;
    return Math.ceil(Math.max(...products.map((p) => p.price)) / 1000) * 1000;
  }, [products]);

  // Reset price range when products load
  useMemo(() => {
    setPriceRange([0, maxPrice]);
  }, [maxPrice]);

  // Filter & sort
  const filtered = useMemo(() => {
    if (!products) return [];
    let result = products.filter((p) => {
      if (p.price < priceRange[0] || p.price > priceRange[1]) return false;
      if (minRating > 0 && (p.rating || 0) < minRating) return false;
      if (inStockOnly && (p.stock_quantity || 0) <= 0) return false;
      // Micro Electronics search filter
      if (microSearchIds !== null && !microSearchIds.has(p.id)) return false;
      // Spec-based filtering
      for (const [key, values] of Object.entries(selectedSpecs)) {
        if (values.length === 0) continue;
        const specs = p.specifications as Record<string, string> | null;
        if (!specs) return false;
        const matchedKey = Object.keys(specs).find(
          (k) => k.toLowerCase() === key.toLowerCase()
        );
        if (!matchedKey || !values.includes(specs[matchedKey])) return false;
      }
      return true;
    });

    switch (sortBy) {
      case "price-low": result.sort((a, b) => a.price - b.price); break;
      case "price-high": result.sort((a, b) => b.price - a.price); break;
      case "rating": result.sort((a, b) => (b.rating || 0) - (a.rating || 0)); break;
      case "name": result.sort((a, b) => a.name.localeCompare(b.name)); break;
      default: break;
    }
    return result;
  }, [products, sortBy, priceRange, minRating, inStockOnly, selectedSpecs, microSearchIds]);

  // Reset pagination when filters/sort change
  useMemo(() => {
    setVisibleCount(PRODUCTS_PER_PAGE);
  }, [sortBy, priceRange, minRating, inStockOnly, selectedSpecs]);

  const visibleProducts = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  const specFilterCount = Object.values(selectedSpecs).filter((v) => v.length > 0).length;
  const activeFilterCount = [
    priceRange[0] > 0 || priceRange[1] < maxPrice,
    minRating > 0,
    inStockOnly,
  ].filter(Boolean).length + specFilterCount;

  const clearFilters = () => {
    setPriceRange([0, maxPrice]);
    setMinRating(0);
    setInStockOnly(false);
    setSelectedSpecs({});
  };

  const isLoading = catLoading || prodsLoading || (isComboPage && combosLoading);

  // Redirect micro-electronics to the dedicated parametric catalog page
  if (isMicroElectronics) return <Navigate to="/micro-electronics" replace />;

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={`${category?.name || "Category"} — Buy Online | ${storeName} Sri Lanka`}
        description={category?.description || `Browse ${category?.name || "products"} at ${storeName} — Sri Lanka's leading electronics supplier. Best prices, island-wide delivery.`}
        keywords={`${category?.name || ""}, buy ${category?.name || "electronics"} Sri Lanka, electronics, components, ${storeName}, best price, online store`}
        canonical={`${window.location.origin}/category/${slug}`}
        ogImage={category?.image_url || undefined}
        jsonLd={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "CollectionPage",
              name: `${category?.name || "Category"} — ${storeName}`,
              description: category?.description || `Browse ${category?.name || "products"} at ${storeName} Sri Lanka`,
              url: `${window.location.origin}/category/${slug}`,
              isPartOf: { "@id": `${window.location.origin}/#website` },
            },
            ...(filtered && filtered.length > 0 ? [{
              "@type": "ItemList",
              itemListElement: filtered.slice(0, 20).map((p: any, i: number) => ({
                "@type": "ListItem",
                position: i + 1,
                url: `${window.location.origin}/product/${p.slug}`,
                name: p.name,
              })),
            }] : []),
            {
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "Home", item: window.location.origin },
                { "@type": "ListItem", position: 2, name: category?.name || "Category" },
              ],
            },
          ],
        }}
      />
      <Navbar />
      <main className="pt-[136px] md:pt-[160px]">
        <div className="container mx-auto px-4 py-8">
          {/* Breadcrumb */}
          <nav className="text-sm text-muted-foreground mb-6 flex items-center gap-2">
            <Link to="/" className="hover:text-secondary transition-colors">Home</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-foreground">{category?.name || "Category"}</span>
          </nav>

          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold font-display text-foreground">{category?.name || "Category"}</h1>
            {category?.description && (
              <p className="text-muted-foreground mt-2">{category.description}</p>
            )}
          </div>

          {/* Combo Packs Grid */}
          {isComboPage && comboPacks && comboPacks.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
              {comboPacks.map((combo: any, i: number) => {
                const savings = combo.original_price - combo.combo_price;
                const savingsPercent = combo.original_price > 0 ? Math.round((savings / combo.original_price) * 100) : 0;
                const items = combo.combo_pack_items || [];
                return (
                  <motion.div
                    key={combo.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="bg-card rounded-xl border border-border overflow-hidden group hover:shadow-md transition-shadow"
                  >
                    <div className="relative">
                      <img
                        src={combo.images?.[0] || items[0]?.products?.images?.[0] || "/placeholder.svg"}
                        alt={combo.name}
                        className="w-full aspect-[4/3] object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                      {savingsPercent > 0 && (
                        <span className="absolute top-3 left-3 bg-destructive text-destructive-foreground text-xs font-bold px-2.5 py-1 rounded-md">
                          Save {savingsPercent}%
                        </span>
                      )}
                      <span className="absolute top-3 right-3 bg-secondary text-secondary-foreground text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider flex items-center gap-1">
                        <Package className="w-3 h-3" /> Combo
                      </span>
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold text-foreground mb-1 line-clamp-1">{combo.name}</h3>
                      {combo.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{combo.description}</p>
                      )}
                      <div className="text-xs text-muted-foreground mb-3">
                        {items.slice(0, 3).map((item: any) => (
                          <span key={item.id} className="inline-block bg-muted px-2 py-0.5 rounded mr-1 mb-1">
                            {item.products?.name} ×{item.quantity}
                          </span>
                        ))}
                        {items.length > 3 && <span className="text-muted-foreground">+{items.length - 3} more</span>}
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-lg font-bold text-foreground">Rs. {combo.combo_price.toLocaleString()}</span>
                          {combo.original_price > combo.combo_price && (
                            <span className="block text-xs text-muted-foreground line-through">Rs. {combo.original_price.toLocaleString()}</span>
                          )}
                        </div>
                        <Button
                          size="sm"
                          className="gap-1.5"
                          onClick={() => {
                            items.forEach((item: any) => {
                              if (item.products) {
                                addItem({
                                  id: item.products.id,
                                  name: item.products.name,
                                  price: Math.round(combo.combo_price / items.length),
                                  image: item.products.images?.[0] || "/placeholder.svg",
                                  slug: item.products.slug,
                                }, item.quantity);
                              }
                            });
                          }}
                        >
                          <ShoppingCart className="w-3.5 h-3.5" /> Add All
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          {isComboPage && (!comboPacks || comboPacks.length === 0) && !isLoading && (
            <div className="text-center py-16">
              <Package className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-30" />
              <p className="text-muted-foreground">No combo packs available yet.</p>
            </div>
          )}

          {/* Sort & Filter bar + Product grid - only for non-combo pages */}
          {!isComboPage && (<>

          {/* ── Micro Electronics special search ── */}
          {isMicroElectronics && products && (
            <MicroElectronicsSearch
              products={products}
              onFilteredChange={(ids) => setMicroSearchIds(ids)}
            />
          )}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => setShowFilters(!showFilters)}
              >
                <SlidersHorizontal className="w-4 h-4" />
                Filters
                {activeFilterCount > 0 && (
                  <span className="w-5 h-5 rounded-full bg-secondary text-secondary-foreground text-[10px] font-bold flex items-center justify-center">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
              {activeFilterCount > 0 && (
                <button onClick={clearFilters} className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                  <X className="w-3 h-3" /> Clear all
                </button>
              )}
              <span className="text-sm text-muted-foreground">
                {filtered.length} product{filtered.length !== 1 ? "s" : ""}
              </span>
            </div>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
              <SelectTrigger className="w-[180px] h-9 text-sm">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="price-low">Price: Low to High</SelectItem>
                <SelectItem value="price-high">Price: High to Low</SelectItem>
                <SelectItem value="rating">Highest Rated</SelectItem>
                <SelectItem value="name">Name: A to Z</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Active spec filter chips */}
          {specFilterCount > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {Object.entries(selectedSpecs).map(([key, values]) =>
                values.map((val) => (
                  <span
                    key={`${key}-${val}`}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary/10 text-secondary text-xs font-medium"
                  >
                    {key}: {val}
                    <button
                      onClick={() => {
                        const updated = values.filter((v) => v !== val);
                        setSelectedSpecs((prev) => ({ ...prev, [key]: updated }));
                      }}
                      className="hover:text-foreground"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))
              )}
            </div>
          )}

          <div className="flex gap-6">
            {/* Filter sidebar */}
            {showFilters && (
              <motion.aside
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="w-64 shrink-0 hidden md:block"
              >
                <div className="bg-card rounded-xl border border-border p-5 space-y-6 sticky top-44">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-foreground text-sm">Filters</h3>
                    <button onClick={() => setShowFilters(false)} className="p-1 hover:bg-muted rounded-md text-muted-foreground">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Price Range */}
                  <div>
                    <Label className="text-sm font-medium text-foreground mb-3 block">Price Range</Label>
                    <Slider
                      min={0}
                      max={maxPrice}
                      step={500}
                      value={priceRange}
                      onValueChange={(v) => setPriceRange(v as [number, number])}
                      className="mb-2"
                    />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Rs. {priceRange[0].toLocaleString()}</span>
                      <span>Rs. {priceRange[1].toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Rating */}
                  <div>
                    <Label className="text-sm font-medium text-foreground mb-3 block">Minimum Rating</Label>
                    <div className="flex gap-1">
                      {[0, 1, 2, 3, 4].map((r) => (
                        <button
                          key={r}
                          onClick={() => setMinRating(r === minRating ? 0 : r)}
                          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            minRating === r && r > 0
                              ? "bg-secondary/10 text-secondary border border-secondary/30"
                              : "bg-muted text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {r === 0 ? "All" : (
                            <>
                              {r}+ <Star className="w-3 h-3 fill-accent text-accent" />
                            </>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* In Stock */}
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium text-foreground">In Stock Only</Label>
                    <Switch checked={inStockOnly} onCheckedChange={setInStockOnly} />
                  </div>

                  {/* Category-specific spec filters */}
                  {slug && products && (
                    <CategorySpecFilters
                      categorySlug={slug}
                      products={products}
                      selectedSpecs={selectedSpecs}
                      onSpecChange={(key, values) => setSelectedSpecs((prev) => ({ ...prev, [key]: values }))}
                      onClearAll={() => setSelectedSpecs({})}
                    />
                  )}
                </div>
              </motion.aside>
            )}

            {/* Mobile filter drawer */}
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="md:hidden bg-card rounded-xl border border-border p-5 space-y-5 mb-4 w-full"
              >
                {/* Price Range */}
                <div>
                  <Label className="text-sm font-medium text-foreground mb-3 block">Price Range</Label>
                  <Slider
                    min={0}
                    max={maxPrice}
                    step={500}
                    value={priceRange}
                    onValueChange={(v) => setPriceRange(v as [number, number])}
                    className="mb-2"
                  />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Rs. {priceRange[0].toLocaleString()}</span>
                    <span>Rs. {priceRange[1].toLocaleString()}</span>
                  </div>
                </div>
                {/* Rating */}
                <div>
                  <Label className="text-sm font-medium text-foreground mb-3 block">Minimum Rating</Label>
                  <div className="flex gap-1 flex-wrap">
                    {[0, 1, 2, 3, 4].map((r) => (
                      <button
                        key={r}
                        onClick={() => setMinRating(r === minRating ? 0 : r)}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          minRating === r && r > 0
                            ? "bg-secondary/10 text-secondary border border-secondary/30"
                            : "bg-muted text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {r === 0 ? "All" : <>{r}+ <Star className="w-3 h-3 fill-accent text-accent" /></>}
                      </button>
                    ))}
                  </div>
                </div>
                {/* In Stock */}
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-foreground">In Stock Only</Label>
                  <Switch checked={inStockOnly} onCheckedChange={setInStockOnly} />
                </div>

                {/* Category-specific spec filters (mobile) */}
                {slug && products && (
                  <CategorySpecFilters
                    categorySlug={slug}
                    products={products}
                    selectedSpecs={selectedSpecs}
                    onSpecChange={(key, values) => setSelectedSpecs((prev) => ({ ...prev, [key]: values }))}
                    onClearAll={() => setSelectedSpecs({})}
                  />
                )}
              </motion.div>
            )}

            {/* Product grid */}
            <div className="flex-1 min-w-0">
              {isLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {[...Array(8)].map((_, i) => (
                    <div key={i} className="bg-card rounded-xl border border-border animate-pulse">
                      <div className="aspect-square bg-muted rounded-t-xl" />
                      <div className="p-3 space-y-2">
                        <div className="h-4 bg-muted rounded w-3/4" />
                        <div className="h-3 bg-muted rounded w-1/2" />
                        <div className="h-5 bg-muted rounded w-1/3" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filtered.length > 0 ? (
                <>
                  <div className={`grid grid-cols-2 sm:grid-cols-3 ${showFilters ? "lg:grid-cols-3" : "lg:grid-cols-4"} gap-4`}>
                    {visibleProducts.map((product, i) => (
                      <motion.div
                        key={product.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(i, 11) * 0.03, duration: 0.3 }}
                      >
                        <Link
                          to={`/product/${product.slug}`}
                          className="group bg-card rounded-xl border border-border card-elevated overflow-hidden cursor-pointer block"
                        >
                          <div className="relative overflow-hidden">
                            <img
                              src={product.images?.[0] || "/placeholder.svg"}
                              alt={product.name}
                              className="w-full aspect-square object-cover group-hover:scale-105 transition-transform duration-500"
                              loading="lazy"
                            />
                            {product.is_featured && (
                              <span className="absolute top-2 left-2 bg-secondary text-secondary-foreground text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider">
                                Featured
                              </span>
                            )}
                            <button
                              onClick={(e) => { e.preventDefault(); toggleWishlist(product.id); }}
                              className={`absolute top-2 right-2 w-8 h-8 rounded-full bg-card/80 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 ${
                                isInWishlist(product.id) ? "text-destructive" : "text-muted-foreground hover:text-destructive"
                              }`}
                            >
                              <Heart className={`w-4 h-4 ${isInWishlist(product.id) ? "fill-current" : ""}`} />
                            </button>
                            {product.discount_price && product.discount_price > product.price && (
                              <span className="absolute bottom-2 left-2 bg-destructive text-destructive-foreground text-[10px] font-bold px-2 py-0.5 rounded-md">
                                Save Rs. {(product.discount_price - product.price).toLocaleString()}
                              </span>
                            )}
                          </div>
                          <div className="p-3">
                            <h3 className="text-sm font-medium text-foreground line-clamp-2 mb-1.5 min-h-[2.5rem] group-hover:text-secondary transition-colors">
                              {product.name}
                            </h3>
                            <div className="flex items-center gap-1 mb-2">
                              <div className="flex items-center">
                                {[...Array(5)].map((_, j) => (
                                  <Star key={j} className={`w-3 h-3 ${j < Math.floor(product.rating || 0) ? "text-accent fill-accent" : "text-border"}`} />
                                ))}
                              </div>
                              <span className="text-[10px] text-muted-foreground">({product.review_count || 0})</span>
                            </div>
                            {/* SKU / part number for micro-electronics */}
                            {isMicroElectronics && product.sku && (
                              <p className="text-[10px] text-muted-foreground font-mono mb-1.5 truncate">
                                {product.sku}
                              </p>
                            )}
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="text-base font-bold text-foreground">Rs. {product.price.toLocaleString()}</span>
                                {product.discount_price && (
                                  <span className="block text-[11px] text-muted-foreground line-through">
                                    Rs. {product.discount_price.toLocaleString()}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5">
                                {isMicroElectronics && product.datasheet_url && (
                                  <a
                                    href={product.datasheet_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    title="View Datasheet"
                                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-muted text-muted-foreground hover:bg-secondary/10 hover:text-secondary transition-all duration-200"
                                  >
                                    <FileText className="w-3.5 h-3.5" />
                                  </a>
                                )}
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    addItem({
                                      id: product.id,
                                      name: product.name,
                                      price: product.price,
                                      image: product.images?.[0] || "/placeholder.svg",
                                      slug: product.slug,
                                    });
                                  }}
                                  className="w-9 h-9 flex items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-secondary hover:text-secondary-foreground transition-all duration-300"
                                >
                                  <ShoppingCart className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </Link>
                      </motion.div>
                    ))}
                  </div>
                  {/* Load More / Progress */}
                  <div className="mt-8 text-center space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Showing {visibleProducts.length} of {filtered.length} products
                    </p>
                    {hasMore && (
                      <Button
                        variant="outline"
                        onClick={() => setVisibleCount((c) => c + PRODUCTS_PER_PAGE)}
                        className="px-8"
                      >
                        Load More
                      </Button>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-center py-16">
                  <p className="text-muted-foreground">No products match your filters.</p>
                  <button onClick={clearFilters} className="text-secondary hover:underline text-sm mt-2 inline-block">
                    Clear filters
                  </button>
                </div>
              )}
            </div>
          </div>
          </>)}
        </div>
        <Footer />
      </main>
    </div>
  );
};

export default CategoryPage;
