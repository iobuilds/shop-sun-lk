import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ShoppingCart, Search, Menu, X, User, Heart, ChevronDown, Printer, CircuitBoard, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { useCart } from "@/contexts/CartContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface CustomLink {
  id: string;
  label: string;
  url: string;
  icon: string;
  visible: boolean;
  external: boolean;
}

interface NavbarConfig {
  announcement_visible: boolean;
  announcement_text: string;
  show_daily_deals: boolean;
  hidden_category_slugs: string[];
  custom_links: CustomLink[];
}

const DEFAULT_CONFIG: NavbarConfig = {
  announcement_visible: true,
  announcement_text: "🇱🇰 Free delivery in Colombo for orders above Rs. 5,000",
  show_daily_deals: true,
  hidden_category_slugs: [],
  custom_links: [
    { id: "3dprint", label: "3D Print", url: "https://3dprint.iobuilds.com", icon: "Printer", visible: true, external: true },
    { id: "pcbdesign", label: "PCB Design", url: "https://pcb.iobuilds.com", icon: "CircuitBoard", visible: true, external: true },
  ],
};

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [session, setSession] = useState<any>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const mobileSearchRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { totalItems } = useCart();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  // Dynamic categories from DB
  const { data: categories } = useQuery({
    queryKey: ["nav-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("name, slug")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
    staleTime: 60000,
  });

  // Navbar config from site_settings
  const { data: navConfig } = useQuery({
    queryKey: ["navbar-config"],
    queryFn: async () => {
      const { data } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "navbar_config")
        .single();
      return (data?.value as unknown as NavbarConfig) || DEFAULT_CONFIG;
    },
    staleTime: 30000,
  });

  const config = navConfig || DEFAULT_CONFIG;

  // Search products
  const { data: searchResults } = useQuery({
    queryKey: ["search", searchQuery],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, slug, price, images, discount_price")
        .eq("is_active", true)
        .or(`name.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`)
        .limit(6);
      if (error) throw error;
      return data;
    },
    enabled: searchQuery.length >= 2,
  });

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close search on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node) &&
          mobileSearchRef.current && !mobileSearchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSearchSelect = (slug: string) => {
    setSearchQuery("");
    setShowResults(false);
    setSearchOpen(false);
    navigate(`/product/${slug}`);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setShowResults(false);
      setSearchOpen(false);
    }
  };

  // Apply hidden categories filter and limit to 6
  const navCategories = (categories || [])
    .filter((c) => !config.hidden_category_slugs.includes(c.slug))
    .slice(0, 6);

  // Visible custom links
  const visibleCustomLinks = config.custom_links.filter((l) => l.visible);

  const SearchDropdown = () => (
    <AnimatePresence>
      {showResults && searchQuery.length >= 2 && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-lg overflow-hidden z-50"
        >
          {searchResults && searchResults.length > 0 ? (
            <div className="max-h-80 overflow-y-auto">
              {searchResults.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleSearchSelect(p.slug)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors text-left"
                >
                  <img
                    src={p.images?.[0] || "/placeholder.svg"}
                    alt=""
                    className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground line-clamp-1">{p.name}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-foreground">Rs. {p.price.toLocaleString()}</span>
                      {p.discount_price && (
                        <span className="text-xs text-muted-foreground line-through">Rs. {p.discount_price.toLocaleString()}</span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              No products found for "{searchQuery}"
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled ? "bg-card/95 backdrop-blur-md shadow-md" : "bg-card"
      }`}
    >
      {/* Announcement bar — controlled by admin */}
      {config.announcement_visible && (
        <div className="bg-primary">
          <div className="container mx-auto px-4 flex items-center justify-between h-8 text-xs text-primary-foreground/80">
            <span>{config.announcement_text}</span>
            <div className="hidden md:flex items-center gap-4">
              <Link to="/track-order" className="hover:text-primary-foreground transition-colors">Track Order</Link>
              <Link to="/contact" className="hover:text-primary-foreground transition-colors">Contact Us</Link>
            </div>
          </div>
        </div>
      )}

      {/* Main nav */}
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center">
              <span className="text-secondary-foreground font-bold text-lg font-display">N</span>
            </div>
            <span className="text-xl font-bold font-display text-foreground">NanoCircuit.lk</span>
          </Link>

          {/* Desktop search */}
          <div className="hidden md:flex flex-1 max-w-xl mx-8" ref={searchRef}>
            <form onSubmit={handleSearchSubmit} className="relative w-full">
              <input
                type="text"
                placeholder="Search products, categories, brands..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setShowResults(true); }}
                onFocus={() => setShowResults(true)}
                className="w-full h-10 pl-4 pr-12 rounded-lg border border-border bg-muted/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all"
              />
              <button type="submit" className="absolute right-1 top-1 h-8 w-8 flex items-center justify-center rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/90 transition-colors">
                <Search className="w-4 h-4" />
              </button>
              <SearchDropdown />
            </form>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button className="md:hidden p-2 text-muted-foreground hover:text-foreground transition-colors" onClick={() => { setSearchOpen(!searchOpen); setMobileOpen(false); }}>
              <Search className="w-5 h-5" />
            </button>
            <Link to="/wishlist" className="hidden sm:flex p-2 text-muted-foreground hover:text-foreground transition-colors relative">
              <Heart className="w-5 h-5" />
            </Link>
            <Link to={session ? "/profile" : "/auth"} className="hidden sm:flex p-2 text-muted-foreground hover:text-foreground transition-colors">
              <User className="w-5 h-5" />
            </Link>
            <Link to="/cart" className="relative p-2 text-muted-foreground hover:text-foreground transition-colors">
              <ShoppingCart className="w-5 h-5" />
              {totalItems > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full bg-secondary text-secondary-foreground text-[10px] font-bold flex items-center justify-center">
                  {totalItems > 99 ? "99+" : totalItems}
                </span>
              )}
            </Link>
            <button className="md:hidden p-2 text-muted-foreground hover:text-foreground transition-colors" onClick={() => { setMobileOpen(!mobileOpen); setSearchOpen(false); }}>
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Category nav - dynamic from DB + config */}
      <div className="hidden md:block border-t border-border">
        <div className="container mx-auto px-4">
          <nav className="flex items-center gap-1 h-11">
            <div className="group relative">
              <button className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-foreground hover:text-secondary transition-colors">
                All Categories
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
            {navCategories.map((cat) => (
              <Link
                key={cat.slug}
                to={`/category/${cat.slug}`}
                className="px-3 py-2 text-sm text-muted-foreground hover:text-secondary transition-colors"
              >
                {cat.name}
              </Link>
            ))}

            {/* Custom links from admin config */}
            {visibleCustomLinks.map((link) => (
              <a
                key={link.id}
                href={link.url}
                target={link.external ? "_blank" : undefined}
                rel={link.external ? "noopener noreferrer" : undefined}
                className="px-3 py-2 text-sm text-muted-foreground hover:text-secondary transition-colors flex items-center gap-1"
              >
                {link.icon === "Printer" && <Printer className="w-3.5 h-3.5" />}
                {link.icon === "CircuitBoard" && <CircuitBoard className="w-3.5 h-3.5" />}
                {!["Printer", "CircuitBoard"].includes(link.icon) && <ExternalLink className="w-3 h-3" />}
                {link.label}
              </a>
            ))}

            {/* Daily Deals — controlled by admin */}
            {config.show_daily_deals && (
              <Link
                to="/daily-deals"
                className="px-3 py-2 text-sm font-semibold text-destructive hover:text-destructive/80 transition-colors flex items-center gap-1"
              >
                🔥 Daily Deals
              </Link>
            )}
            {/* Pre-Order link */}
            <Link
              to="/pre-order"
              className="ml-1 px-3 py-1.5 text-sm font-semibold text-secondary-foreground bg-secondary hover:bg-secondary/90 transition-colors rounded-md flex items-center gap-1"
            >
              📦 Pre-Order
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
            <div className="container mx-auto px-4 py-3" ref={mobileSearchRef}>
              <form onSubmit={handleSearchSubmit} className="relative">
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setShowResults(true); }}
                  onFocus={() => setShowResults(true)}
                  className="w-full h-10 pl-4 pr-12 rounded-lg border border-border bg-muted/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  autoFocus
                />
                <button type="submit" className="absolute right-1 top-1 h-8 w-8 flex items-center justify-center rounded-md bg-secondary text-secondary-foreground">
                  <Search className="w-4 h-4" />
                </button>
                <SearchDropdown />
              </form>
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
              {navCategories.map((cat) => (
                <Link
                  key={cat.slug}
                  to={`/category/${cat.slug}`}
                  className="px-3 py-2.5 text-sm text-foreground hover:bg-muted rounded-md transition-colors"
                  onClick={() => setMobileOpen(false)}
                >
                  {cat.name}
                </Link>
              ))}
              {config.show_daily_deals && (
                <Link
                  to="/daily-deals"
                  className="px-3 py-2.5 text-sm font-semibold text-destructive hover:bg-muted rounded-md transition-colors"
                  onClick={() => setMobileOpen(false)}
                >
                  🔥 Daily Deals
                </Link>
              )}
              {visibleCustomLinks.map((link) => (
                <a
                  key={link.id}
                  href={link.url}
                  target={link.external ? "_blank" : undefined}
                  rel={link.external ? "noopener noreferrer" : undefined}
                  className="px-3 py-2.5 text-sm text-muted-foreground hover:bg-muted rounded-md transition-colors flex items-center gap-2"
                  onClick={() => setMobileOpen(false)}
                >
                  {link.icon === "Printer" && <Printer className="w-4 h-4" />}
                  {link.icon === "CircuitBoard" && <CircuitBoard className="w-4 h-4" />}
                  {!["Printer", "CircuitBoard"].includes(link.icon) && <ExternalLink className="w-4 h-4" />}
                  {link.label}
                </a>
              ))}
              <div className="border-t border-border mt-2 pt-2 flex flex-col gap-1">
                <Link to={session ? "/profile" : "/auth"} className="px-3 py-2.5 text-sm text-foreground hover:bg-muted rounded-md transition-colors" onClick={() => setMobileOpen(false)}>
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
