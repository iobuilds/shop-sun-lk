import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles, TrendingUp, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";

const tagIcons = [Flame, TrendingUp, Sparkles];
const tags = ["Just In", "Trending", "Pro Pick"];
const tagColors = [
  "bg-destructive/80 text-destructive-foreground",
  "bg-secondary/80 text-secondary-foreground",
  "bg-accent/90 text-accent-foreground",
];

const NewArrivals = () => {
  const { data: products } = useQuery({
    queryKey: ["new-arrivals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(3);
      if (error) throw error;
      return data;
    },
  });

  if (!products?.length) return null;

  return (
    <section>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-accent" />
          <div>
            <h2 className="text-2xl font-bold font-display text-foreground">New Arrivals</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Latest additions to our catalogue</p>
          </div>
        </div>
        <Link to="/search?sort=newest" className="text-sm text-secondary hover:text-secondary/80 font-medium flex items-center gap-1 transition-colors">
          View All <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {products.map((product, i) => {
          const Icon = tagIcons[i % 3];
          return (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.12, duration: 0.5 }}
            >
              <Link
                to={`/product/${product.slug}`}
                className="group relative overflow-hidden rounded-xl h-[280px] cursor-pointer block"
              >
                <img
                  src={product.images?.[0] || "/placeholder.svg"}
                  alt={product.name}
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-primary/90 via-primary/30 to-transparent" />
                <div className="absolute top-3 left-3">
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider flex items-center gap-1 backdrop-blur-sm shadow-md ${tagColors[i % 3]}`}>
                    <Icon className="w-3 h-3" />
                    {tags[i % 3]}
                  </span>
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-5">
                  <h3 className="text-lg font-bold font-display text-primary-foreground mb-1 line-clamp-2 group-hover:text-secondary transition-colors duration-300">{product.name}</h3>
                  <div className="flex items-center justify-between">
                    <p className="text-primary-foreground/80 text-sm font-semibold">Rs. {product.price.toLocaleString()}</p>
                    <span className="text-primary-foreground/60 text-xs bg-primary-foreground/10 backdrop-blur-sm px-2 py-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      View →
                    </span>
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

export default NewArrivals;
