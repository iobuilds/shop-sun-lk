import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CartProvider } from "@/contexts/CartContext";
import { HelmetProvider } from "react-helmet-async";
import { useSuspensionGuard } from "@/hooks/useSuspensionGuard";
import { lazy, Suspense } from "react";

// Eagerly load only the home page — everything else is split
import Index from "./pages/Index";

const Auth = lazy(() => import("./pages/Auth"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
const Cart = lazy(() => import("./pages/Cart"));
const CategoryPage = lazy(() => import("./pages/CategoryPage"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const SearchPage = lazy(() => import("./pages/SearchPage"));
const Profile = lazy(() => import("./pages/Profile"));
const Wishlist = lazy(() => import("./pages/Wishlist"));
const Checkout = lazy(() => import("./pages/Checkout"));
const OrderSuccess = lazy(() => import("./pages/OrderSuccess"));
const StaticPage = lazy(() => import("./pages/StaticPage"));
const TrackOrder = lazy(() => import("./pages/TrackOrder"));
const NotFound = lazy(() => import("./pages/NotFound"));
const SitemapRedirect = lazy(() => import("./pages/SitemapRedirect"));
const PreOrder = lazy(() => import("./pages/PreOrder"));
const DealsPage = lazy(() => import("./pages/DealsPage"));
const PCBOrder = lazy(() => import("./pages/PCBOrder"));
const MicroElectronicsPage = lazy(() => import("./pages/MicroElectronicsPage"));
const ComponentDetailPage = lazy(() => import("./pages/ComponentDetailPage"));

const queryClient = new QueryClient();

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
  </div>
);

// Inner component to use hooks inside providers
const AppRoutes = () => {
  useSuspensionGuard();
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/product/:slug" element={<ProductDetail />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/category/:slug" element={<CategoryPage />} />
        <Route path="/micro-electronics" element={<MicroElectronicsPage />} />
        <Route path="/micro-electronics/:type/:familySlug" element={<ComponentDetailPage />} />
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
    </Suspense>
  );
};

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <CartProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </TooltipProvider>
      </CartProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;

