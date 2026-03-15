import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ShoppingCart, Search, Menu, X, User, Heart, Printer, CircuitBoard, ExternalLink, Bell, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { useCart } from "@/contexts/CartContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBranding } from "@/hooks/useBranding";

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
    { id: "pcbdesign", label: "PCB Design", url: "/pcb-order", icon: "CircuitBoard", visible: true, external: false },
  ],
};

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const mobileSearchRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { totalItems } = useCart();
  const queryClient = useQueryClient();

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

  const { storeName, logoUrl, company } = useBranding();


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

  // Notifications
  const { data: notifications } = useQuery({
    queryKey: ["user-notifications", session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return [];
      const { data, error } = await supabase
        .from("user_notifications" as any)
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as any[];
    },
    enabled: !!session?.user?.id,
    refetchInterval: 30000,
  });

  const unreadCount = notifications?.filter((n) => !n.is_read).length || 0;

  // Unread messages (admin replies not yet read by user)
  const { data: unreadMessages } = useQuery({
    queryKey: ["unread-messages-count", session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return [];
      // Get user's conversations then count unread admin messages
      const { data: convos } = await supabase
        .from("conversations" as any)
        .select("id")
        .eq("user_id", session.user.id);
      if (!convos?.length) return [];
      const convoIds = convos.map((c: any) => c.id);
      const { data, error } = await supabase
        .from("conversation_messages" as any)
        .select("id")
        .in("conversation_id", convoIds)
        .eq("sender_type", "admin")
        .eq("is_read", false);
      if (error) return [];
      return data as any[];
    },
    enabled: !!session?.user?.id,
    refetchInterval: 15000,
  });

  const unreadMsgCount = unreadMessages?.length || 0;

  const markAllRead = async () => {
    if (!session?.user?.id || unreadCount === 0) return;
    await supabase
      .from("user_notifications" as any)
      .update({ is_read: true })
      .eq("user_id", session.user.id)
      .eq("is_read", false);
    queryClient.invalidateQueries({ queryKey: ["user-notifications", session.user.id] });
  };

  const handleNotifOpen = () => {
    setNotifOpen((prev) => {
      if (!prev) markAllRead();
      return !prev;
    });
  };

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

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node) &&
          mobileSearchRef.current && !mobileSearchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const logSearch = async (q: string, resultCount: number) => {
    if (!q.trim() || q.trim().length < 2) return;
    await supabase.from("search_logs" as any).insert({
      query: q.trim().toLowerCase(),
      result_count: resultCount,
      user_id: session?.user?.id || null,
    });
  };

  const handleSearchSelect = (slug: string) => {
    logSearch(searchQuery, searchResults?.length || 0);
    setSearchQuery("");
    setShowResults(false);
    setSearchOpen(false);
    navigate(`/product/${slug}`);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      logSearch(searchQuery, searchResults?.length || 0);
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

  const notifTypeColor = (type: string) => {
    if (type === "order") return "text-secondary";
    if (type === "success") return "text-green-500";
    if (type === "warning") return "text-yellow-500";
    if (type === "error") return "text-destructive";
    return "text-muted-foreground";
  };

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
      {/* Announcement bar */}
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
            {(() => {
              const mode = company?.navbar_brand_mode || "logo_only";
              const height = company?.navbar_logo_height || 36;
              return (
                <>
                  {mode !== "text_only" && logoUrl ? (
                    <img src={logoUrl} alt={storeName} style={{ height: `${height}px`, width: "auto", maxWidth: "160px" }} className="object-contain" />
                  ) : mode !== "text_only" ? (
                    <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center">
                      <span className="text-secondary-foreground font-bold text-lg font-display">{storeName?.charAt(0) || "N"}</span>
                    </div>
                  ) : null}
                  {mode !== "logo_only" && (
                    <span className="text-xl font-bold font-display text-foreground">{storeName}</span>
                  )}
                </>
              );
            })()}
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

            {/* Notification Bell */}
            {session && (
              <div className="relative" ref={notifRef}>
                <button
                  onClick={handleNotifOpen}
                  className="p-2 text-muted-foreground hover:text-foreground transition-colors relative"
                >
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </button>

                <AnimatePresence>
                  {notifOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-full mt-2 w-80 bg-card border border-border rounded-xl shadow-xl overflow-hidden z-50"
                    >
                      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                        <span className="text-sm font-semibold text-foreground">Notifications</span>
                        {unreadCount > 0 && (
                          <span className="text-xs text-muted-foreground">{unreadCount} unread</span>
                        )}
                      </div>
                      <div className="max-h-80 overflow-y-auto">
                        {!notifications?.length ? (
                          <div className="px-4 py-10 text-center">
                            <Bell className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-30" />
                            <p className="text-sm text-muted-foreground">No notifications yet</p>
                          </div>
                        ) : (
                          notifications.map((n) => (
                            <div
                              key={n.id}
                              className={`px-4 py-3 border-b border-border last:border-0 transition-colors ${
                                !n.is_read ? "bg-secondary/5" : ""
                              }`}
                            >
                              {n.link_url ? (
                                <Link to={n.link_url} onClick={() => setNotifOpen(false)} className="block">
                                  <p className={`text-xs font-semibold mb-0.5 ${notifTypeColor(n.type)}`}>{n.title}</p>
                                  <p className="text-xs text-foreground">{n.message}</p>
                                  <p className="text-[10px] text-muted-foreground mt-1">{new Date(n.created_at).toLocaleDateString("en-LK", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                                </Link>
                              ) : (
                                <>
                                  <p className={`text-xs font-semibold mb-0.5 ${notifTypeColor(n.type)}`}>{n.title}</p>
                                  <p className="text-xs text-foreground">{n.message}</p>
                                  <p className="text-[10px] text-muted-foreground mt-1">{new Date(n.created_at).toLocaleDateString("en-LK", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                                </>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
            {/* Messages icon — only for logged-in users */}
            {session && (
              <Link to="/profile?tab=messages" className="hidden sm:flex relative p-2 text-muted-foreground hover:text-foreground transition-colors">
                <MessageSquare className="w-5 h-5" />
                {unreadMsgCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full bg-secondary text-secondary-foreground text-[10px] font-bold flex items-center justify-center">
                    {unreadMsgCount > 9 ? "9+" : unreadMsgCount}
                  </span>
                )}
              </Link>
            )}

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

      {/* Category nav */}
      <div className="hidden md:block border-t border-border bg-card/50">
        <div className="container mx-auto px-4">
          <nav className="flex items-center justify-between h-10">
            <div className="flex items-center gap-0">
              {navCategories.map((cat) => (
                <Link
                  key={cat.slug}
                  to={`/category/${cat.slug}`}
                  className="px-3 h-10 flex items-center text-[13px] text-muted-foreground hover:text-secondary hover:bg-secondary/5 transition-all duration-150 whitespace-nowrap font-medium"
                >
                  {cat.name}
                </Link>
              ))}
              {visibleCustomLinks.map((link) => (
                <a
                  key={link.id}
                  href={link.url}
                  target={link.external ? "_blank" : undefined}
                  rel={link.external ? "noopener noreferrer" : undefined}
                  className="mx-1 px-3 py-1 flex items-center gap-1.5 text-[13px] font-semibold text-secondary border border-secondary/40 rounded-md hover:bg-secondary/10 transition-all duration-150 whitespace-nowrap"
                >
                  {link.icon === "Printer" && <Printer className="w-3.5 h-3.5" />}
                  {link.icon === "CircuitBoard" && <CircuitBoard className="w-3.5 h-3.5" />}
                  {!["Printer", "CircuitBoard"].includes(link.icon) && <ExternalLink className="w-3 h-3" />}
                  {link.label}
                </a>
              ))}
            </div>

            {/* Right side: Daily Deals + Pre-Order */}
            <div className="flex items-center gap-1">
              {config.show_daily_deals && (
                <Link
                  to="/deals"
                  className="px-3 h-10 flex items-center gap-1 text-[13px] font-semibold text-destructive hover:bg-destructive/5 transition-all duration-150 whitespace-nowrap"
                >
                  🔥 Deals
                </Link>
              )}
              <Link
                to="/pre-order"
                className="mx-2 px-3 py-1.5 text-[13px] font-semibold text-secondary-foreground bg-secondary hover:bg-secondary/90 transition-colors duration-150 rounded-md flex items-center gap-1 whitespace-nowrap shadow-sm"
              >
                📦 Pre-Order
              </Link>
            </div>
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
                  to="/deals"
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
