import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Package, ShoppingCart, Tag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useCart } from "@/contexts/CartContext";

const ComboPacks = () => {
  const { addItem } = useCart();

  const { data: combos, isLoading } = useQuery({
    queryKey: ["combo-packs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("combo_packs")
        .select("*, combo_pack_items(*, products(id, name, price, images, slug))")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(6);
      if (error) throw error;
      return data;
    },
  });

  if (isLoading || !combos || combos.length === 0) return null;

  return (
    <section>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold font-display text-foreground">Combo Packs</h2>
          <p className="text-sm text-muted-foreground mt-1">Save more with curated bundles</p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {combos.map((combo: any, i: number) => {
          const savings = combo.original_price - combo.combo_price;
          const savingsPercent = combo.original_price > 0 ? Math.round((savings / combo.original_price) * 100) : 0;
          const items = combo.combo_pack_items || [];

          return (
            <motion.div
              key={combo.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05, duration: 0.4 }}
              className="group"
            >
              <Link
                to={`/product/${combo.slug}`}
                className="bg-card rounded-xl border border-border overflow-hidden hover:border-secondary/40 hover:shadow-md transition-all duration-300 block h-full"
              >
                <div className="relative overflow-hidden">
                  <img
                    src={combo.images?.[0] || items[0]?.products?.images?.[0] || "/placeholder.svg"}
                    alt={combo.name}
                    className="w-full aspect-[4/3] object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                  {savingsPercent > 0 && (
                    <span className="absolute top-3 left-3 bg-destructive/90 text-destructive-foreground text-xs font-bold px-2.5 py-1 rounded-md shadow-md">
                      Save {savingsPercent}%
                    </span>
                  )}
                  <span className="absolute top-3 right-3 bg-secondary/90 text-secondary-foreground text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider flex items-center gap-1 shadow-md backdrop-blur-sm">
                    <Package className="w-3 h-3" /> Bundle
                  </span>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-foreground mb-1 line-clamp-1 group-hover:text-secondary transition-colors">{combo.name}</h3>
                  {combo.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{combo.description}</p>
                  )}
                  <div className="flex flex-wrap gap-1 mb-3">
                    {items.slice(0, 3).map((item: any) => (
                      <span key={item.id} className="inline-flex items-center gap-1 bg-muted text-muted-foreground text-[10px] px-2 py-0.5 rounded-md">
                        <Tag className="w-2.5 h-2.5" />
                        {item.products?.name} ×{item.quantity}
                      </span>
                    ))}
                    {items.length > 3 && (
                      <span className="text-[10px] text-muted-foreground px-2 py-0.5">+{items.length - 3} more</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <div>
                      <span className="text-lg font-bold text-foreground">Rs. {combo.combo_price.toLocaleString()}</span>
                      {combo.original_price > combo.combo_price && (
                        <span className="block text-xs text-muted-foreground line-through">Rs. {combo.original_price.toLocaleString()}</span>
                      )}
                    </div>
                    <Button
                      size="sm"
                      className="gap-1.5 shadow-sm"
                      onClick={(e) => {
                        e.preventDefault();
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
              </Link>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
};

export default ComboPacks;
