import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ShoppingCart, Star, Heart, Truck, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import type { Tables } from "@/integrations/supabase/types";
import { useCart } from "@/contexts/CartContext";
import { useWishlist } from "@/hooks/useWishlist";

type Product = Tables<"products">;

const ProductCard = ({ product, index }: { product: Product; index: number }) => {
  const { addItem } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const saved = product.discount_price ? product.discount_price - product.price : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.06, duration: 0.4 }}
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
          {saved > 0 && (
            <span className="absolute bottom-2 left-2 bg-destructive text-destructive-foreground text-[10px] font-bold px-2 py-0.5 rounded-md">
              Save Rs. {saved.toLocaleString()}
            </span>
          )}
        </div>
        <div className="p-3">
          <h3 className="text-sm font-medium text-foreground line-clamp-2 mb-1.5 min-h-[2.5rem] group-hover:text-secondary transition-colors">
            {product.name}
          </h3>
          <div className="flex items-center gap-1 mb-1.5">
            <div className="flex items-center">
              {[...Array(5)].map((_, j) => (
                <Star
                  key={j}
                  className={`w-3 h-3 ${j < Math.floor(product.rating || 0) ? "text-accent fill-accent" : "text-border"}`}
                />
              ))}
            </div>
            <span className="text-[10px] text-muted-foreground">({product.review_count || 0})</span>
          </div>
          {/* Shipping & Stock Info */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mb-2 text-[10px]">
            <span className="flex items-center gap-0.5 text-muted-foreground">
              🇱🇰 Local
            </span>
            <span className="flex items-center gap-0.5 text-secondary">
              <Truck className="w-3 h-3" />
              {product.price >= 5000 ? "Free Delivery" : "Rs. 350"}
            </span>
            <span className="text-muted-foreground">ETA: 2-4 days</span>
            <span className={`flex items-center gap-0.5 ${
              (product.stock_quantity || 0) <= 0 ? "text-destructive" :
              (product.stock_quantity || 0) <= 5 ? "text-accent" : "text-muted-foreground"
            }`}>
              <Package className="w-3 h-3" />
              {(product.stock_quantity || 0) <= 0 ? "Out of Stock" :
               (product.stock_quantity || 0) <= 5 ? `Only ${product.stock_quantity} left` : "In Stock"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-base font-bold text-foreground">Rs. {product.price.toLocaleString()}</span>
              {product.discount_price && (
                <span className="block text-[11px] text-muted-foreground line-through">
                  Rs. {product.discount_price.toLocaleString()}
                </span>
              )}
            </div>
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
              disabled={(product.stock_quantity || 0) <= 0}
              className="w-9 h-9 flex items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-secondary hover:text-secondary-foreground transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ShoppingCart className="w-4 h-4" />
            </button>
          </div>
        </div>
      </Link>
    </motion.div>
  );
};

const FeaturedProducts = () => {
  const { data: products, isLoading } = useQuery({
    queryKey: ["featured-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("is_active", true)
        .eq("is_featured", true)
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data;
    },
  });

  return (
    <section>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold font-display text-foreground">Featured Products</h2>
        <Link to="/products" className="text-sm text-secondary hover:text-secondary/80 font-medium transition-colors">
          View All →
        </Link>
      </div>
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
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {products?.map((product, i) => (
            <ProductCard key={product.id} product={product} index={i} />
          ))}
        </div>
      )}
    </section>
  );
};

export default FeaturedProducts;
