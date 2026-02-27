import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Package, ShoppingCart } from "lucide-react";
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
          <p className="text-sm text-muted-foreground mt-1">Save more with bundled deals</p>
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
    </section>
  );
};

export default ComboPacks;
