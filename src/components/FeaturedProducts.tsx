import { motion } from "framer-motion";
import { ShoppingCart, Star, Heart } from "lucide-react";

interface Product {
  id: number;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  rating: number;
  reviews: number;
  badge?: string;
  inStock: boolean;
}

const products: Product[] = [
  { id: 1, name: "Raspberry Pi 4 Model B 8GB", price: 18500, image: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=400&h=400&fit=crop", rating: 4.8, reviews: 124, badge: "Best Seller", inStock: true },
  { id: 2, name: "ESP32 Development Board", price: 1850, originalPrice: 2400, image: "https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=400&h=400&fit=crop", rating: 4.6, reviews: 89, inStock: true },
  { id: 3, name: "Multimeter Digital Pro", price: 4750, image: "https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?w=400&h=400&fit=crop", rating: 4.7, reviews: 56, badge: "New", inStock: true },
  { id: 4, name: "Breadboard Kit with Wires", price: 980, originalPrice: 1450, image: "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=400&h=400&fit=crop", rating: 4.5, reviews: 201, inStock: true },
  { id: 5, name: "PLA Filament 1.75mm 1kg", price: 3200, image: "https://images.unsplash.com/photo-1487058792275-0ad4aaf24ca7?w=400&h=400&fit=crop", rating: 4.4, reviews: 34, inStock: true },
  { id: 6, name: "Servo Motor SG90 Pack (5x)", price: 1650, originalPrice: 2200, image: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=400&h=400&fit=crop", rating: 4.3, reviews: 78, badge: "Popular", inStock: true },
  { id: 7, name: "Jumper Wire Kit 120pcs", price: 650, image: "https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=400&h=400&fit=crop", rating: 4.6, reviews: 312, inStock: true },
  { id: 8, name: "OLED Display 0.96\" I2C", price: 890, originalPrice: 1200, image: "https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?w=400&h=400&fit=crop", rating: 4.5, reviews: 145, inStock: true },
];

const ProductCard = ({ product, index }: { product: Product; index: number }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.06, duration: 0.4 }}
      className="group bg-card rounded-xl border border-border card-elevated overflow-hidden cursor-pointer"
    >
      <div className="relative overflow-hidden">
        <img
          src={product.image}
          alt={product.name}
          className="w-full aspect-square object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />
        {product.badge && (
          <span className="absolute top-2 left-2 bg-secondary text-secondary-foreground text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider">
            {product.badge}
          </span>
        )}
        <button className="absolute top-2 right-2 w-8 h-8 rounded-full bg-card/80 backdrop-blur-sm text-muted-foreground hover:text-destructive flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
          <Heart className="w-4 h-4" />
        </button>
        {product.originalPrice && (
          <span className="absolute bottom-2 left-2 bg-destructive text-destructive-foreground text-[10px] font-bold px-2 py-0.5 rounded-md">
            Save Rs. {(product.originalPrice - product.price).toLocaleString()}
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
              <Star
                key={j}
                className={`w-3 h-3 ${j < Math.floor(product.rating) ? "text-accent fill-accent" : "text-border"}`}
              />
            ))}
          </div>
          <span className="text-[10px] text-muted-foreground">({product.reviews})</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <span className="text-base font-bold text-foreground">Rs. {product.price.toLocaleString()}</span>
            {product.originalPrice && (
              <span className="block text-[11px] text-muted-foreground line-through">Rs. {product.originalPrice.toLocaleString()}</span>
            )}
          </div>
          <button className="w-9 h-9 flex items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-secondary hover:text-secondary-foreground transition-all duration-300">
            <ShoppingCart className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

const FeaturedProducts = () => {
  return (
    <section>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold font-display text-foreground">Featured Products</h2>
        <a href="/products" className="text-sm text-secondary hover:text-secondary/80 font-medium transition-colors">
          View All →
        </a>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {products.map((product, i) => (
          <ProductCard key={product.id} product={product} index={i} />
        ))}
      </div>
    </section>
  );
};

export default FeaturedProducts;
