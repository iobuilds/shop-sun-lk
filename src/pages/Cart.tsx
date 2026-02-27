import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Minus, Plus, X, ShoppingCart, ArrowRight, Truck, Shield } from "lucide-react";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

interface CartItem {
  id: number;
  name: string;
  price: number;
  quantity: number;
  image: string;
}

const initialCart: CartItem[] = [
  { id: 1, name: "Raspberry Pi 4 Model B 8GB", price: 18500, quantity: 1, image: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=200&h=200&fit=crop" },
  { id: 2, name: "ESP32 Development Board", price: 1850, quantity: 2, image: "https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=200&h=200&fit=crop" },
  { id: 3, name: "Jumper Wire Kit 120pcs", price: 650, quantity: 1, image: "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=200&h=200&fit=crop" },
];

const Cart = () => {
  const [items, setItems] = useState(initialCart);
  const [coupon, setCoupon] = useState("");

  const updateQty = (id: number, delta: number) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item
      )
    );
  };

  const removeItem = (id: number) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shipping = subtotal >= 5000 ? 0 : 350;
  const total = subtotal + shipping;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-[136px] md:pt-[160px]">
        <div className="container mx-auto px-4 py-8">
          <h1 className="text-2xl font-bold font-display text-foreground mb-6 flex items-center gap-2">
            <ShoppingCart className="w-6 h-6" /> Shopping Cart
            <span className="text-sm font-normal text-muted-foreground">({items.length} items)</span>
          </h1>

          {items.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
              <ShoppingCart className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-foreground mb-2">Your cart is empty</h2>
              <p className="text-muted-foreground text-sm mb-6">Browse our products and add items to your cart.</p>
              <Button asChild variant="default"><Link to="/">Continue Shopping</Link></Button>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Cart items */}
              <div className="lg:col-span-2 space-y-3">
                {items.map((item, i) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="bg-card rounded-xl border border-border p-4 flex gap-4"
                  >
                    <img src={item.image} alt={item.name} className="w-20 h-20 rounded-lg object-cover flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-sm font-semibold text-foreground line-clamp-1">{item.name}</h3>
                          <p className="text-xs text-muted-foreground mt-0.5">In Stock</p>
                        </div>
                        <button onClick={() => removeItem(item.id)} className="text-muted-foreground hover:text-destructive transition-colors p-1">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center border border-border rounded-lg">
                          <button onClick={() => updateQty(item.id, -1)} className="w-8 h-8 flex items-center justify-center hover:bg-muted rounded-l-lg">
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-8 text-center text-sm font-semibold">{item.quantity}</span>
                          <button onClick={() => updateQty(item.id, 1)} className="w-8 h-8 flex items-center justify-center hover:bg-muted rounded-r-lg">
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                        <span className="text-base font-bold text-foreground">Rs. {(item.price * item.quantity).toLocaleString()}</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Order summary */}
              <div>
                <div className="bg-card rounded-xl border border-border p-6 sticky top-44 space-y-4">
                  <h2 className="text-lg font-bold font-display text-foreground">Order Summary</h2>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Subtotal</span>
                      <span>Rs. {subtotal.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Shipping</span>
                      <span>{shipping === 0 ? <span className="text-success font-medium">Free</span> : `Rs. ${shipping}`}</span>
                    </div>
                    <div className="border-t border-border pt-2 flex justify-between font-bold text-foreground text-base">
                      <span>Total</span>
                      <span>Rs. {total.toLocaleString()}</span>
                    </div>
                  </div>

                  {shipping > 0 && (
                    <p className="text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded-lg">
                      Add Rs. {(5000 - subtotal).toLocaleString()} more for free shipping
                    </p>
                  )}

                  {/* Coupon */}
                  <div className="flex gap-2">
                    <Input
                      placeholder="Coupon code"
                      value={coupon}
                      onChange={(e) => setCoupon(e.target.value)}
                      className="text-sm"
                    />
                    <Button variant="outline" size="sm">Apply</Button>
                  </div>

                  <Button className="w-full gap-2" size="lg">
                    Proceed to Checkout <ArrowRight className="w-4 h-4" />
                  </Button>

                  <div className="flex items-center gap-4 pt-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1"><Truck className="w-3.5 h-3.5" /> Free over Rs. 5K</div>
                    <div className="flex items-center gap-1"><Shield className="w-3.5 h-3.5" /> Secure Checkout</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        <Footer />
      </main>
    </div>
  );
};

export default Cart;
