import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
  slug: string;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  subtotal: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_KEY = "nanocircuit_cart";

const readCart = (): CartItem[] => {
  try {
    const stored = localStorage.getItem(CART_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<CartItem[]>(readCart);

  // Persist to localStorage whenever items change
  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
  }, [items]);

  // Sync cart across tabs via storage event
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === CART_KEY) {
        setItems(readCart());
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  // ── Validate cart against live DB on mount ──────────────────────────────────
  useEffect(() => {
    const syncCart = async () => {
      const current = readCart();
      if (!current.length) return;

      const ids = current.map((i) => i.id);
      const { data, error } = await supabase
        .from("products")
        .select("id, name, price, images, slug, is_active")
        .in("id", ids);

      if (error || !data) return;

      const liveMap = new Map(data.map((p) => [p.id, p]));

      let removed = 0;
      let updated = 0;

      const synced = current
        .filter((item) => {
          const live = liveMap.get(item.id);
          if (!live || live.is_active === false) {
            removed++;
            return false;
          }
          return true;
        })
        .map((item) => {
          const live = liveMap.get(item.id)!;
          const newPrice = Number(live.price);
          const newName = live.name;
          const newImage = live.images?.[0] || item.image;
          const newSlug = live.slug;
          if (
            newPrice !== item.price ||
            newName !== item.name ||
            newImage !== item.image ||
            newSlug !== item.slug
          ) {
            updated++;
            return { ...item, price: newPrice, name: newName, image: newImage, slug: newSlug };
          }
          return item;
        });

      if (removed > 0 || updated > 0) {
        setItems(synced);
        if (removed > 0) {
          toast({
            title: `${removed} item${removed > 1 ? "s" : ""} removed from cart`,
            description: "Some products are no longer available.",
            variant: "destructive",
          });
        }
        if (updated > 0) {
          toast({
            title: "Cart updated",
            description: `${updated} item${updated > 1 ? "s" : ""} refreshed with the latest price/details.`,
          });
        }
      }
    };

    syncCart();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addItem = (item: Omit<CartItem, "quantity">, quantity = 1) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        return prev.map((i) =>
          i.id === item.id ? { ...i, quantity: i.quantity + quantity } : i
        );
      }
      return [...prev, { ...item, quantity }];
    });
    toast({ title: "Added to cart", description: `${item.name} added to your cart.` });
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity < 1) return;
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, quantity } : i))
    );
  };

  const clearCart = () => setItems([]);

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQuantity, clearCart, totalItems, subtotal }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
};
