import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { CartProvider } from "@/contexts/CartContext";
import { HelmetProvider } from "react-helmet-async";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSiteModes } from "@/hooks/useSiteModes";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import ProductDetail from "./pages/ProductDetail";
import Cart from "./pages/Cart";
import CategoryPage from "./pages/CategoryPage";
import AdminDashboard from "./pages/admin/AdminDashboard";
import SearchPage from "./pages/SearchPage";
import Profile from "./pages/Profile";
import Wishlist from "./pages/Wishlist";
import Checkout from "./pages/Checkout";
import OrderSuccess from "./pages/OrderSuccess";
import StaticPage from "./pages/StaticPage";
import TrackOrder from "./pages/TrackOrder";
import NotFound from "./pages/NotFound";
import SitemapRedirect from "./pages/SitemapRedirect";
import PreOrder from "./pages/PreOrder";
import DealsPage from "./pages/DealsPage";
import PCBOrder from "./pages/PCBOrder";
import ComingSoon from "./pages/ComingSoon";
import MaintenancePage from "./pages/MaintenancePage";

const queryClient = new QueryClient();

// Inner wrapper that gates the site based on mode settings
const SiteModeGate = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const [isStaff, setIsStaff] = useState<boolean | null>(null);
  const { data: siteModes, isLoading: modesLoading } = useSiteModes();

  // Check if current user is admin/moderator (staff bypass)
  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setIsStaff(false); return; }
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id);
      const roleList = roles?.map((r: any) => r.role) || [];
      setIsStaff(roleList.includes("admin") || roleList.includes("moderator"));
    };
    check();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => check());
    return () => subscription.unsubscribe();
  }, []);

  // Always allow /admin, /auth, /reset-password, /contact, /sitemap.xml
  const bypassPaths = ["/admin", "/auth", "/reset-password", "/sitemap.xml"];
  const isOnBypassPath = bypassPaths.some((p) => location.pathname.startsWith(p));

  // Wait until we know staff status and modes
  if (isStaff === null || modesLoading) return <>{children}</>;

  // Staff always bypass
  if (isStaff || isOnBypassPath) return <>{children}</>;

  if (siteModes?.coming_soon_enabled) {
    return (
      <ComingSoon
        title={siteModes.coming_soon_title}
        subtitle={siteModes.coming_soon_subtitle}
      />
    );
  }

  if (siteModes?.maintenance_enabled) {
    // Allow /contact page through in maintenance mode
    if (location.pathname.startsWith("/contact") || location.pathname.startsWith("/page/")) {
      return <>{children}</>;
    }
    return (
      <MaintenancePage
        title={siteModes.maintenance_title}
        message={siteModes.maintenance_message}
      />
    );
  }

  return <>{children}</>;
};

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <CartProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <SiteModeGate>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/product/:slug" element={<ProductDetail />} />
                <Route path="/cart" element={<Cart />} />
                <Route path="/category/:slug" element={<CategoryPage />} />
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/search" element={<SearchPage />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/wishlist" element={<Wishlist />} />
                <Route path="/checkout" element={<Checkout />} />
                <Route path="/order-success" element={<OrderSuccess />} />
                <Route path="/page/:slug" element={<StaticPage />} />
                <Route path="/contact" element={<StaticPage />} />
                <Route path="/track-order" element={<TrackOrder />} />
                <Route path="/pre-order" element={<PreOrder />} />
                <Route path="/deals" element={<DealsPage />} />
                <Route path="/pcb-order" element={<PCBOrder />} />
                <Route path="/sitemap.xml" element={<SitemapRedirect />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </SiteModeGate>
          </BrowserRouter>
        </TooltipProvider>
      </CartProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
