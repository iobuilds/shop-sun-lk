import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ShoppingCart, Search, Menu, X, User, Heart, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

const categories = [
  { name: "Arduino & Boards", href: "/category/arduino-boards" },
  { name: "Sensors & Modules", href: "/category/sensors-modules" },
  { name: "Components", href: "/category/components" },
  { name: "Tools & Equipment", href: "/category/tools-equipment" },
  { name: "Combo Packs", href: "/category/combo-packs" },
  { name: "3D Printing", href: "/category/3d-printing" },
];

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? "bg-card/95 backdrop-blur-md shadow-md"
          : "bg-card"
      }`}
    >
      {/* Top bar */}
      <div className="bg-primary">
        <div className="container mx-auto px-4 flex items-center justify-between h-8 text-xs text-primary-foreground/80">
          <span>🇱🇰 Free delivery in Colombo for orders above Rs. 5,000</span>
          <div className="hidden md:flex items-center gap-4">
            <Link to="/track-order" className="hover:text-primary-foreground transition-colors">Track Order</Link>
            <Link to="/contact" className="hover:text-primary-foreground transition-colors">Contact Us</Link>
          </div>
        </div>
      </div>

      {/* Main nav */}
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center">
              <span className="text-secondary-foreground font-bold text-lg font-display">T</span>
            </div>
            <span className="text-xl font-bold font-display text-foreground">
              TechLK
            </span>
          </Link>

          {/* Search bar */}
          <div className="hidden md:flex flex-1 max-w-xl mx-8">
            <div className="relative w-full">
              <input
                type="text"
                placeholder="Search products, categories, brands..."
                className="w-full h-10 pl-4 pr-12 rounded-lg border border-border bg-muted/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all"
              />
              <button className="absolute right-1 top-1 h-8 w-8 flex items-center justify-center rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/90 transition-colors">
                <Search className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              className="md:hidden p-2 text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setSearchOpen(!searchOpen)}
            >
              <Search className="w-5 h-5" />
            </button>
            <Link to="/wishlist" className="hidden sm:flex p-2 text-muted-foreground hover:text-foreground transition-colors relative">
              <Heart className="w-5 h-5" />
            </Link>
            <Link to="/account" className="hidden sm:flex p-2 text-muted-foreground hover:text-foreground transition-colors">
              <User className="w-5 h-5" />
            </Link>
            <Link to="/cart" className="relative p-2 text-muted-foreground hover:text-foreground transition-colors">
              <ShoppingCart className="w-5 h-5" />
              <span className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full bg-secondary text-secondary-foreground text-[10px] font-bold flex items-center justify-center">
                3
              </span>
            </Link>
            <button
              className="md:hidden p-2 text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Category nav */}
      <div className="hidden md:block border-t border-border">
        <div className="container mx-auto px-4">
          <nav className="flex items-center gap-1 h-11">
            <div className="group relative">
              <button className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-foreground hover:text-secondary transition-colors">
                All Categories
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
            {categories.map((cat) => (
              <Link
                key={cat.name}
                to={cat.href}
                className="px-3 py-2 text-sm text-muted-foreground hover:text-secondary transition-colors"
              >
                {cat.name}
              </Link>
            ))}
            <Link
              to="/daily-deals"
              className="ml-auto px-3 py-2 text-sm font-semibold text-destructive hover:text-destructive/80 transition-colors flex items-center gap-1"
            >
              🔥 Daily Deals
            </Link>
          </nav>
        </div>
      </div>

      {/* Mobile search */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="md:hidden border-t border-border overflow-hidden"
          >
            <div className="container mx-auto px-4 py-3">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search products..."
                  className="w-full h-10 pl-4 pr-12 rounded-lg border border-border bg-muted/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  autoFocus
                />
                <button className="absolute right-1 top-1 h-8 w-8 flex items-center justify-center rounded-md bg-secondary text-secondary-foreground">
                  <Search className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="md:hidden border-t border-border overflow-hidden bg-card"
          >
            <nav className="container mx-auto px-4 py-4 flex flex-col gap-1">
              {categories.map((cat) => (
                <Link
                  key={cat.name}
                  to={cat.href}
                  className="px-3 py-2.5 text-sm text-foreground hover:bg-muted rounded-md transition-colors"
                  onClick={() => setMobileOpen(false)}
                >
                  {cat.name}
                </Link>
              ))}
              <Link
                to="/daily-deals"
                className="px-3 py-2.5 text-sm font-semibold text-destructive hover:bg-muted rounded-md transition-colors"
                onClick={() => setMobileOpen(false)}
              >
                🔥 Daily Deals
              </Link>
              <div className="border-t border-border mt-2 pt-2 flex flex-col gap-1">
                <Link to="/account" className="px-3 py-2.5 text-sm text-foreground hover:bg-muted rounded-md transition-colors" onClick={() => setMobileOpen(false)}>
                  My Account
                </Link>
                <Link to="/wishlist" className="px-3 py-2.5 text-sm text-foreground hover:bg-muted rounded-md transition-colors" onClick={() => setMobileOpen(false)}>
                  Wishlist
                </Link>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};

export default Navbar;
