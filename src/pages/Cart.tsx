import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Minus, Plus, X, ShoppingCart, ArrowRight, Truck, Shield } from "lucide-react";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useCart } from "@/contexts/CartContext";
import { useState } from "react";

const Cart = () => {
  const { items, updateQuantity, removeItem, subtotal } = useCart();
  const [coupon, setCoupon] = useState("");

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
              <div className="lg:col-span-2 space-y-3">
                {items.map((item, i) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="bg-card rounded-xl border border-border p-4 flex gap-4"
                  >
                    <Link to={`/product/${item.slug}`}>
                      <img src={item.image} alt={item.name} className="w-20 h-20 rounded-lg object-cover flex-shrink-0" />
                    </Link>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div>
                          <Link to={`/product/${item.slug}`}>
                            <h3 className="text-sm font-semibold text-foreground line-clamp-1 hover:text-secondary transition-colors">{item.name}</h3>
                          </Link>
                          <p className="text-xs text-muted-foreground mt-0.5">In Stock</p>
                        </div>
                        <button onClick={() => removeItem(item.id)} className="text-muted-foreground hover:text-destructive transition-colors p-1">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center border border-border rounded-lg">
                          <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="w-8 h-8 flex items-center justify-center hover:bg-muted rounded-l-lg">
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-8 text-center text-sm font-semibold">{item.quantity}</span>
                          <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="w-8 h-8 flex items-center justify-center hover:bg-muted rounded-r-lg">
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                        <span className="text-base font-bold text-foreground">Rs. {(item.price * item.quantity).toLocaleString()}</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

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
                      <span>{shipping === 0 ? <span className="text-secondary font-medium">Free</span> : `Rs. ${shipping}`}</span>
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

                  <div className="flex gap-2">
                    <Input placeholder="Coupon code" value={coupon} onChange={(e) => setCoupon(e.target.value)} className="text-sm" />
                    <Button variant="outline" size="sm">Apply</Button>
                  </div>

                  <Button className="w-full gap-2" size="lg" asChild>
                    <Link to="/checkout">Proceed to Checkout <ArrowRight className="w-4 h-4" /></Link>
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
