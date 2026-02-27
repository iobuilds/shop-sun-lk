import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Heart, ShoppingCart, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWishlist } from "@/hooks/useWishlist";
import { useCart } from "@/contexts/CartContext";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const Wishlist = () => {
  const { wishlistIds, toggleWishlist, isLoggedIn } = useWishlist();
  const { addItem } = useCart();

  const { data: products, isLoading } = useQuery({
    queryKey: ["wishlist-products", wishlistIds],
    queryFn: async () => {
      if (wishlistIds.length === 0) return [];
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .in("id", wishlistIds);
      if (error) throw error;
      return data;
    },
    enabled: wishlistIds.length > 0,
  });

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-36 pb-16">
        <div className="container mx-auto px-4">
          <h1 className="text-2xl font-bold font-display text-foreground mb-6">My Wishlist</h1>

          {!isLoggedIn ? (
            <div className="bg-card rounded-xl border border-border p-12 text-center">
              <Heart className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-muted-foreground mb-4">Sign in to view your wishlist</p>
              <Link to="/auth">
                <Button variant="outline" size="sm">Sign In</Button>
              </Link>
            </div>
          ) : isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-card rounded-xl border border-border animate-pulse">
                  <div className="aspect-square bg-muted rounded-t-xl" />
                  <div className="p-3 space-y-2">
                    <div className="h-4 bg-muted rounded w-3/4" />
                    <div className="h-5 bg-muted rounded w-1/3" />
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
                  transition={{ delay: i * 0.05 }}
                  className="group bg-card rounded-xl border border-border overflow-hidden"
                >
                  <Link to={`/product/${product.slug}`} className="block">
                    <div className="relative overflow-hidden">
                      <img
                        src={product.images?.[0] || "/placeholder.svg"}
                        alt={product.name}
                        className="w-full aspect-square object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                      <button
                        onClick={(e) => { e.preventDefault(); toggleWishlist(product.id); }}
                        className="absolute top-2 right-2 w-8 h-8 rounded-full bg-card/80 backdrop-blur-sm text-destructive flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground transition-all"
                      >
                        <Heart className="w-4 h-4 fill-current" />
                      </button>
                    </div>
                    <div className="p-3">
                      <h3 className="text-sm font-medium text-foreground line-clamp-2 mb-1.5 min-h-[2.5rem] group-hover:text-secondary transition-colors">
                        {product.name}
                      </h3>
                      <div className="flex items-center gap-1 mb-2">
                        <div className="flex">
                          {[...Array(5)].map((_, j) => (
                            <Star key={j} className={`w-3 h-3 ${j < Math.floor(product.rating || 0) ? "text-accent fill-accent" : "text-border"}`} />
                          ))}
                        </div>
                        <span className="text-[10px] text-muted-foreground">({product.review_count || 0})</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-base font-bold text-foreground">Rs. {product.price.toLocaleString()}</span>
                          {product.discount_price && (
                            <span className="block text-[11px] text-muted-foreground line-through">Rs. {product.discount_price.toLocaleString()}</span>
                          )}
                        </div>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            addItem({ id: product.id, name: product.name, price: product.price, image: product.images?.[0] || "/placeholder.svg", slug: product.slug });
                          }}
                          className="w-9 h-9 flex items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-secondary hover:text-secondary-foreground transition-all"
                        >
                          <ShoppingCart className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="bg-card rounded-xl border border-border p-12 text-center">
              <Heart className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-muted-foreground mb-4">Your wishlist is empty</p>
              <Link to="/">
                <Button variant="outline" size="sm">Browse Products</Button>
              </Link>
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default Wishlist;
