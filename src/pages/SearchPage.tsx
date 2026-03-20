import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, Link } from "react-router-dom";
import { ShoppingCart, Star, Heart, Search as SearchIcon } from "lucide-react";
import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useCart } from "@/contexts/CartContext";
import { Input } from "@/components/ui/input";

const SearchPage = () => {
  const params = new URLSearchParams(window.location.search);
  const initialQ = params.get("q") || "";
  const [query, setQuery] = useState(initialQ);
  const { addItem } = useCart();
  const loggedRef = useRef<string>("");

  const { data: products, isLoading } = useQuery({
    queryKey: ["search-results", query],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("is_active", true)
        .or(`name.ilike.%${query}%,description.ilike.%${query}%`)
        .order("created_at", { ascending: false })
        .limit(24);
      if (error) throw error;
      return data;
    },
    enabled: query.length >= 2,
  });

  // Log search once per unique query
  useEffect(() => {
    if (query.length >= 2 && products !== undefined && loggedRef.current !== query) {
      loggedRef.current = query;
      supabase.from("search_logs" as any).insert({
        query: query.trim().toLowerCase(),
        result_count: products?.length || 0,
        user_id: null,
      });
    }
  }, [query, products]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-[136px] md:pt-[160px]">
        <div className="container mx-auto px-3 sm:px-4 py-6 sm:py-8">
          <h1 className="text-2xl font-bold font-display text-foreground mb-2">
            Search Results
          </h1>
          <p className="text-muted-foreground text-sm mb-6">
            {products ? `${products.length} results for "${query}"` : `Searching for "${query}"...`}
          </p>

          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="bg-card rounded-xl border border-border animate-pulse">
                  <div className="aspect-square bg-muted rounded-t-xl" />
                  <div className="p-3 space-y-2">
                    <div className="h-4 bg-muted rounded w-3/4" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : products && products.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {products.map((product, i) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.4 }}
                >
                  <Link
                    to={`/product/${product.slug}`}
                    className="group bg-card rounded-xl border border-border card-elevated overflow-hidden cursor-pointer block"
                  >
                    <div className="relative overflow-hidden">
                      <img src={product.images?.[0] || "/placeholder.svg"} alt={product.name} className="w-full aspect-square object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                      {product.discount_price && product.discount_price > product.price && (
                        <span className="absolute bottom-2 left-2 bg-destructive text-destructive-foreground text-[10px] font-bold px-2 py-0.5 rounded-md">
                          Save Rs. {(product.discount_price - product.price).toLocaleString()}
                        </span>
                      )}
                    </div>
                    <div className="p-3">
                      <h3 className="text-sm font-medium text-foreground line-clamp-2 mb-1.5 min-h-[2.5rem] group-hover:text-secondary transition-colors">{product.name}</h3>
                      <div className="flex items-center gap-1 mb-2">
                        <div className="flex">{[...Array(5)].map((_, j) => <Star key={j} className={`w-3 h-3 ${j < Math.floor(product.rating || 0) ? "text-accent fill-accent" : "text-border"}`} />)}</div>
                        <span className="text-[10px] text-muted-foreground">({product.review_count || 0})</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-base font-bold text-foreground">Rs. {product.price.toLocaleString()}</span>
                          {product.discount_price && <span className="block text-[11px] text-muted-foreground line-through">Rs. {product.discount_price.toLocaleString()}</span>}
                        </div>
                        <button onClick={(e) => { e.preventDefault(); addItem({ id: product.id, name: product.name, price: product.price, image: product.images?.[0] || "/placeholder.svg", slug: product.slug }); }} className="w-9 h-9 flex items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-secondary hover:text-secondary-foreground transition-all duration-300">
                          <ShoppingCart className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <SearchIcon className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">No products found. Try a different search term.</p>
              <Link to="/" className="text-secondary hover:underline text-sm mt-2 inline-block">← Back to Home</Link>
            </div>
          )}
        </div>
        <Footer />
      </main>
    </div>
  );
};

export default SearchPage;
