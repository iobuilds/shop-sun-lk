import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CartProvider } from "@/contexts/CartContext";
import { HelmetProvider } from "react-helmet-async";
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
import MicroElectronicsPage from "./pages/MicroElectronicsPage";

const queryClient = new QueryClient();

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <CartProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/product/:slug" element={<ProductDetail />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/category/:slug" element={<CategoryPage />} />
              <Route path="/micro-electronics" element={<MicroElectronicsPage />} />
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
          </BrowserRouter>
        </TooltipProvider>
      </CartProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;

const queryClient = new QueryClient();

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <CartProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
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
          </BrowserRouter>
        </TooltipProvider>
      </CartProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;

