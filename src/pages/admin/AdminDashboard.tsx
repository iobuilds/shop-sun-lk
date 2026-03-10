import { useState, useMemo, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Package, ShoppingBag, Image, BarChart3, Loader2, FolderTree, Plus, Trash2, Pencil, X, Upload, Tag, FileText, TrendingUp, DollarSign, Eye, MessageSquare, Ticket, Mail, Check, Users, Star, Layers, Search, Save, Building2, Video, FileDown, LogOut, Phone, Send, ExternalLink, CreditCard, Settings, Truck, Clock, MapPin, Link2, StickyNote, CalendarDays, Database, ChevronDown, Megaphone, Wrench, Globe, Copy, Menu, Wallet, Lock, MoreVertical, Shield, Ban, UserX, UserCheck, Navigation as NavIcon, LayoutDashboard, QrCode, ShoppingCart, CheckCircle, XCircle } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "@/hooks/use-toast";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { Link } from "react-router-dom";
import ProductLinksManager from "@/components/admin/ProductLinksManager";
import SalesAnalytics from "@/components/admin/SalesAnalytics";
import DatabaseTools from "@/components/admin/DatabaseTools";
import WalletManager from "@/components/admin/WalletManager";
import UserDetailDialog from "@/components/admin/UserDetailDialog";
import AdminOrderDetailDialog from "@/components/admin/AdminOrderDetailDialog";
import NavbarManager from "@/components/admin/NavbarManager";
import InvoiceTemplateBuilder from "@/components/admin/InvoiceTemplateBuilder";
import HomepageSectionsManager from "@/components/admin/HomepageSectionsManager";
import QRStockScanner from "@/components/admin/QRStockScanner";
import AdminPreOrders from "@/components/admin/AdminPreOrders";

type Tab = "products" | "micro_electronics" | "categories" | "orders" | "delivery_updates" | "banners" | "promo_banners" | "deals" | "pages" | "reports" | "contacts" | "coupons" | "users" | "reviews" | "combos" | "seo" | "company" | "bank" | "sms_templates" | "sms_logs" | "stock" | "qr_scan" | "sales" | "payment_settings" | "shipping_settings" | "db_tools" | "wallet" | "navbar" | "invoice_template" | "homepage_sections" | "preorders";

interface ProductForm {
  name: string; slug: string; description: string; price: string; discount_price: string; cost_price: string;
  sku: string; stock_quantity: string; category_id: string; images: string; is_active: boolean; is_featured: boolean;
  video_url: string; datasheet_url: string;
  shipping_type: string; ships_from: string; delivery_eta: string;
}
interface CategoryForm {
  name: string; slug: string; description: string; image_url: string; sort_order: string; is_active: boolean;
}
interface BannerForm {
  title: string; subtitle: string; image_url: string; link_url: string; sort_order: string; is_active: boolean;
}
interface DealForm {
  product_id: string; discount_percent: string; deal_price: string; starts_at: string; ends_at: string; is_active: boolean;
}
interface PageForm {
  title: string; slug: string; content: string; is_published: boolean;
}
interface CouponForm {
  code: string; name: string; description: string; discount_type: string; discount_value: string;
  min_order_amount: string; max_uses: string; is_active: boolean; expires_at: string;
  coupon_type: string; max_discount_cap: string; per_user_limit: string; starts_at: string;
  category_scope: string; valid_category_ids: string[];
  assigned_phones: string;
}
interface ComboForm {
  name: string; slug: string; description: string; combo_price: string; original_price: string;
  images: string; is_active: boolean; is_featured: boolean; items: { product_id: string; quantity: string }[];
  shipping_type: string; ships_from: string; delivery_eta: string;
}

const emptyProduct: ProductForm = { name: "", slug: "", description: "", price: "", discount_price: "", cost_price: "", sku: "", stock_quantity: "", category_id: "", images: "", is_active: true, is_featured: false, video_url: "", datasheet_url: "", shipping_type: "local", ships_from: "", delivery_eta: "" };
const emptyCategory: CategoryForm = { name: "", slug: "", description: "", image_url: "", sort_order: "0", is_active: true };
const emptyBanner: BannerForm = { title: "", subtitle: "", image_url: "", link_url: "", sort_order: "0", is_active: true };
const emptyDeal: DealForm = { product_id: "", discount_percent: "", deal_price: "", starts_at: "", ends_at: "", is_active: true };
const emptyPage: PageForm = { title: "", slug: "", content: "", is_published: true };
const emptyCoupon: CouponForm = { code: "", name: "", description: "", discount_type: "percentage", discount_value: "", min_order_amount: "", max_uses: "", is_active: true, expires_at: "", coupon_type: "public", max_discount_cap: "", per_user_limit: "", starts_at: "", category_scope: "all", valid_category_ids: [], assigned_phones: "" };
const emptyCombo: ComboForm = { name: "", slug: "", description: "", combo_price: "", original_price: "", images: "", is_active: true, is_featured: false, items: [{ product_id: "", quantity: "1" }], shipping_type: "local", ships_from: "", delivery_eta: "" };

const AdminDashboard = () => {
  const { isAdmin, isModerator, userRole, loading } = useAdminAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("orders");
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [productDialog, setProductDialog] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [productForm, setProductForm] = useState<ProductForm>(emptyProduct);
  const [productImagePreviews, setProductImagePreviews] = useState<string[]>([]);

  // Bulk selection state
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  const [categoryDialog, setCategoryDialog] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [categoryForm, setCategoryForm] = useState<CategoryForm>(emptyCategory);

  const [bannerDialog, setBannerDialog] = useState(false);
  const [editingBannerId, setEditingBannerId] = useState<string | null>(null);
  const [bannerForm, setBannerForm] = useState<BannerForm>(emptyBanner);

  const [dealDialog, setDealDialog] = useState(false);
  const [editingDealId, setEditingDealId] = useState<string | null>(null);
  const [dealForm, setDealForm] = useState<DealForm>(emptyDeal);

  const [pageDialog, setPageDialog] = useState(false);
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [pageForm, setPageForm] = useState<PageForm>(emptyPage);

  const [couponDialog, setCouponDialog] = useState(false);
  const [editingCouponId, setEditingCouponId] = useState<string | null>(null);
  const [couponForm, setCouponForm] = useState<CouponForm>(emptyCoupon);

  const [comboDialog, setComboDialog] = useState(false);
  const [editingComboId, setEditingComboId] = useState<string | null>(null);
  const [comboForm, setComboForm] = useState<ComboForm>(emptyCombo);
  const [comboImagePreviews, setComboImagePreviews] = useState<string[]>([]);

  // Order detail dialog state
  const [orderDetailDialog, setOrderDetailDialog] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [orderDeliveryForm, setOrderDeliveryForm] = useState({
    status: "", tracking_number: "", courier_name: "", tracking_link: "",
    expected_delivery: "", delivery_note: "",
  });
  const [orderStatusHistory, setOrderStatusHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // User detail dialog
  const [userDetailOpen, setUserDetailOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUserRole, setSelectedUserRole] = useState("user");

  // User management dialogs
  const [userEditDialog, setUserEditDialog] = useState(false);
  const [userEditForm, setUserEditForm] = useState({ full_name: "", phone: "", email: "", city: "", address_line1: "", address_line2: "", postal_code: "" });
  const [userEditTarget, setUserEditTarget] = useState<string | null>(null);
  const [userActionLoading, setUserActionLoading] = useState(false);
  const [suspendDialog, setSuspendDialog] = useState(false);
  const [suspendTarget, setSuspendTarget] = useState<{ id: string; name: string } | null>(null);
  const [suspendReason, setSuspendReason] = useState("");
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [roleDialog, setRoleDialog] = useState(false);
  const [roleTarget, setRoleTarget] = useState<{ id: string; name: string; currentRole: string } | null>(null);
  const [userStatusFilter, setUserStatusFilter] = useState("all");
  const [userRoleFilter, setUserRoleFilter] = useState("all");

  // LCSC import state
  const [lcscPartNumber, setLcscPartNumber] = useState("");
  const [lcscLoading, setLcscLoading] = useState(false);
  const [lcscFailed, setLcscFailed] = useState(false);
  const [lcscFailedMpn, setLcscFailedMpn] = useState("");
  const [lcscFailedLcscNum, setLcscFailedLcscNum] = useState("");

  // Listen for QR scanner "add product" event
  useEffect(() => {
    const handler = (e: any) => {
      const { lcsc, mpn } = e.detail || {};
      const partToFetch = parseLcscInput(lcsc || mpn || "");
      setLcscPartNumber(partToFetch);
      setLcscFailed(false);
      setLcscFailedMpn(mpn || "");
      setLcscFailedLcscNum(lcsc || "");
      setProductDialog(true);
      setEditingProductId(null);
      setProductForm(emptyProduct);
      setProductImagePreviews([]);
      setTab("micro_electronics");
      if (partToFetch) {
        // Auto-trigger LCSC fetch after dialog opens
        setTimeout(async () => {
          const { data, error } = await supabase.functions.invoke("lcsc-import", { body: { partNumber: partToFetch } });
          if (!error && data?.success) {
            const d = data.data;
            setProductForm((prev) => ({
              ...prev,
              name: d.name || prev.name,
              sku: d.sku || prev.sku,
              description: d.description || prev.description,
              datasheet_url: d.datasheet_url || prev.datasheet_url,
              images: d.images?.join(",") || prev.images,
              slug: (d.name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
            }));
            if (d.images?.length) setProductImagePreviews(d.images.slice(0, 5));
            toast({ title: "✅ LCSC data auto-filled", description: `${d.name} — Set price, stock & category.` });
          } else {
            // Auto-fetch failed — pre-fill manual fallback fields from QR data
            setLcscFailed(true);
            setLcscFailedMpn(mpn || "");
            setLcscFailedLcscNum(lcsc || "");
            // Pre-fill SKU with LCSC C-number and name with MPN as starting point
            setProductForm((prev) => ({
              ...prev,
              sku: lcsc || prev.sku,
              name: mpn || prev.name,
              slug: (mpn || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
            }));
          }
        }, 400);
      }
    };
    window.addEventListener("openAddProductFromQR", handler);
    return () => window.removeEventListener("openAddProductFromQR", handler);
  }, []);

  /** Extract C-number from a full LCSC URL or return the raw input as-is */
  const parseLcscInput = (raw: string): string => {
    const trimmed = raw.trim();
    // Support: https://www.lcsc.com/product-detail/C17932.html  or  .../C17932_...html
    const urlMatch = trimmed.match(/\/(?:product-detail\/)?([Cc]\d+)/i);
    if (urlMatch) return urlMatch[1].toUpperCase();
    // Support: plain C-number like C17932
    return trimmed.toUpperCase();
  };

  const fetchFromLcsc = async () => {
    if (!lcscPartNumber.trim()) return;
    setLcscLoading(true);
    setLcscFailed(false);
    const partNumber = parseLcscInput(lcscPartNumber);
    // Update the input field to show the extracted part number
    if (partNumber !== lcscPartNumber.trim()) setLcscPartNumber(partNumber);
    try {
      const { data, error } = await supabase.functions.invoke("lcsc-import", {
        body: { partNumber },
      });
      if (error || !data?.success) {
        // Show manual fallback fields pre-filled with the attempted part number
        setLcscFailed(true);
        setLcscFailedLcscNum(partNumber);
        setLcscFailedMpn(productForm.sku || "");
        // Pre-fill SKU with C-number so admin doesn't have to retype
        setProductForm((prev) => ({
          ...prev,
          sku: prev.sku || partNumber,
        }));
        toast({ title: "Part not found on LCSC", description: "Please fill in the details manually below.", variant: "destructive" });
        return;
      }
      const d = data.data;
      setLcscFailed(false);
      setProductForm((prev) => ({
        ...prev,
        name: d.name || prev.name,
        sku: d.sku || prev.sku,
        description: d.description || prev.description,
        datasheet_url: d.datasheet_url || prev.datasheet_url,
        images: d.images?.join(",") || prev.images,
        slug: (d.name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
      }));
      if (d.images?.length) setProductImagePreviews(d.images.slice(0, 5));
      toast({
        title: "✅ LCSC data imported",
        description: `${d.name} — Set price, stock & category to complete.`,
      });
    } catch (err: any) {
      setLcscFailed(true);
      setLcscFailedLcscNum(parseLcscInput(lcscPartNumber));
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLcscLoading(false);
    }
  };

  // Promo banners state
  const [promoDialog, setPromoDialog] = useState(false);
  const [editingPromoId, setEditingPromoId] = useState<string | null>(null);
  const [promoForm, setPromoForm] = useState({ title: "", subtitle: "", description: "", badge_text: "", image_url: "", link_url: "", gradient_from: "primary", sort_order: "0", is_active: true });

  const uploadFile = async (file: File, folder: string): Promise<string | null> => {
    const ext = file.name.split(".").pop();
    const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("images").upload(fileName, file);
    if (error) { toast({ title: "Upload failed", description: error.message, variant: "destructive" }); return null; }
    const { data } = supabase.storage.from("images").getPublicUrl(fileName);
    return data.publicUrl;
  };

  // ── Queries ──
  const { data: products } = useQuery({
    queryKey: ["admin-products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*, categories(name)").order("created_at", { ascending: false });
      if (error) throw error; return data;
    },
  });

  const { data: categories } = useQuery({
    queryKey: ["admin-categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("*").order("sort_order");
      if (error) throw error; return data;
    },
  });

  const { data: orders } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("*, order_items(*, products(name))").order("created_at", { ascending: false });
      if (error) throw error; return data;
    },
  });

  const { data: banners } = useQuery({
    queryKey: ["admin-banners"],
    queryFn: async () => {
      const { data, error } = await supabase.from("banners").select("*").order("sort_order");
      if (error) throw error; return data;
    },
  });

  const { data: promoBanners } = useQuery({
    queryKey: ["admin-promo-banners"],
    queryFn: async () => {
      const { data, error } = await supabase.from("promo_banners" as any).select("*").order("sort_order");
      if (error) throw error; return data as any[];
    },
  });

  const { data: deals } = useQuery({
    queryKey: ["admin-deals"],
    queryFn: async () => {
      const { data, error } = await supabase.from("daily_deals").select("*, products(name, images, price)").order("created_at", { ascending: false });
      if (error) throw error; return data;
    },
  });

  const { data: pages } = useQuery({
    queryKey: ["admin-pages"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pages").select("*").order("title");
      if (error) throw error; return data;
    },
  });

  const { data: contactMessages } = useQuery({
    queryKey: ["admin-contacts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contact_messages").select("*").order("created_at", { ascending: false });
      if (error) throw error; return data;
    },
  });

  const { data: coupons } = useQuery({
    queryKey: ["admin-coupons"],
    queryFn: async () => {
      const { data, error } = await supabase.from("coupons").select("*").order("created_at", { ascending: false });
      if (error) throw error; return data;
    },
  });

  const { data: allProfiles } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
      if (error) throw error; return data;
    },
  });

  const { data: allReviews } = useQuery({
    queryKey: ["admin-reviews"],
    queryFn: async () => {
      const { data, error } = await supabase.from("reviews").select("*, products(name, slug)").order("created_at", { ascending: false });
      if (error) throw error; return data;
    },
  });

  const { data: comboPacks } = useQuery({
    queryKey: ["admin-combos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("combo_packs").select("*, combo_pack_items(*, products(name, price))").order("created_at", { ascending: false });
      if (error) throw error; return data;
    },
  });

  const { data: userRoles } = useQuery({
    queryKey: ["admin-user-roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("*");
      if (error) throw error; return data;
    },
  });

  const { data: seoSettings } = useQuery({
    queryKey: ["admin-seo"],
    queryFn: async () => {
      const { data, error } = await supabase.from("site_settings" as any).select("*").eq("key", "seo").maybeSingle();
      if (error) throw error;
      return (data as any)?.value as any || { store_name: "", tagline: "", meta_description: "", meta_keywords: "", og_image: "", google_analytics_id: "", facebook_pixel_id: "" };
    },
  });

  const { data: bankSettings } = useQuery({
    queryKey: ["admin-bank"],
    queryFn: async () => {
      const { data, error } = await supabase.from("site_settings" as any).select("*").eq("key", "bank_details").maybeSingle();
      if (error) throw error;
      const val = (data as any)?.value;
      // Migrate old single-object format to array
      if (val && !Array.isArray(val)) return [val];
      return (val as any[]) || [{ bank_name: "", account_name: "", account_number: "", branch: "", additional_info: "" }];
    },
  });

  const { data: smsTemplates } = useQuery({
    queryKey: ["admin-sms-templates"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sms_templates" as any).select("*").order("created_at");
      if (error) throw error; return data as any[];
    },
  });

  const { data: smsLogs } = useQuery({
    queryKey: ["admin-sms-logs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sms_logs" as any).select("*").order("created_at", { ascending: false }).limit(100);
      if (error) throw error; return data as any[];
    },
  });

  const { data: smsBalance } = useQuery({
    queryKey: ["admin-sms-balance"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("sms-balance");
      if (error) throw error;
      return data;
    },
    staleTime: 300000,
  });

  // Admin conversations
  const { data: adminConversations } = useQuery({
    queryKey: ["admin-conversations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations" as any)
        .select("*, profiles!inner(full_name, phone)")
        .order("updated_at", { ascending: false });
      if (error) {
        // fallback without join if profiles join fails
        const { data: d2, error: e2 } = await supabase
          .from("conversations" as any)
          .select("*")
          .order("updated_at", { ascending: false });
        if (e2) throw e2;
        return d2 as any[];
      }
      return data as any[];
    },
  });

  const [adminSelectedConvo, setAdminSelectedConvo] = useState<string | null>(null);
  const [adminReplyText, setAdminReplyText] = useState("");
  const [adminSendingReply, setAdminSendingReply] = useState(false);

  const { data: adminConvoMessages } = useQuery({
    queryKey: ["admin-convo-messages", adminSelectedConvo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversation_messages" as any)
        .select("*")
        .eq("conversation_id", adminSelectedConvo!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!adminSelectedConvo,
    refetchInterval: 5000,
  });

  const { data: companySettings } = useQuery({
    queryKey: ["admin-company"],
    queryFn: async () => {
      const { data, error } = await supabase.from("site_settings" as any).select("*").eq("key", "company").maybeSingle();
      if (error) throw error;
      return (data as any)?.value as any || {
        store_name: "", tagline: "", description: "", address: "", phone: "", email: "",
        business_hours: "", facebook_url: "", instagram_url: "", youtube_url: "",
        whatsapp: "", copyright_text: "",
      };
    },
  });

  const { data: stockSettings } = useQuery({
    queryKey: ["admin-stock-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("site_settings" as any).select("*").eq("key", "stock_settings").maybeSingle();
      if (error) throw error;
      return (data as any)?.value as any || { low_stock_threshold: 5 };
    },
  });

  const { data: paymentSettings } = useQuery({
    queryKey: ["admin-payment-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("site_settings" as any).select("*").eq("key", "payment_methods").maybeSingle();
      if (error) throw error;
      return (data as any)?.value as any || { stripe_enabled: true, bank_transfer_enabled: true };
    },
  });

  const { data: shippingSettings } = useQuery({
    queryKey: ["admin-shipping-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("site_settings" as any).select("*").eq("key", "shipping_settings").maybeSingle();
      if (error) throw error;
      return (data as any)?.value as any || { local_fee: 350, overseas_fee: 1500, free_shipping_threshold: 5000 };
    },
  });

  const [paymentMethodSettings, setPaymentMethodSettings] = useState<any>(null);
  useEffect(() => {
    if (paymentSettings && !paymentMethodSettings) setPaymentMethodSettings(paymentSettings);
  }, [paymentSettings]);

  const [shippingForm, setShippingForm] = useState<any>(null);
  useEffect(() => {
    if (shippingSettings && !shippingForm) setShippingForm(shippingSettings);
  }, [shippingSettings]);

  const [seoForm, setSeoForm] = useState<any>(null);
  const [lowStockThreshold, setLowStockThreshold] = useState(5);
  const [bankForm, setBankForm] = useState<any>(null);
  const [companyForm, setCompanyForm] = useState<any>(null);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [templateForm, setTemplateForm] = useState({ template_key: "", name: "", message_template: "", description: "", is_active: true });
  const [templateDialog, setTemplateDialog] = useState(false);

  useEffect(() => {
    if (seoSettings && !seoForm) setSeoForm(seoSettings);
  }, [seoSettings]);
  useEffect(() => {
    if (bankSettings && !bankForm) setBankForm(bankSettings);
  }, [bankSettings]);
  useEffect(() => {
    if (companySettings && !companyForm) setCompanyForm(companySettings);
  }, [companySettings]);
  useEffect(() => {
    if (stockSettings) setLowStockThreshold(stockSettings.low_stock_threshold || 5);
  }, [stockSettings]);

  const unreadContacts = contactMessages?.filter((m: any) => !m.is_read).length || 0;

  // Pre-orders query
  const { data: preorderRequests, refetch: refetchPreorders } = useQuery({
    queryKey: ["admin-preorders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("preorder_requests")
        .select("*, preorder_items(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: isAdmin || isModerator,
  });
  const pendingPreorderCount = preorderRequests?.filter((r: any) => r.status === "pending").length || 0;


const CouponUserPicker = ({ allProfiles, selectedPhones, onChange }: {
  allProfiles: any[];
  selectedPhones: string;
  onChange: (phones: string) => void;
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  const selectedList = selectedPhones.split(",").map(p => p.trim()).filter(Boolean);

  const filteredUsers = useMemo(() => {
    if (!searchTerm || searchTerm.length < 2) return [];
    const term = searchTerm.toLowerCase();
    return (allProfiles || [])
      .filter((p: any) => {
        const phone = (p.phone || "").replace(/\s/g, "");
        if (!phone) return false;
        if (selectedList.includes(phone)) return false;
        return (
          phone.toLowerCase().includes(term) ||
          (p.full_name || "").toLowerCase().includes(term)
        );
      })
      .slice(0, 10);
  }, [searchTerm, allProfiles, selectedList]);

  const addUser = (phone: string) => {
    const clean = phone.replace(/\s/g, "");
    if (selectedList.includes(clean)) return;
    const updated = [...selectedList, clean].join(", ");
    onChange(updated);
    setSearchTerm("");
    setShowDropdown(false);
  };

  const removeUser = (phone: string) => {
    const updated = selectedList.filter(p => p !== phone).join(", ");
    onChange(updated);
  };

  const getProfileByPhone = (phone: string) =>
    allProfiles?.find((p: any) => (p.phone || "").replace(/\s/g, "") === phone);

  return (
    <div className="space-y-2">
      <Label>Assign Users</Label>
      {/* Selected users as chips */}
      {selectedList.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selectedList.map(phone => {
            const prof = getProfileByPhone(phone);
            return (
              <span key={phone} className="inline-flex items-center gap-1 bg-secondary/10 text-secondary text-xs px-2 py-1 rounded-full">
                <span className="font-medium">{prof?.full_name || "Unknown"}</span>
                <span className="text-secondary/60">{phone}</span>
                <button onClick={() => removeUser(phone)} className="ml-0.5 hover:text-destructive"><X className="w-3 h-3" /></button>
              </span>
            );
          })}
        </div>
      )}
      {/* Search input */}
      <div className="relative">
        <div className="flex items-center border border-input rounded-md bg-background px-3">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setShowDropdown(true); }}
            onFocus={() => setShowDropdown(true)}
            placeholder="Search by name or phone..."
            className="flex-1 h-9 px-2 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
          />
        </div>
        {showDropdown && filteredUsers.length > 0 && (
          <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
            {filteredUsers.map((p: any) => (
              <button
                key={p.id}
                onClick={() => addUser(p.phone)}
                className="w-full text-left px-3 py-2 hover:bg-accent text-sm flex items-center justify-between"
              >
                <div>
                  <span className="font-medium text-foreground">{p.full_name || "—"}</span>
                  <span className="ml-2 text-muted-foreground">{p.phone}</span>
                </div>
                <Plus className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            ))}
          </div>
        )}
        {showDropdown && searchTerm.length >= 2 && filteredUsers.length === 0 && (
          <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg p-3 text-sm text-muted-foreground text-center">
            No users found
          </div>
        )}
      </div>
      <p className="text-[10px] text-muted-foreground">Search users by name or phone to assign them. {selectedList.length} user(s) selected.</p>
    </div>
  );
};


  const lowStockCount = products?.filter(p => {
    const stock = Number(p.stock_quantity) || 0;
    return stock > 0 && stock <= (stockSettings?.low_stock_threshold || 5);
  }).length || 0;

  const pendingOrderCount = orders?.filter(o => o.status === "pending" || o.status === "confirmed").length || 0;
  const deliveryActionCount = orders?.filter(o => ["confirmed", "paid", "processing", "packed", "shipped"].includes(o.status)).length || 0;

  // Micro Electronics category products
  const microElectronicsCategory = categories?.find(c => c.name.toLowerCase().includes("micro"));
  const microElectronicsProducts = products?.filter(p => p.category_id === microElectronicsCategory?.id) || [];

  const allSidebarGroups = [
    {
      label: "Catalog", icon: Package, defaultOpen: true, adminOnly: true,
      items: [
        { id: "products" as Tab, label: "All Products", icon: Package, count: products?.length || 0 },
        { id: "micro_electronics" as Tab, label: "Micro Electronics", icon: Wrench, count: microElectronicsProducts.length },
        { id: "categories" as Tab, label: "Categories", icon: FolderTree, count: categories?.length || 0 },
        { id: "combos" as Tab, label: "Combo Packs", icon: Layers, count: comboPacks?.length || 0 },
        { id: "deals" as Tab, label: "Daily Deals", icon: Tag, count: deals?.length || 0 },
        { id: "stock" as Tab, label: "Stock", icon: Package, count: lowStockCount },
        { id: "qr_scan" as Tab, label: "QR Stock Scan", icon: QrCode, count: 0 },
      ],
    },
    {
      label: "Orders & Fulfillment", icon: ShoppingBag, defaultOpen: true, adminOnly: false,
      items: [
        { id: "orders" as Tab, label: "Orders", icon: ShoppingBag, count: pendingOrderCount },
        { id: "delivery_updates" as Tab, label: "Delivery Updates", icon: Truck, count: deliveryActionCount },
      ],
    },
    {
      label: "Customer Support", icon: MessageSquare, defaultOpen: true, adminOnly: false,
      items: [
        { id: "contacts" as Tab, label: "Messages", icon: MessageSquare, count: unreadContacts },
        { id: "preorders" as Tab, label: "Pre-Orders", icon: ShoppingCart, count: pendingPreorderCount },
      ],
    },
    {
      label: "Customers", icon: Users, defaultOpen: true, adminOnly: true,
      items: [
        { id: "users" as Tab, label: "Users", icon: Users, count: allProfiles?.length || 0 },
        { id: "reviews" as Tab, label: "Reviews", icon: Star, count: allReviews?.length || 0 },
      ],
    },
    {
      label: "Marketing", icon: Megaphone, defaultOpen: false, adminOnly: true,
      items: [
        { id: "banners" as Tab, label: "Hero Banners", icon: Image, count: banners?.length || 0 },
        { id: "promo_banners" as Tab, label: "Promo Banners", icon: Image, count: promoBanners?.length || 0 },
        { id: "coupons" as Tab, label: "Coupons", icon: Ticket, count: coupons?.length || 0 },
        { id: "seo" as Tab, label: "SEO", icon: Search, count: 0 },
      ],
    },
    {
      label: "Payments & Finance", icon: CreditCard, defaultOpen: false, adminOnly: true,
      items: [
        { id: "payment_settings" as Tab, label: "Payment Methods", icon: CreditCard, count: 0 },
        { id: "wallet" as Tab, label: "User Wallets", icon: Wallet, count: 0 },
        { id: "shipping_settings" as Tab, label: "Shipping Charges", icon: Truck, count: 0 },
        { id: "bank" as Tab, label: "Bank Details", icon: Building2, count: 0 },
        { id: "sales" as Tab, label: "Sales", icon: DollarSign, count: 0 },
      ],
    },
    {
      label: "Content & Site", icon: Globe, defaultOpen: false, adminOnly: true,
      items: [
        { id: "homepage_sections" as Tab, label: "Homepage Sections", icon: LayoutDashboard, count: 0 },
        { id: "navbar" as Tab, label: "Navbar Manager", icon: NavIcon, count: 0 },
        { id: "invoice_template" as Tab, label: "Invoice Template", icon: FileText, count: 0 },
        { id: "pages" as Tab, label: "Pages", icon: FileText, count: pages?.length || 0 },
        { id: "company" as Tab, label: "Company Info", icon: Building2, count: 0 },
      ],
    },
    {
      label: "SMS Center", icon: Send, defaultOpen: false, adminOnly: true,
      items: [
        { id: "sms_templates" as Tab, label: "SMS Templates", icon: Send, count: smsTemplates?.length || 0 },
        { id: "sms_logs" as Tab, label: "SMS Logs", icon: Phone, count: smsLogs?.length || 0 },
      ],
    },
    {
      label: "Analytics & Reports", icon: TrendingUp, defaultOpen: false, adminOnly: true,
      items: [
        { id: "reports" as Tab, label: "Reports", icon: TrendingUp, count: 0 },
      ],
    },
    {
      label: "System Tools", icon: Wrench, defaultOpen: false, adminOnly: true,
      items: [
        { id: "db_tools" as Tab, label: "Backup & Restore", icon: Database, count: 0 },
      ],
    },
  ];

  // Filter sidebar groups based on role
  const sidebarGroups = isAdmin
    ? allSidebarGroups
    : allSidebarGroups.filter(g => !g.adminOnly);

  // Flat list for mobile
  const allTabs = sidebarGroups.flatMap(g => g.items);

  // Track which groups are open
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    sidebarGroups.forEach(g => { initial[g.label] = g.defaultOpen; });
    return initial;
  });

  const toggleGroup = (label: string) => {
    setOpenGroups(prev => ({ ...prev, [label]: !prev[label] }));
  };

  // Auto-open the group containing the active tab
  useEffect(() => {
    const group = sidebarGroups.find(g => g.items.some(i => i.id === tab));
    if (group && !openGroups[group.label]) {
      setOpenGroups(prev => ({ ...prev, [group.label]: true }));
    }
  }, [tab]);

  const ITEMS_PER_PAGE = 15;
  const [productPage, setProductPage] = useState(0);
  const [orderPage, setOrderPage] = useState(0);
  const [dealPage, setDealPage] = useState(0);
  const [couponPage, setCouponPage] = useState(0);
  const [userPage, setUserPage] = useState(0);
  const [reviewPage, setReviewPage] = useState(0);
  const [contactPage, setContactPage] = useState(0);
  const [smsLogPage, setSmsLogPage] = useState(0);

  const [orderStatusFilter, setOrderStatusFilter] = useState("all");
  const [orderSearch, setOrderSearch] = useState("");
  const [productStockFilter, setProductStockFilter] = useState("all");
  const [productCategoryFilter, setProductCategoryFilter] = useState("all");
  const [userSearch, setUserSearch] = useState("");
  const [reviewSearch, setReviewSearch] = useState("");
  const [contactSearch, setContactSearch] = useState("");
  const [smsLogSearch, setSmsLogSearch] = useState("");

  const filteredProducts = products?.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const stock = Number(p.stock_quantity) || 0;
    const matchesStock = productStockFilter === "all" ? true
      : productStockFilter === "out" ? stock === 0
      : productStockFilter === "low" ? stock > 0 && stock <= lowStockThreshold
      : productStockFilter === "in" ? stock > lowStockThreshold
      : true;
    const matchesCategory = productCategoryFilter === "all" || p.category_id === productCategoryFilter;
    return matchesSearch && matchesStock && matchesCategory;
  });
  const totalProductPages = Math.ceil((filteredProducts?.length || 0) / ITEMS_PER_PAGE);
  const paginatedProducts = filteredProducts?.slice(productPage * ITEMS_PER_PAGE, (productPage + 1) * ITEMS_PER_PAGE);

  const filteredOrders = orders?.filter((o) => {
    const matchesStatus = orderStatusFilter === "all" || o.status === orderStatusFilter;
    if (!matchesStatus) return false;
    if (!orderSearch.trim()) return true;
    const q = orderSearch.toLowerCase().trim();
    const orderId = o.id.toLowerCase();
    const shortId = o.id.slice(0, 8).toLowerCase();
    const addr = o.shipping_address as any;
    const customerName = (addr?.full_name || "").toLowerCase();
    const customerPhone = (addr?.phone || "").toLowerCase();
    const trackingNum = ((o as any).tracking_number || "").toLowerCase();
    return orderId.includes(q) || shortId.includes(q) || customerName.includes(q) || customerPhone.includes(q) || trackingNum.includes(q);
  });
  const totalOrderPages = Math.ceil((filteredOrders?.length || 0) / ITEMS_PER_PAGE);
  const paginatedOrders = filteredOrders?.slice(orderPage * ITEMS_PER_PAGE, (orderPage + 1) * ITEMS_PER_PAGE);

  const totalDealPages = Math.ceil((deals?.length || 0) / ITEMS_PER_PAGE);
  const paginatedDeals = deals?.slice(dealPage * ITEMS_PER_PAGE, (dealPage + 1) * ITEMS_PER_PAGE);

  const totalCouponPages = Math.ceil((coupons?.length || 0) / ITEMS_PER_PAGE);
  const paginatedCoupons = coupons?.slice(couponPage * ITEMS_PER_PAGE, (couponPage + 1) * ITEMS_PER_PAGE);

  const filteredUsers = allProfiles?.filter((p: any) => {
    const matchSearch = !userSearch || (p.full_name || "").toLowerCase().includes(userSearch.toLowerCase()) || (p.phone || "").includes(userSearch) || (p.city || "").toLowerCase().includes(userSearch.toLowerCase());
    const matchStatus = userStatusFilter === "all" || (userStatusFilter === "suspended" ? p.is_suspended : !p.is_suspended);
    const matchRole = userRoleFilter === "all" || getUserRole(p.user_id) === userRoleFilter;
    return matchSearch && matchStatus && matchRole;
  });
  const totalUserPages = Math.ceil((filteredUsers?.length || 0) / ITEMS_PER_PAGE);
  const paginatedUsers = filteredUsers?.slice(userPage * ITEMS_PER_PAGE, (userPage + 1) * ITEMS_PER_PAGE);

  // User management actions — returns { success, data, error }
  const callUserManagement = async (action: string, target_user_id: string, extra: any = {}) => {
    setUserActionLoading(true);
    try {
      const res = await supabase.functions.invoke("admin-user-management", {
        body: { action, target_user_id, ...extra },
      });
      // When edge function returns 4xx, supabase-js puts a generic message in res.error
      // and the actual JSON body in res.data. Prefer res.data.error for user-friendly message.
      const errorMsg = res.data?.error || res.error?.message;
      if (errorMsg) {
        toast({ title: "Action Failed", description: errorMsg, variant: "destructive" });
        return { success: false, error: errorMsg };
      }
      toast({ title: "Success", description: res.data?.message || "Action completed" });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-user-roles"] });
      return { success: true, data: res.data };
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
      return { success: false, error: e.message };
    } finally {
      setUserActionLoading(false);
    }
  };

  const handleSuspendUser = async () => {
    if (!suspendTarget) return;
    await callUserManagement("suspend", suspendTarget.id, { reason: suspendReason });
    setSuspendDialog(false);
    setSuspendTarget(null);
    setSuspendReason("");
  };

  const handleUnsuspendUser = async (userId: string) => {
    await callUserManagement("unsuspend", userId);
  };

  const handleDeleteUser = async () => {
    if (!deleteTarget) return;
    const result = await callUserManagement("delete", deleteTarget.id);
    if (result?.success) {
      setDeleteDialog(false);
      setDeleteTarget(null);
    }
    // If failed (e.g. user has orders), dialog stays open and toast shows error
  };

  const handleRoleChange = async (newRole?: string) => {
    if (!roleTarget) return;
    const role = newRole || (roleTarget.currentRole === "admin" ? "user" : "admin");
    await callUserManagement("change_role", roleTarget.id, { role });
    setRoleDialog(false);
    setRoleTarget(null);
  };

  const openEditUser = async (userId: string) => {
    const profile = allProfiles?.find((p: any) => p.user_id === userId);
    if (!profile) return;
    setUserEditTarget(userId);
    setUserEditForm({
      full_name: profile.full_name || "",
      phone: profile.phone || "",
      email: "",
      city: profile.city || "",
      address_line1: profile.address_line1 || "",
      address_line2: profile.address_line2 || "",
      postal_code: profile.postal_code || "",
    });
    setUserEditDialog(true);
  };

  const handleSaveEditUser = async () => {
    if (!userEditTarget) return;
    try {
      await callUserManagement("update_profile", userEditTarget, {
        full_name: userEditForm.full_name,
        phone: userEditForm.phone,
        city: userEditForm.city,
        address_line1: userEditForm.address_line1,
        address_line2: userEditForm.address_line2,
        postal_code: userEditForm.postal_code,
      });
      if (userEditForm.email.trim()) {
        await callUserManagement("update_email", userEditTarget, { email: userEditForm.email.trim() });
      }
      setUserEditDialog(false);
      setUserEditTarget(null);
    } catch {}
  };

  const filteredReviews = allReviews?.filter((r: any) => !reviewSearch || (r.products?.name || "").toLowerCase().includes(reviewSearch.toLowerCase()) || (r.comment || "").toLowerCase().includes(reviewSearch.toLowerCase()));
  const totalReviewPages = Math.ceil((filteredReviews?.length || 0) / ITEMS_PER_PAGE);
  const paginatedReviews = filteredReviews?.slice(reviewPage * ITEMS_PER_PAGE, (reviewPage + 1) * ITEMS_PER_PAGE);

  const filteredContacts = contactMessages?.filter((m: any) => !contactSearch || (m.email || "").toLowerCase().includes(contactSearch.toLowerCase()) || (m.name || "").toLowerCase().includes(contactSearch.toLowerCase()) || (m.subject || "").toLowerCase().includes(contactSearch.toLowerCase()));
  const totalContactPages = Math.ceil((filteredContacts?.length || 0) / ITEMS_PER_PAGE);
  const paginatedContacts = filteredContacts?.slice(contactPage * ITEMS_PER_PAGE, (contactPage + 1) * ITEMS_PER_PAGE);

  const filteredSmsLogs = smsLogs?.filter((l: any) => !smsLogSearch || (l.phone || "").includes(smsLogSearch) || (l.status || "").toLowerCase().includes(smsLogSearch.toLowerCase()) || (l.template_key || "").toLowerCase().includes(smsLogSearch.toLowerCase()));
  const totalSmsLogPages = Math.ceil((filteredSmsLogs?.length || 0) / ITEMS_PER_PAGE);
  const paginatedSmsLogs = filteredSmsLogs?.slice(smsLogPage * ITEMS_PER_PAGE, (smsLogPage + 1) * ITEMS_PER_PAGE);

  // Reusable pagination renderer
  const renderPagination = (currentPage: number, totalPages: number, setPage: (p: number | ((prev: number) => number)) => void, totalItems: number) => {
    if (totalPages <= 1) return null;
    return (
      <div className="flex items-center justify-between mt-4">
        <p className="text-xs text-muted-foreground">
          Showing {currentPage * ITEMS_PER_PAGE + 1}–{Math.min((currentPage + 1) * ITEMS_PER_PAGE, totalItems)} of {totalItems}
        </p>
        <div className="flex gap-1">
          <Button variant="outline" size="sm" disabled={currentPage === 0} onClick={() => setPage(p => p - 1)}>Previous</Button>
          {Array.from({ length: totalPages }, (_, i) => (
            <Button key={i} variant={currentPage === i ? "default" : "outline"} size="sm" onClick={() => setPage(i)} className="w-8 h-8 p-0">{i + 1}</Button>
          )).slice(Math.max(0, currentPage - 2), currentPage + 3)}
          <Button variant="outline" size="sm" disabled={currentPage >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      </div>
    );
  };

  // ── Product CRUD ──
  const openAddProduct = () => { setEditingProductId(null); setProductForm(emptyProduct); setProductImagePreviews([]); setLcscPartNumber(""); setLcscFailed(false); setLcscFailedMpn(""); setLcscFailedLcscNum(""); setProductDialog(true); };
  const openAddMicroProduct = () => {
    setEditingProductId(null);
    const microCat = categories?.find(c => c.name.toLowerCase().includes("micro"));
    setProductForm({ ...emptyProduct, category_id: microCat?.id || "" });
    setProductImagePreviews([]);
    setLcscPartNumber("");
    setLcscFailed(false);
    setLcscFailedMpn("");
    setLcscFailedLcscNum("");
    setProductDialog(true);
  };
  const openEditProduct = (p: any) => {
    setEditingProductId(p.id);
    const imgs = p.images || [];
    setProductImagePreviews(imgs);
    const specs = (p as any).specifications || {};
    setProductForm({
      name: p.name, slug: p.slug, description: p.description || "", price: String(p.price),
      discount_price: p.discount_price ? String(p.discount_price) : "", cost_price: (p as any).cost_price ? String((p as any).cost_price) : "",
      sku: p.sku || "",
      stock_quantity: String(p.stock_quantity || 0), category_id: p.category_id || "",
      images: imgs.join(", "), is_active: p.is_active ?? true, is_featured: p.is_featured ?? false,
      video_url: (p as any).video_url || "", datasheet_url: (p as any).datasheet_url || "",
      shipping_type: specs._shipping_type || "local",
      ships_from: specs._ships_from || "",
      delivery_eta: specs._delivery_eta || "",
    });
    setProductDialog(true);
  };

  const handleProductImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    const newUrls: string[] = [];
    for (const file of Array.from(files)) {
      const url = await uploadFile(file, "products");
      if (url) newUrls.push(url);
    }
    const allUrls = [...productImagePreviews, ...newUrls];
    setProductImagePreviews(allUrls);
    setProductForm((prev) => ({ ...prev, images: allUrls.join(", ") }));
    setUploading(false);
    e.target.value = "";
  };

  const removeProductImage = (index: number) => {
    const updated = productImagePreviews.filter((_, i) => i !== index);
    setProductImagePreviews(updated);
    setProductForm((prev) => ({ ...prev, images: updated.join(", ") }));
  };

  const handleCategoryImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    const url = await uploadFile(files[0], "categories");
    if (url) setCategoryForm((prev) => ({ ...prev, image_url: url }));
    setUploading(false);
    e.target.value = "";
  };

  const handleBannerImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    const url = await uploadFile(files[0], "banners");
    if (url) setBannerForm((prev) => ({ ...prev, image_url: url }));
    setUploading(false);
    e.target.value = "";
  };

  const handleComboImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    const newUrls: string[] = [];
    for (const file of Array.from(files)) {
      const url = await uploadFile(file, "combos");
      if (url) newUrls.push(url);
    }
    const allUrls = [...comboImagePreviews, ...newUrls];
    setComboImagePreviews(allUrls);
    setComboForm((prev) => ({ ...prev, images: allUrls.join(", ") }));
    setUploading(false);
    e.target.value = "";
  };

  const saveProduct = async () => {
    // Merge shipping fields into specifications
    const existingSpecs = editingProductId
      ? ((products?.find(p => p.id === editingProductId) as any)?.specifications || {})
      : {};
    const mergedSpecs = {
      ...existingSpecs,
      _shipping_type: productForm.shipping_type || "local",
      _ships_from: productForm.ships_from || null,
      _delivery_eta: productForm.delivery_eta || null,
    };
    const payload: any = {
      name: productForm.name,
      slug: productForm.slug || productForm.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
      description: productForm.description || null,
      price: Number(productForm.price),
      discount_price: productForm.discount_price ? Number(productForm.discount_price) : null,
      cost_price: productForm.cost_price ? Number(productForm.cost_price) : null,
      sku: productForm.sku || null,
      stock_quantity: Number(productForm.stock_quantity) || 0,
      category_id: productForm.category_id || null,
      images: productForm.images ? productForm.images.split(",").map((s) => s.trim()).filter(Boolean) : [],
      is_active: productForm.is_active,
      is_featured: productForm.is_featured,
      video_url: productForm.video_url || null,
      datasheet_url: productForm.datasheet_url || null,
      specifications: mergedSpecs,
    };
    if (editingProductId) {
      const { error } = await supabase.from("products").update(payload).eq("id", editingProductId);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Product updated" });
    } else {
      const { error } = await supabase.from("products").insert(payload);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Product created" });
    }
    setProductDialog(false);
    queryClient.invalidateQueries({ queryKey: ["admin-products"] });
    queryClient.invalidateQueries({ queryKey: ["featured-products"] });
    queryClient.invalidateQueries({ queryKey: ["nav-categories"] });
  };

  const deleteProduct = async (id: string) => {
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Product deleted" });
    setSelectedProducts(prev => { const n = new Set(prev); n.delete(id); return n; });
    queryClient.invalidateQueries({ queryKey: ["admin-products"] });
  };

  const duplicateProduct = async (p: any) => {
    const specs = p.specifications || {};
    const payload: any = {
      name: `${p.name} (Copy)`,
      slug: `${p.slug}-copy-${Date.now()}`,
      description: p.description || null,
      price: p.price,
      discount_price: p.discount_price || null,
      cost_price: p.cost_price || null,
      sku: null,
      stock_quantity: p.stock_quantity || 0,
      category_id: p.category_id || null,
      images: p.images || [],
      is_active: false,
      is_featured: false,
      video_url: p.video_url || null,
      datasheet_url: p.datasheet_url || null,
      specifications: specs,
      attachments: p.attachments || [],
    };
    const { data, error } = await supabase.from("products").insert(payload).select().single();
    if (error) { toast({ title: "Duplicate failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Product duplicated", description: "Opens in edit mode as Inactive draft." });
    await queryClient.invalidateQueries({ queryKey: ["admin-products"] });
    openEditProduct(data);
  };

  const toggleProductSelection = (id: string) => {
    setSelectedProducts(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const toggleSelectAllProducts = () => {
    if (!paginatedProducts) return;
    const allOnPage = paginatedProducts.map(p => p.id);
    const allSelected = allOnPage.every(id => selectedProducts.has(id));
    if (allSelected) {
      setSelectedProducts(prev => {
        const n = new Set(prev);
        allOnPage.forEach(id => n.delete(id));
        return n;
      });
    } else {
      setSelectedProducts(prev => {
        const n = new Set(prev);
        allOnPage.forEach(id => n.add(id));
        return n;
      });
    }
  };

  const bulkDeleteProducts = async () => {
    setBulkDeleting(true);
    setConfirmBulkDelete(false);
    let deleted = 0;
    let failed = 0;
    const failedNames: string[] = [];
    for (const id of selectedProducts) {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) {
        failed++;
        const p = products?.find(p => p.id === id);
        failedNames.push(p?.name || id.slice(0, 8));
      } else {
        deleted++;
      }
    }
    setSelectedProducts(new Set());
    setBulkDeleting(false);
    queryClient.invalidateQueries({ queryKey: ["admin-products"] });
    if (failed > 0) {
      toast({
        title: `Deleted ${deleted}, failed ${failed}`,
        description: `Could not delete: ${failedNames.join(", ")}`,
        variant: "destructive",
      });
    } else {
      toast({ title: `${deleted} products deleted successfully` });
    }
  };

  // ── Category CRUD ──
  const openAddCategory = () => { setEditingCategoryId(null); setCategoryForm(emptyCategory); setCategoryDialog(true); };
  const openEditCategory = (c: any) => {
    setEditingCategoryId(c.id);
    setCategoryForm({ name: c.name, slug: c.slug, description: c.description || "", image_url: c.image_url || "", sort_order: String(c.sort_order || 0), is_active: c.is_active ?? true });
    setCategoryDialog(true);
  };
  const saveCategory = async () => {
    const payload = { name: categoryForm.name, slug: categoryForm.slug || categoryForm.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""), description: categoryForm.description || null, image_url: categoryForm.image_url || null, sort_order: Number(categoryForm.sort_order) || 0, is_active: categoryForm.is_active };
    if (editingCategoryId) {
      const { error } = await supabase.from("categories").update(payload).eq("id", editingCategoryId);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Category updated" });
    } else {
      const { error } = await supabase.from("categories").insert(payload);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Category created" });
    }
    setCategoryDialog(false);
    queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
    queryClient.invalidateQueries({ queryKey: ["nav-categories"] });
  };
  const deleteCategory = async (id: string) => {
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Category deleted" });
    queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
    queryClient.invalidateQueries({ queryKey: ["nav-categories"] });
  };

  // ── Banner CRUD ──
  const openAddBanner = () => { setEditingBannerId(null); setBannerForm(emptyBanner); setBannerDialog(true); };
  const openEditBanner = (b: any) => {
    setEditingBannerId(b.id);
    setBannerForm({ title: b.title, subtitle: b.subtitle || "", image_url: b.image_url, link_url: b.link_url || "", sort_order: String(b.sort_order || 0), is_active: b.is_active ?? true });
    setBannerDialog(true);
  };
  const saveBanner = async () => {
    const payload = { title: bannerForm.title, subtitle: bannerForm.subtitle || null, image_url: bannerForm.image_url, link_url: bannerForm.link_url || null, sort_order: Number(bannerForm.sort_order) || 0, is_active: bannerForm.is_active };
    if (editingBannerId) {
      const { error } = await supabase.from("banners").update(payload).eq("id", editingBannerId);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Banner updated" });
    } else {
      const { error } = await supabase.from("banners").insert(payload);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Banner created" });
    }
    setBannerDialog(false);
    queryClient.invalidateQueries({ queryKey: ["admin-banners"] });
    queryClient.invalidateQueries({ queryKey: ["active-banners"] });
  };
  const deleteBanner = async (id: string) => {
    const { error } = await supabase.from("banners").delete().eq("id", id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Banner deleted" });
    queryClient.invalidateQueries({ queryKey: ["admin-banners"] });
    queryClient.invalidateQueries({ queryKey: ["active-banners"] });
  };

  // ── Deal CRUD ──
  const openAddDeal = () => { setEditingDealId(null); setDealForm(emptyDeal); setDealDialog(true); };
  const openEditDeal = (d: any) => {
    setEditingDealId(d.id);
    setDealForm({ product_id: d.product_id, discount_percent: String(d.discount_percent), deal_price: d.deal_price ? String(d.deal_price) : "", starts_at: d.starts_at ? new Date(d.starts_at).toISOString().slice(0, 16) : "", ends_at: d.ends_at ? new Date(d.ends_at).toISOString().slice(0, 16) : "", is_active: d.is_active ?? true });
    setDealDialog(true);
  };
  const saveDeal = async () => {
    const payload = { product_id: dealForm.product_id, discount_percent: Number(dealForm.discount_percent) || 0, deal_price: dealForm.deal_price ? Number(dealForm.deal_price) : null, starts_at: dealForm.starts_at ? new Date(dealForm.starts_at).toISOString() : new Date().toISOString(), ends_at: new Date(dealForm.ends_at).toISOString(), is_active: dealForm.is_active };
    if (editingDealId) {
      const { error } = await supabase.from("daily_deals").update(payload).eq("id", editingDealId);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Deal updated" });
    } else {
      const { error } = await supabase.from("daily_deals").insert(payload);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Deal created" });
    }
    setDealDialog(false);
    queryClient.invalidateQueries({ queryKey: ["admin-deals"] });
    queryClient.invalidateQueries({ queryKey: ["daily-deals"] });
  };
  const deleteDeal = async (id: string) => {
    const { error } = await supabase.from("daily_deals").delete().eq("id", id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Deal deleted" });
    queryClient.invalidateQueries({ queryKey: ["admin-deals"] });
    queryClient.invalidateQueries({ queryKey: ["daily-deals"] });
  };

  // ── Page CRUD ──
  const openEditPage = (p: any) => {
    setEditingPageId(p.id);
    setPageForm({ title: p.title, slug: p.slug, content: p.content || "", is_published: p.is_published ?? true });
    setPageDialog(true);
  };
  const openAddPage = () => { setEditingPageId(null); setPageForm(emptyPage); setPageDialog(true); };
  const savePage = async () => {
    const payload = { title: pageForm.title, slug: pageForm.slug || pageForm.title.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""), content: pageForm.content, is_published: pageForm.is_published };
    if (editingPageId) {
      const { error } = await supabase.from("pages").update(payload).eq("id", editingPageId);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Page updated" });
    } else {
      const { error } = await supabase.from("pages").insert(payload);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Page created" });
    }
    setPageDialog(false);
    queryClient.invalidateQueries({ queryKey: ["admin-pages"] });
  };
  const deletePage = async (id: string) => {
    const { error } = await supabase.from("pages").delete().eq("id", id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Page deleted" });
    queryClient.invalidateQueries({ queryKey: ["admin-pages"] });
  };

  // ── Coupon CRUD ──
  const openAddCoupon = () => { setEditingCouponId(null); setCouponForm(emptyCoupon); setCouponDialog(true); };
  const openEditCoupon = (c: any) => {
    setEditingCouponId(c.id);
    setCouponForm({
      code: c.code, name: c.name || "", description: c.description || "", discount_type: c.discount_type,
      discount_value: String(c.discount_value), min_order_amount: c.min_order_amount ? String(c.min_order_amount) : "",
      max_uses: c.max_uses ? String(c.max_uses) : "", is_active: c.is_active ?? true,
      expires_at: c.expires_at ? new Date(c.expires_at).toISOString().slice(0, 16) : "",
      coupon_type: c.coupon_type || "public", max_discount_cap: c.max_discount_cap ? String(c.max_discount_cap) : "",
      per_user_limit: c.per_user_limit ? String(c.per_user_limit) : "",
      starts_at: c.starts_at ? new Date(c.starts_at).toISOString().slice(0, 16) : "",
      category_scope: c.category_scope || "all", valid_category_ids: c.valid_category_ids || [],
      assigned_phones: "",
    });
    // Load assignments for private coupons
    if (c.coupon_type === "private") {
      supabase.from("coupon_assignments" as any).select("phone").eq("coupon_id", c.id).then(({ data }) => {
        if (data) setCouponForm(prev => ({ ...prev, assigned_phones: (data as any[]).map((a: any) => a.phone).join(", ") }));
      });
    }
    setCouponDialog(true);
  };
  const saveCoupon = async () => {
    const payload: any = {
      code: couponForm.code.toUpperCase().trim(),
      name: couponForm.name || null,
      description: couponForm.description || null,
      discount_type: couponForm.discount_type,
      discount_value: Number(couponForm.discount_value) || 0,
      min_order_amount: couponForm.min_order_amount ? Number(couponForm.min_order_amount) : 0,
      max_uses: couponForm.max_uses ? Number(couponForm.max_uses) : null,
      is_active: couponForm.is_active,
      expires_at: couponForm.expires_at ? new Date(couponForm.expires_at).toISOString() : null,
      coupon_type: couponForm.coupon_type,
      max_discount_cap: couponForm.max_discount_cap ? Number(couponForm.max_discount_cap) : null,
      per_user_limit: couponForm.per_user_limit ? Number(couponForm.per_user_limit) : null,
      starts_at: couponForm.starts_at ? new Date(couponForm.starts_at).toISOString() : null,
      category_scope: couponForm.category_scope,
      valid_category_ids: couponForm.category_scope !== "all" ? couponForm.valid_category_ids : [],
    };
    let couponId = editingCouponId;
    if (editingCouponId) {
      const { error } = await supabase.from("coupons").update(payload).eq("id", editingCouponId);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Coupon updated" });
    } else {
      const { data, error } = await supabase.from("coupons").insert(payload).select().single();
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      couponId = data.id;
      toast({ title: "Coupon created" });
    }
    // Handle private coupon assignments
    if (couponForm.coupon_type === "private" && couponId && couponForm.assigned_phones.trim()) {
      // Clear existing assignments
      await supabase.from("coupon_assignments" as any).delete().eq("coupon_id", couponId);
      const phones = couponForm.assigned_phones.split(",").map(p => p.trim()).filter(Boolean);
      if (phones.length > 0) {
        const assignments = phones.map(phone => ({ coupon_id: couponId, phone: phone.replace(/\s/g, "") }));
        await supabase.from("coupon_assignments" as any).insert(assignments);
      }
    }
    setCouponDialog(false);
    queryClient.invalidateQueries({ queryKey: ["admin-coupons"] });
  };
  const deleteCoupon = async (id: string) => {
    const { error } = await supabase.from("coupons").delete().eq("id", id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Coupon deleted" });
    queryClient.invalidateQueries({ queryKey: ["admin-coupons"] });
  };

  // ── Contact messages ──
  const markAsRead = async (id: string) => {
    const { error } = await supabase.from("contact_messages").update({ is_read: true }).eq("id", id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    queryClient.invalidateQueries({ queryKey: ["admin-contacts"] });
  };
  const deleteContact = async (id: string) => {
    const { error } = await supabase.from("contact_messages").delete().eq("id", id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Message deleted" });
    queryClient.invalidateQueries({ queryKey: ["admin-contacts"] });
  };

  // ── Admin conversation reply ──
  const sendAdminReply = async () => {
    if (!adminReplyText.trim() || !adminSelectedConvo) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    setAdminSendingReply(true);
    try {
      const { error } = await supabase.from("conversation_messages" as any).insert({
        conversation_id: adminSelectedConvo,
        sender_id: session.user.id,
        sender_type: "admin",
        message: adminReplyText.trim(),
      });
      if (error) throw error;
      setAdminReplyText("");
      queryClient.invalidateQueries({ queryKey: ["admin-convo-messages", adminSelectedConvo] });
      queryClient.invalidateQueries({ queryKey: ["admin-conversations"] });
      toast({ title: "Reply sent" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setAdminSendingReply(false);
    }
  };

  // ── Order status ──
  const sendOrderSms = useCallback(async (orderId: string, status: string, tracking_code?: string) => {
    try {
      await supabase.functions.invoke("send-order-sms", {
        body: { order_id: orderId, status, tracking_code },
      });
    } catch (e) {
      console.error("SMS send failed:", e);
    }
  }, []);

  const openOrderDetail = (order: any) => {
    setSelectedOrder(order);
    setOrderDetailDialog(true);
  };

  const saveOrderDeliveryUpdate = async () => {
    if (!selectedOrder) return;
    const orderId = selectedOrder.id;
    const prevStatus = selectedOrder.status;
    const newStatus = orderDeliveryForm.status;

    // Update orders table
    const { error } = await supabase.from("orders").update({
      status: newStatus,
      tracking_number: orderDeliveryForm.tracking_number || null,
      courier_name: orderDeliveryForm.courier_name || null,
      tracking_link: orderDeliveryForm.tracking_link || null,
      expected_delivery: orderDeliveryForm.expected_delivery || null,
      delivery_note: orderDeliveryForm.delivery_note || null,
    } as any).eq("id", orderId);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }

    // Insert status history entry
    const { data: { session } } = await supabase.auth.getSession();
    await supabase.from("order_status_history" as any).insert({
      order_id: orderId,
      status: newStatus,
      note: orderDeliveryForm.delivery_note || null,
      tracking_number: orderDeliveryForm.tracking_number || null,
      courier_name: orderDeliveryForm.courier_name || null,
      tracking_link: orderDeliveryForm.tracking_link || null,
      expected_delivery: orderDeliveryForm.expected_delivery || null,
      changed_by: session?.user?.id || null,
    } as any);

    // Send SMS only if status actually changed
    if (newStatus !== prevStatus) {
      sendOrderSms(orderId, newStatus, orderDeliveryForm.tracking_number || undefined);
    }

    toast({ title: "Order updated successfully" });
    setOrderDetailDialog(false);
    queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
  };

  const updateOrderStatus = async (orderId: string, status: string) => {
    const { error } = await supabase.from("orders").update({ status }).eq("id", orderId);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    // Insert history
    const { data: { session } } = await supabase.auth.getSession();
    await supabase.from("order_status_history" as any).insert({
      order_id: orderId, status, changed_by: session?.user?.id || null,
    } as any);
    toast({ title: `Order status changed to ${status}` });
    sendOrderSms(orderId, status);
    queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
  };
  const updatePaymentStatus = async (orderId: string, payment_status: string) => {
    const { error } = await supabase.from("orders").update({ payment_status }).eq("id", orderId);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: `Payment status changed to ${payment_status}` });
    if (payment_status === "paid") sendOrderSms(orderId, "paid");
    queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
  };

  // ── Review moderation ──
  const deleteReview = async (id: string) => {
    const { error } = await supabase.from("reviews").delete().eq("id", id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Review deleted" });
    queryClient.invalidateQueries({ queryKey: ["admin-reviews"] });
  };

  // ── SMS Log delete ──
  const deleteSmsLog = async (id: string) => {
    if (!confirm("Delete this SMS log?")) return;
    const { error } = await supabase.from("sms_logs" as any).delete().eq("id", id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "SMS log deleted" });
    queryClient.invalidateQueries({ queryKey: ["admin-sms-logs"] });
  };
  const deleteAllSmsLogs = async () => {
    if (!confirm("Delete ALL SMS logs? This cannot be undone.")) return;
    const { error } = await supabase.from("sms_logs" as any).delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "All SMS logs deleted" });
    queryClient.invalidateQueries({ queryKey: ["admin-sms-logs"] });
  };

  // ── SEO Settings ──
  const saveSeoSettings = async () => {
    if (!seoForm) return;
    const { data: existing } = await supabase.from("site_settings" as any).select("id").eq("key", "seo").maybeSingle();
    if (existing) {
      const { error } = await supabase.from("site_settings" as any).update({ value: seoForm, updated_at: new Date().toISOString() } as any).eq("key", "seo");
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    } else {
      const { error } = await supabase.from("site_settings" as any).insert({ key: "seo", value: seoForm } as any);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    }
    toast({ title: "SEO settings saved" });
    queryClient.invalidateQueries({ queryKey: ["admin-seo"] });
    queryClient.invalidateQueries({ queryKey: ["site-seo-settings"] });
  };

  // ── Company Settings ──
  const saveCompanySettings = async () => {
    if (!companyForm) return;
    const { data: existing } = await supabase.from("site_settings" as any).select("id").eq("key", "company").maybeSingle();
    if (existing) {
      const { error } = await supabase.from("site_settings" as any).update({ value: companyForm, updated_at: new Date().toISOString() } as any).eq("key", "company");
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    } else {
      const { error } = await supabase.from("site_settings" as any).insert({ key: "company", value: companyForm } as any);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    }
    toast({ title: "Company info saved" });
    queryClient.invalidateQueries({ queryKey: ["admin-company"] });
    queryClient.invalidateQueries({ queryKey: ["site-company-settings"] });
  };

  // ── Bank Details Settings (multiple accounts) ──
  const addBankAccount = () => {
    if (!bankForm) return;
    setBankForm([...bankForm, { bank_name: "", account_name: "", account_number: "", branch: "", additional_info: "" }]);
  };
  const removeBankAccount = (idx: number) => {
    if (!bankForm || bankForm.length <= 1) return;
    setBankForm(bankForm.filter((_: any, i: number) => i !== idx));
  };
  const updateBankAccount = (idx: number, field: string, value: string) => {
    if (!bankForm) return;
    const updated = [...bankForm];
    updated[idx] = { ...updated[idx], [field]: value };
    setBankForm(updated);
  };
  const saveBankSettings = async () => {
    if (!bankForm) return;
    const { data: existing } = await supabase.from("site_settings" as any).select("id").eq("key", "bank_details").maybeSingle();
    if (existing) {
      const { error } = await supabase.from("site_settings" as any).update({ value: bankForm, updated_at: new Date().toISOString() } as any).eq("key", "bank_details");
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    } else {
      const { error } = await supabase.from("site_settings" as any).insert({ key: "bank_details", value: bankForm } as any);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    }
    toast({ title: "Bank details saved" });
    queryClient.invalidateQueries({ queryKey: ["admin-bank"] });
    queryClient.invalidateQueries({ queryKey: ["site-bank-details"] });
  };

  // ── Promo Banner CRUD ──
  const emptyPromo = { title: "", subtitle: "", description: "", badge_text: "", image_url: "", link_url: "", gradient_from: "primary", sort_order: "0", is_active: true };
  const openAddPromo = () => { setEditingPromoId(null); setPromoForm(emptyPromo); setPromoDialog(true); };
  const openEditPromo = (p: any) => {
    setEditingPromoId(p.id);
    setPromoForm({ title: p.title, subtitle: p.subtitle || "", description: p.description || "", badge_text: p.badge_text || "", image_url: p.image_url || "", link_url: p.link_url || "", gradient_from: p.gradient_from || "primary", sort_order: String(p.sort_order || 0), is_active: p.is_active });
    setPromoDialog(true);
  };
  const savePromo = async () => {
    const payload = { title: promoForm.title, subtitle: promoForm.subtitle || null, description: promoForm.description || null, badge_text: promoForm.badge_text || null, image_url: promoForm.image_url, link_url: promoForm.link_url || null, gradient_from: promoForm.gradient_from, sort_order: parseInt(promoForm.sort_order) || 0, is_active: promoForm.is_active } as any;
    if (editingPromoId) {
      const { error } = await supabase.from("promo_banners" as any).update(payload).eq("id", editingPromoId);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    } else {
      const { error } = await supabase.from("promo_banners" as any).insert(payload);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    }
    toast({ title: editingPromoId ? "Promo banner updated" : "Promo banner added" });
    setPromoDialog(false);
    queryClient.invalidateQueries({ queryKey: ["admin-promo-banners"] });
    queryClient.invalidateQueries({ queryKey: ["active-promo-banners"] });
  };
  const deletePromo = async (id: string) => {
    if (!confirm("Delete this promo banner?")) return;
    await supabase.from("promo_banners" as any).delete().eq("id", id);
    toast({ title: "Promo banner deleted" });
    queryClient.invalidateQueries({ queryKey: ["admin-promo-banners"] });
    queryClient.invalidateQueries({ queryKey: ["active-promo-banners"] });
  };

  // ── Combo CRUD ──
  const openAddCombo = () => { setEditingComboId(null); setComboForm(emptyCombo); setComboImagePreviews([]); setComboDialog(true); };
  const openEditCombo = (c: any) => {
    setEditingComboId(c.id);
    const imgs = c.images || [];
    setComboImagePreviews(imgs);
    setComboForm({
      name: c.name, slug: c.slug, description: c.description || "",
      combo_price: String(c.combo_price), original_price: String(c.original_price),
      images: imgs.join(", "), is_active: c.is_active ?? true, is_featured: c.is_featured ?? false,
      items: (c.combo_pack_items || []).map((item: any) => ({ product_id: item.product_id, quantity: String(item.quantity) })),
      shipping_type: (c as any).shipping_type || "local",
      ships_from: (c as any).ships_from || "",
      delivery_eta: (c as any).delivery_eta || "",
    });
    if (comboForm.items.length === 0) setComboForm(prev => ({ ...prev, items: [{ product_id: "", quantity: "1" }] }));
    setComboDialog(true);
  };
  const saveCombo = async () => {
    const payload = {
      name: comboForm.name,
      slug: comboForm.slug || comboForm.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
      description: comboForm.description || null,
      combo_price: Number(comboForm.combo_price) || 0,
      original_price: Number(comboForm.original_price) || 0,
      images: comboForm.images ? comboForm.images.split(",").map(s => s.trim()).filter(Boolean) : [],
      is_active: comboForm.is_active,
      is_featured: comboForm.is_featured,
    };
    if (editingComboId) {
      const { error } = await supabase.from("combo_packs").update(payload).eq("id", editingComboId);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      // Delete old items and re-insert
      await supabase.from("combo_pack_items").delete().eq("combo_id", editingComboId);
      const validItems = comboForm.items.filter(i => i.product_id);
      if (validItems.length > 0) {
        await supabase.from("combo_pack_items").insert(validItems.map(i => ({ combo_id: editingComboId, product_id: i.product_id, quantity: Number(i.quantity) || 1 })));
      }
      toast({ title: "Combo pack updated" });
    } else {
      const { data, error } = await supabase.from("combo_packs").insert(payload).select("id").single();
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      const validItems = comboForm.items.filter(i => i.product_id);
      if (validItems.length > 0) {
        await supabase.from("combo_pack_items").insert(validItems.map(i => ({ combo_id: data.id, product_id: i.product_id, quantity: Number(i.quantity) || 1 })));
      }
      toast({ title: "Combo pack created" });
    }
    setComboDialog(false);
    queryClient.invalidateQueries({ queryKey: ["admin-combos"] });
    queryClient.invalidateQueries({ queryKey: ["combo-packs"] });
  };
  const deleteCombo = async (id: string) => {
    const { error } = await supabase.from("combo_packs").delete().eq("id", id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Combo pack deleted" });
    queryClient.invalidateQueries({ queryKey: ["admin-combos"] });
    queryClient.invalidateQueries({ queryKey: ["combo-packs"] });
  };

  // ── Delete Order ──
  const deleteOrder = async (id: string) => {
    if (!confirm("Are you sure you want to delete this order? This cannot be undone.")) return;
    // Delete order items first
    const { error: itemsError } = await supabase.from("order_items").delete().eq("order_id", id);
    if (itemsError) { toast({ title: "Error", description: itemsError.message, variant: "destructive" }); return; }
    const { error } = await supabase.from("orders").delete().eq("id", id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Order deleted" });
    queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
  };

  const reportData = useMemo(() => {
    if (!orders) return null;
    const totalSales = orders.length;
    const totalRevenue = orders.filter(o => o.payment_status === "paid").reduce((sum, o) => sum + Number(o.total), 0);
    const pendingRevenue = orders.filter(o => o.payment_status === "pending").reduce((sum, o) => sum + Number(o.total), 0);
    const monthlyMap = new Map<string, number>();
    orders.filter(o => o.payment_status === "paid").forEach(o => {
      const d = new Date(o.created_at!);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthlyMap.set(key, (monthlyMap.get(key) || 0) + Number(o.total));
    });
    const monthlyRevenue = Array.from(monthlyMap.entries()).sort().slice(-6).map(([month, total]) => ({ month, total }));
    const productSales = new Map<string, { name: string; qty: number; revenue: number; cost: number }>();
    orders.forEach(o => {
      (o.order_items as any[])?.forEach((item: any) => {
        const key = item.product_id;
        const existing = productSales.get(key) || { name: item.products?.name || "Unknown", qty: 0, revenue: 0, cost: 0 };
        existing.qty += item.quantity;
        existing.revenue += Number(item.total_price);
        // Find cost_price from products list
        const prod = products?.find(p => p.id === item.product_id);
        const costPrice = (prod as any)?.cost_price ? Number((prod as any).cost_price) : 0;
        existing.cost += costPrice * item.quantity;
        productSales.set(key, existing);
      });
    });
    const bestSellers = Array.from(productSales.values()).sort((a, b) => b.qty - a.qty).slice(0, 10);
    const paymentMethods = new Map<string, number>();
    orders.forEach(o => { paymentMethods.set(o.payment_method, (paymentMethods.get(o.payment_method) || 0) + 1); });
    const statusMap = new Map<string, number>();
    orders.forEach(o => { statusMap.set(o.status, (statusMap.get(o.status) || 0) + 1); });

    // Profit calculation (only paid orders)
    let totalCost = 0;
    orders.filter(o => o.payment_status === "paid").forEach(o => {
      (o.order_items as any[])?.forEach((item: any) => {
        const prod = products?.find(p => p.id === item.product_id);
        const costPrice = (prod as any)?.cost_price ? Number((prod as any).cost_price) : 0;
        totalCost += costPrice * item.quantity;
      });
    });
    const totalProfit = totalRevenue - totalCost;

    // Stock data
    const totalProducts = products?.length || 0;
    const totalStockValue = products?.reduce((sum, p) => sum + (Number(p.stock_quantity) || 0) * Number(p.price), 0) || 0;
    const totalStockCostValue = products?.reduce((sum, p) => sum + (Number(p.stock_quantity) || 0) * (Number((p as any).cost_price) || 0), 0) || 0;
    const totalStockQty = products?.reduce((sum, p) => sum + (Number(p.stock_quantity) || 0), 0) || 0;
    const lowStockProducts = products?.filter(p => (Number(p.stock_quantity) || 0) <= lowStockThreshold && (Number(p.stock_quantity) || 0) > 0 && p.is_active) || [];
    const outOfStockProducts = products?.filter(p => (Number(p.stock_quantity) || 0) === 0 && p.is_active) || [];

    return { totalSales, totalRevenue, pendingRevenue, monthlyRevenue, bestSellers, paymentMethods: Array.from(paymentMethods.entries()), statusBreakdown: Array.from(statusMap.entries()), totalProfit, totalCost, totalProducts, totalStockValue, totalStockCostValue, totalStockQty, lowStockProducts, outOfStockProducts };
  }, [orders, products, lowStockThreshold]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-secondary" />
      </div>
    );
  }

  if (!isAdmin && !isModerator) return null;

  // Moderator allowed tabs
  const moderatorTabs: Tab[] = ["orders", "delivery_updates"];
  const canAccessTab = (tabId: Tab) => isAdmin || moderatorTabs.includes(tabId);

  // Helper to get user role
  const getUserRole = (userId: string) => {
    const role = userRoles?.find(r => r.user_id === userId);
    return role?.role || "user";
  };

  const activeTabData = allTabs.find(t => t.id === tab);
  const activeGroupData = sidebarGroups.find(g => g.items.some(i => i.id === tab));

  return (
    <div className="min-h-screen bg-background">
      {/* ═══ Top Navbar ═══ */}
      <header className="sticky top-0 z-40 h-14 bg-card/95 backdrop-blur-md border-b border-border flex items-center px-4 md:px-6 gap-4 shadow-sm">
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="hidden md:flex items-center justify-center w-8 h-8 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
        >
          <Menu className="w-4.5 h-4.5" />
        </button>
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
            <span className="text-secondary-foreground font-bold text-sm font-display">N</span>
          </div>
          <span className="text-lg font-bold font-display text-foreground hidden sm:inline">NanoCircuit.lk</span>
        </Link>
        <div className="hidden md:flex items-center gap-1.5 text-sm text-muted-foreground ml-2">
          <span>/</span>
          <span className="text-foreground font-medium">{activeGroupData?.label}</span>
          <span>/</span>
          <span className="text-secondary font-semibold">{activeTabData?.label}</span>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          {pendingOrderCount > 0 && (
            <button onClick={() => { setTab("orders"); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/10 text-accent-foreground text-xs font-medium hover:bg-accent/20 transition-colors">
              <ShoppingBag className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Orders</span>
              <span className="w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">{pendingOrderCount}</span>
            </button>
          )}
          {unreadContacts > 0 && (
            <button onClick={() => { setTab("contacts"); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary/10 text-secondary text-xs font-medium hover:bg-secondary/20 transition-colors">
              <MessageSquare className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Messages</span>
              <span className="w-5 h-5 rounded-full bg-secondary text-secondary-foreground text-[10px] font-bold flex items-center justify-center">{unreadContacts}</span>
            </button>
          )}
          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${userRole === "admin" ? "bg-destructive/10 text-destructive" : "bg-accent/20 text-accent-foreground"}`}>
            {userRole}
          </span>
          <Link to="/" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <Eye className="w-3.5 h-3.5" /> <span className="hidden sm:inline">View Store</span>
          </Link>
          <button
            onClick={async () => { await supabase.auth.signOut(); window.location.href = "/"; }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      <div className="flex">
        {/* ═══ Sidebar ═══ */}
        <aside className={`hidden md:flex flex-col sticky top-14 h-[calc(100vh-3.5rem)] bg-card border-r border-border overflow-y-auto transition-all duration-300 ${sidebarCollapsed ? "w-16" : "w-64"}`}>
          <div className={`p-3 ${sidebarCollapsed ? "px-2" : "px-4"}`}>
            {!sidebarCollapsed && (
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-3 px-2">Navigation</p>
            )}
            <nav className="space-y-0.5">
              {sidebarGroups.map((group) => (
                <div key={group.label} className="mb-1">
                  {sidebarCollapsed ? (
                    <div className="flex flex-col items-center gap-0.5">
                      {group.items.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => { setTab(t.id); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                          title={t.label}
                          className={`relative w-10 h-10 flex items-center justify-center rounded-lg transition-all ${
                            tab === t.id
                              ? "bg-secondary/15 text-secondary shadow-sm"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted"
                          }`}
                        >
                          <t.icon className="w-4.5 h-4.5" />
                          {t.count > 0 && (
                            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[8px] font-bold flex items-center justify-center">{t.count > 99 ? "99" : t.count}</span>
                          )}
                        </button>
                      ))}
                      <div className="w-6 h-px bg-border my-1" />
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => toggleGroup(group.label)}
                        className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 hover:text-muted-foreground transition-colors"
                      >
                        <span className="flex items-center gap-2"><group.icon className="w-3 h-3" />{group.label}</span>
                        <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${openGroups[group.label] ? "rotate-0" : "-rotate-90"}`} />
                      </button>
                      <AnimatePresence initial={false}>
                        {openGroups[group.label] && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="ml-1 space-y-0.5 mb-1.5 mt-0.5">
                              {group.items.map((t) => (
                                <button
                                  key={t.id}
                                  onClick={() => { setTab(t.id); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-[13px] transition-all ${
                                    tab === t.id
                                      ? "bg-secondary/12 text-secondary font-semibold shadow-sm border border-secondary/10"
                                      : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
                                  }`}
                                >
                                  <span className="flex items-center gap-2.5">
                                    <t.icon className={`w-4 h-4 ${tab === t.id ? "text-secondary" : ""}`} />
                                    {t.label}
                                  </span>
                                  {t.count > 0 && (
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                                      tab === t.id ? "bg-secondary/20 text-secondary" : "bg-muted text-muted-foreground"
                                    }`}>{t.count}</span>
                                  )}
                                </button>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </>
                  )}
                </div>
              ))}
            </nav>
          </div>
        </aside>

        <main className="flex-1 p-4 md:p-8 min-w-0">
          {/* Mobile tabs */}
          <div className="flex md:hidden gap-2 mb-6 overflow-x-auto pb-2 -mx-4 px-4">
            {allTabs.map((t) => (
              <button
                key={t.id}
                onClick={() => { setTab(t.id); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-all ${
                  tab === t.id ? "bg-secondary text-secondary-foreground shadow-md" : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                <t.icon className="w-4 h-4" /> {t.label}
              </button>
            ))}
          </div>

          {/* ═══ Products Tab ═══ */}
          {tab === "products" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold font-display text-foreground">Products</h2>
                <div className="flex items-center gap-2">
                  {selectedProducts.size > 0 && (
                    <>
                      <span className="text-sm text-muted-foreground font-medium">Selected: {selectedProducts.size}</span>
                      <Button variant="outline" size="sm" onClick={() => setSelectedProducts(new Set())}>Clear</Button>
                      <Button variant="destructive" size="sm" className="gap-1.5" onClick={() => setConfirmBulkDelete(true)} disabled={bulkDeleting}>
                        {bulkDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        Delete ({selectedProducts.size})
                      </Button>
                    </>
                  )}
                  <Button onClick={openAddProduct} size="sm" className="gap-1.5"><Plus className="w-4 h-4" /> Add Product</Button>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <Input placeholder="Search products..." value={search} onChange={(e) => { setSearch(e.target.value); setProductPage(0); }} className="max-w-sm" />
                <Select value={productStockFilter} onValueChange={(v) => { setProductStockFilter(v); setProductPage(0); }}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Stock filter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Stock</SelectItem>
                    <SelectItem value="in">In Stock</SelectItem>
                    <SelectItem value="low">Low Stock (≤{lowStockThreshold})</SelectItem>
                    <SelectItem value="out">Out of Stock</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={productCategoryFilter} onValueChange={(v) => { setProductCategoryFilter(v); setProductPage(0); }}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th className="px-4 py-3 w-10">
                          <Checkbox
                            checked={paginatedProducts && paginatedProducts.length > 0 && paginatedProducts.every(p => selectedProducts.has(p.id))}
                            onCheckedChange={toggleSelectAllProducts}
                          />
                        </th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Product</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">SKU</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Price</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Stock</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedProducts?.map((p) => (
                        <tr key={p.id} className={`border-b border-border last:border-0 hover:bg-muted/30 transition-colors ${selectedProducts.has(p.id) ? "bg-secondary/5" : ""}`}>
                          <td className="px-4 py-3">
                            <Checkbox
                              checked={selectedProducts.has(p.id)}
                              onCheckedChange={() => toggleProductSelection(p.id)}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <img src={p.images?.[0] || "/placeholder.svg"} alt="" className="w-10 h-10 rounded-lg object-cover" />
                              <div>
                                <p className="font-medium text-foreground line-clamp-1">{p.name}</p>
                                <p className="text-xs text-muted-foreground">{(p.categories as any)?.name}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{p.sku || "—"}</td>
                          <td className="px-4 py-3 font-medium text-foreground">Rs. {p.price.toLocaleString()}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-medium ${(p.stock_quantity || 0) > 10 ? "text-secondary" : (p.stock_quantity || 0) > 0 ? "text-accent-foreground" : "text-destructive"}`}>
                              {p.stock_quantity || 0}{(p.stock_quantity || 0) <= lowStockThreshold && (p.stock_quantity || 0) > 0 ? " ⚠️" : ""}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${p.is_active ? "bg-secondary/10 text-secondary" : "bg-muted text-muted-foreground"}`}>
                              {p.is_active ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <button onClick={() => openEditProduct(p)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                              <button onClick={() => duplicateProduct(p)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Duplicate"><Copy className="w-3.5 h-3.5" /></button>
                              <button onClick={() => deleteProduct(p.id)} className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              {renderPagination(productPage, totalProductPages, setProductPage, filteredProducts?.length || 0)}
            </motion.div>
          )}

          {/* ═══ Micro Electronics Tab ═══ */}
          {tab === "micro_electronics" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold font-display text-foreground flex items-center gap-2">
                    <Wrench className="w-5 h-5 text-secondary" /> Micro Electronics
                  </h2>
                  <p className="text-sm text-muted-foreground mt-0.5">{microElectronicsProducts.length} products in this section</p>
                </div>
                <Button onClick={openAddMicroProduct} size="sm" className="gap-1.5">
                  <Plus className="w-4 h-4" /> Add Component
                </Button>
              </div>

              {/* LCSC Quick Import Banner */}
              <div className="mb-6 border border-secondary/30 rounded-xl p-4 bg-secondary/5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="flex-1">
                  <p className="font-semibold text-foreground text-sm flex items-center gap-2">
                    <ExternalLink className="w-4 h-4 text-secondary" /> LCSC Auto-Import
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">Enter a part number (C93216) or paste a full LCSC product URL to instantly import component data.</p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <Input
                    placeholder="C93216 or lcsc.com/…/C93216.html"
                    value={lcscPartNumber}
                    onChange={(e) => setLcscPartNumber(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { openAddMicroProduct(); } }}
                    className="w-56 text-xs"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => { openAddMicroProduct(); }}
                    className="shrink-0"
                  >
                    <Plus className="w-4 h-4" /> Import
                  </Button>
                </div>
              </div>

              {/* Products table */}
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Component</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">SKU / Part No.</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Price</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Stock</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {microElectronicsProducts.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                            <Wrench className="w-8 h-8 mx-auto mb-2 opacity-30" />
                            <p className="font-medium">No components yet</p>
                            <p className="text-xs mt-1">Click "Add Component" or use LCSC import above</p>
                          </td>
                        </tr>
                      ) : microElectronicsProducts.map((p) => (
                        <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <img src={p.images?.[0] || "/placeholder.svg"} alt="" className="w-10 h-10 rounded-lg object-cover border border-border" />
                              <div>
                                <p className="font-medium text-foreground line-clamp-1">{p.name}</p>
                                {p.datasheet_url && (
                                  <a href={p.datasheet_url} target="_blank" rel="noreferrer" className="text-xs text-secondary flex items-center gap-1 hover:underline">
                                    <FileDown className="w-3 h-3" /> Datasheet
                                  </a>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.sku || "—"}</td>
                          <td className="px-4 py-3 font-medium text-foreground">Rs. {p.price.toLocaleString()}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-medium ${(p.stock_quantity || 0) > 10 ? "text-secondary" : (p.stock_quantity || 0) > 0 ? "text-amber-600" : "text-destructive"}`}>
                              {p.stock_quantity || 0}{(p.stock_quantity || 0) <= lowStockThreshold && (p.stock_quantity || 0) > 0 ? " ⚠️" : ""}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${p.is_active ? "bg-secondary/10 text-secondary" : "bg-muted text-muted-foreground"}`}>
                              {p.is_active ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <button onClick={() => openEditProduct(p)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                              <button onClick={() => duplicateProduct(p)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Duplicate"><Copy className="w-3.5 h-3.5" /></button>
                              <button onClick={() => deleteProduct(p.id)} className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {/* ═══ Categories Tab ═══ */}
          {tab === "categories" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold font-display text-foreground">Categories</h2>
                <Button onClick={openAddCategory} size="sm" className="gap-1.5"><Plus className="w-4 h-4" /> Add Category</Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {categories?.map((c) => (
                  <div key={c.id} className="bg-card rounded-xl border border-border p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-foreground">{c.name}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">/{c.slug}</p>
                        {c.description && <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{c.description}</p>}
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => openEditCategory(c)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => deleteCategory(c.id)} className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${c.is_active ? "bg-secondary/10 text-secondary" : "bg-muted text-muted-foreground"}`}>{c.is_active ? "Active" : "Inactive"}</span>
                      <span className="text-xs text-muted-foreground">Order: {c.sort_order}</span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* ═══ Orders Tab ═══ */}
          {tab === "orders" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
                <h2 className="text-xl font-bold font-display text-foreground">Orders</h2>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      value={orderSearch}
                      onChange={(e) => { setOrderSearch(e.target.value); setOrderPage(0); }}
                      placeholder="Search Order ID, name, phone…"
                      className="h-8 text-xs pl-8 w-56"
                    />
                    {orderSearch && (
                      <button onClick={() => setOrderSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <Select value={orderStatusFilter} onValueChange={(v) => { setOrderStatusFilter(v); setOrderPage(0); }}>
                    <SelectTrigger className="h-8 text-xs w-40"><SelectValue placeholder="Filter by status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      {["pending", "confirmed", "paid", "processing", "packed", "shipped", "out_for_delivery", "delivered", "cancelled", "returned"].map((s) => (
                        <SelectItem key={s} value={s} className="capitalize text-xs">{s.replace(/_/g, " ")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {orders && orders.length > 0 ? (
                <div className="bg-card rounded-xl border border-border overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/50">
                          <th className="text-left px-4 py-3 font-medium text-muted-foreground">Order ID</th>
                          <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                          <th className="text-left px-4 py-3 font-medium text-muted-foreground">Total</th>
                          <th className="text-left px-4 py-3 font-medium text-muted-foreground">Method</th>
                          <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                          <th className="text-left px-4 py-3 font-medium text-muted-foreground">Payment</th>
                          <th className="text-left px-4 py-3 font-medium text-muted-foreground">Receipt</th>
                          <th className="text-left px-4 py-3 font-medium text-muted-foreground">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedOrders?.map((o) => (
                          <tr key={o.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                            <td className="px-4 py-3 font-mono text-xs text-foreground">{o.id.slice(0, 8)}</td>
                            <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(o.created_at!).toLocaleDateString()}</td>
                            <td className="px-4 py-3 font-medium text-foreground">Rs. {o.total.toLocaleString()}</td>
                            <td className="px-4 py-3">
                              <span className={`text-xs px-2 py-0.5 rounded-full ${o.payment_method === "stripe" ? "bg-secondary/10 text-secondary" : "bg-accent/10 text-accent-foreground"}`}>
                                {o.payment_method === "stripe" ? "Card" : "Bank"}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <Select value={o.status} onValueChange={(v) => updateOrderStatus(o.id, v)}>
                                <SelectTrigger className="h-7 text-xs w-32"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {["pending", "confirmed", "paid", "processing", "packed", "shipped", "out_for_delivery", "delivered", "cancelled", "returned"].map((s) => (
                                    <SelectItem key={s} value={s} className="capitalize text-xs">{s.replace(/_/g, " ")}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="px-4 py-3">
                              <Select value={o.payment_status} onValueChange={(v) => updatePaymentStatus(o.id, v)}>
                                <SelectTrigger className="h-7 text-xs w-24"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {["pending", "paid", "failed"].map((s) => (
                                    <SelectItem key={s} value={s} className="capitalize text-xs">{s}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="px-4 py-3">
                            {(o as any).receipt_url ? (
                                <a href={(o as any).receipt_url} target="_blank" rel="noopener noreferrer" className="text-xs text-secondary underline flex items-center gap-1"><Eye className="w-3 h-3" /> View</a>
                              ) : <span className="text-xs text-muted-foreground">—</span>}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1">
                                <button onClick={() => openOrderDetail(o)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="View order details"><Eye className="w-3.5 h-3.5" /></button>
                                <button onClick={() => deleteOrder(o.id)} className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title="Delete order"><Trash2 className="w-3.5 h-3.5" /></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="text-center py-16 text-muted-foreground">
                  <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No orders yet</p>
                </div>
              )}
              {renderPagination(orderPage, totalOrderPages, setOrderPage, filteredOrders?.length || 0)}
            </motion.div>
          )}

          {/* ═══ Delivery Updates Tab ═══ */}
          {tab === "delivery_updates" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold font-display text-foreground">Delivery Updates</h2>
                <p className="text-sm text-muted-foreground">Orders needing delivery action</p>
              </div>
              {(() => {
                const deliveryOrders = orders?.filter(o => ["confirmed", "paid", "processing", "packed", "shipped"].includes(o.status)) || [];
                return deliveryOrders.length > 0 ? (
                  <div className="bg-card rounded-xl border border-border overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border bg-muted/50">
                            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Order ID</th>
                            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Total</th>
                            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tracking</th>
                            <th className="text-left px-4 py-3 font-medium text-muted-foreground">ETA</th>
                            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {deliveryOrders.map((o) => (
                            <tr key={o.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                              <td className="px-4 py-3 font-mono text-xs text-foreground">{o.id.slice(0, 8)}</td>
                              <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(o.created_at!).toLocaleDateString()}</td>
                              <td className="px-4 py-3 font-medium text-foreground">Rs. {o.total.toLocaleString()}</td>
                              <td className="px-4 py-3">
                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${
                                  o.status === "shipped" ? "bg-secondary/10 text-secondary" :
                                  o.status === "packed" ? "bg-accent/10 text-accent-foreground" :
                                  "bg-muted text-muted-foreground"
                                }`}>{o.status?.replace(/_/g, " ")}</span>
                              </td>
                              <td className="px-4 py-3 text-xs text-muted-foreground">
                                {(o as any).tracking_number ? (
                                  <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{(o as any).tracking_number}</span>
                                ) : <span className="text-destructive/70">Not set</span>}
                              </td>
                              <td className="px-4 py-3 text-xs text-muted-foreground">
                                {(o as any).expected_delivery || <span className="text-destructive/70">Not set</span>}
                              </td>
                              <td className="px-4 py-3">
                                <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => openOrderDetail(o)}>
                                  <Truck className="w-3.5 h-3.5" /> Update
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-16 text-muted-foreground">
                    <Truck className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>No orders need delivery updates right now</p>
                  </div>
                );
              })()}
            </motion.div>
          )}

          {tab === "banners" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold font-display text-foreground">Banners</h2>
                <Button onClick={openAddBanner} size="sm" className="gap-1.5"><Plus className="w-4 h-4" /> Add Banner</Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {banners?.map((b) => (
                  <div key={b.id} className="bg-card rounded-xl border border-border overflow-hidden">
                    <img src={b.image_url} alt={b.title} className="w-full h-40 object-cover" />
                    <div className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-foreground">{b.title}</h3>
                          {b.subtitle && <p className="text-sm text-muted-foreground">{b.subtitle}</p>}
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => openEditBanner(b)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                          <button onClick={() => deleteBanner(b.id)} className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${b.is_active ? "bg-secondary/10 text-secondary" : "bg-muted text-muted-foreground"}`}>{b.is_active ? "Active" : "Inactive"}</span>
                        <span className="text-xs text-muted-foreground">Order: {b.sort_order}</span>
                      </div>
                    </div>
                  </div>
                ))}
                {(!banners || banners.length === 0) && (
                  <div className="col-span-2 text-center py-16 text-muted-foreground">
                    <Image className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>No banners yet</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ═══ Promo Banners Tab ═══ */}
          {tab === "promo_banners" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold font-display text-foreground">ප්‍රවර්ධන බැනර් / Promo Banners</h2>
                <Button onClick={openAddPromo} size="sm" className="gap-1.5"><Plus className="w-4 h-4" /> Add Promo</Button>
              </div>
              <div className="space-y-3">
                {promoBanners?.map((p: any) => (
                  <div key={p.id} className="bg-card rounded-xl border border-border p-4 flex items-center gap-4">
                    {p.image_url && <img src={p.image_url} alt={p.title} className="w-24 h-16 rounded-lg object-cover border border-border" />}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground">{p.title}</p>
                      <p className="text-xs text-muted-foreground">{p.description || "No description"}</p>
                      <div className="flex gap-2 mt-1">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${p.is_active ? "bg-secondary/10 text-secondary" : "bg-muted text-muted-foreground"}`}>{p.is_active ? "Active" : "Inactive"}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{p.gradient_from}</span>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEditPromo(p)}><Pencil className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deletePromo(p.id)}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </div>
                ))}
                {(!promoBanners || promoBanners.length === 0) && (
                  <div className="text-center py-16 text-muted-foreground">
                    <Image className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>No promo banners yet</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ═══ Daily Deals Tab ═══ */}
          {tab === "deals" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold font-display text-foreground">Daily Deals</h2>
                <Button onClick={openAddDeal} size="sm" className="gap-1.5"><Plus className="w-4 h-4" /> Add Deal</Button>
              </div>
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Product</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Discount</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Deal Price</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Ends At</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedDeals?.map((d) => {
                        const product = d.products as any;
                        const isExpired = new Date(d.ends_at) < new Date();
                        return (
                          <tr key={d.id} className={`border-b border-border last:border-0 hover:bg-muted/30 ${isExpired ? "opacity-50" : ""}`}>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <img src={product?.images?.[0] || "/placeholder.svg"} alt="" className="w-10 h-10 rounded-lg object-cover" />
                                <span className="font-medium text-foreground line-clamp-1">{product?.name || "Unknown"}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-destructive font-bold">-{d.discount_percent}%</td>
                            <td className="px-4 py-3 font-medium text-foreground">{d.deal_price ? `Rs. ${Number(d.deal_price).toLocaleString()}` : "—"}</td>
                            <td className="px-4 py-3 text-muted-foreground text-xs">
                              {new Date(d.ends_at).toLocaleString()}
                              {isExpired && <span className="ml-1 text-destructive font-semibold">(Expired)</span>}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${d.is_active && !isExpired ? "bg-secondary/10 text-secondary" : "bg-muted text-muted-foreground"}`}>
                                {isExpired ? "Expired" : d.is_active ? "Active" : "Inactive"}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1">
                                <button onClick={() => openEditDeal(d)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                                <button onClick={() => deleteDeal(d.id)} className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {(!deals || deals.length === 0) && (
                        <tr><td colSpan={6} className="text-center py-16 text-muted-foreground"><Tag className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>No daily deals yet</p></td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              {renderPagination(dealPage, totalDealPages, setDealPage, deals?.length || 0)}
            </motion.div>
          )}

          {/* ═══ Combo Packs Tab ═══ */}
          {tab === "combos" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold font-display text-foreground">Combo Packs</h2>
                <Button onClick={openAddCombo} size="sm" className="gap-1.5"><Plus className="w-4 h-4" /> Add Combo</Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                {comboPacks?.map((c: any) => {
                  const savings = c.original_price - c.combo_price;
                  return (
                    <div key={c.id} className="bg-card rounded-xl border border-border overflow-hidden">
                      <img src={c.images?.[0] || "/placeholder.svg"} alt={c.name} className="w-full h-40 object-cover" />
                      <div className="p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-semibold text-foreground">{c.name}</h3>
                            <p className="text-sm text-muted-foreground mt-0.5">
                              Rs. {Number(c.combo_price).toLocaleString()}
                              {savings > 0 && <span className="text-secondary ml-2">(Save Rs. {savings.toLocaleString()})</span>}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">{c.combo_pack_items?.length || 0} items</p>
                          </div>
                          <div className="flex gap-1">
                            <button onClick={() => openEditCombo(c)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                            <button onClick={() => deleteCombo(c.id)} className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${c.is_active ? "bg-secondary/10 text-secondary" : "bg-muted text-muted-foreground"}`}>{c.is_active ? "Active" : "Inactive"}</span>
                          {c.is_featured && <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent-foreground">Featured</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {(!comboPacks || comboPacks.length === 0) && (
                  <div className="col-span-3 text-center py-16 text-muted-foreground">
                    <Layers className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>No combo packs yet</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ═══ Pages Tab ═══ */}
          {tab === "pages" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold font-display text-foreground">Static Pages</h2>
                <Button onClick={openAddPage} size="sm" className="gap-1.5"><Plus className="w-4 h-4" /> Add Page</Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {pages?.map((p) => (
                  <div key={p.id} className="bg-card rounded-xl border border-border p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-foreground">{p.title}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">/{p.slug}</p>
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{p.content.slice(0, 100)}...</p>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => openEditPage(p)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => deletePage(p.id)} className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${p.is_published ? "bg-secondary/10 text-secondary" : "bg-muted text-muted-foreground"}`}>
                        {p.is_published ? "Published" : "Draft"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* ═══ Coupons Tab ═══ */}
          {tab === "coupons" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold font-display text-foreground">Coupons</h2>
                <Button onClick={openAddCoupon} size="sm" className="gap-1.5"><Plus className="w-4 h-4" /> Add Coupon</Button>
              </div>
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Code</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Type</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Discount</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Scope</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Usage</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Expires</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedCoupons?.map((c: any) => {
                        const isExpired = c.expires_at && new Date(c.expires_at) < new Date();
                        return (
                          <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                            <td className="px-4 py-3">
                              <p className="font-mono font-bold text-foreground">{c.code}</p>
                              {c.name && <p className="text-xs text-muted-foreground">{c.name}</p>}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${c.coupon_type === "private" ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"}`}>
                                {c.coupon_type === "private" ? <><Lock className="w-3 h-3 inline mr-0.5" />Private</> : "Public"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-foreground">
                              {c.discount_type === "percentage" ? `${c.discount_value}%` : `Rs. ${Number(c.discount_value).toLocaleString()}`}
                              {c.max_discount_cap && <span className="text-xs text-muted-foreground ml-1">(max Rs.{Number(c.max_discount_cap).toLocaleString()})</span>}
                            </td>
                            <td className="px-4 py-3 text-xs text-muted-foreground capitalize">{c.category_scope === "all" ? "All" : c.category_scope}</td>
                            <td className="px-4 py-3 text-muted-foreground">{c.used_count}{c.max_uses ? ` / ${c.max_uses}` : ""}</td>
                            <td className="px-4 py-3 text-muted-foreground text-xs">{c.expires_at ? new Date(c.expires_at).toLocaleDateString() : "Never"}</td>
                            <td className="px-4 py-3">
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${c.is_active && !isExpired ? "bg-secondary/10 text-secondary" : "bg-muted text-muted-foreground"}`}>
                                {isExpired ? "Expired" : c.is_active ? "Active" : "Inactive"}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1">
                                <button onClick={() => openEditCoupon(c)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                                <button onClick={() => deleteCoupon(c.id)} className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {(!coupons || coupons.length === 0) && (
                        <tr><td colSpan={8} className="text-center py-16 text-muted-foreground"><Ticket className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>No coupons yet</p></td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              {renderPagination(couponPage, totalCouponPages, setCouponPage, coupons?.length || 0)}
            </motion.div>
          )}

          {/* ═══ Wallet Management Tab ═══ */}
          {tab === "wallet" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold font-display text-foreground">User Wallets</h2>
              </div>
              <WalletManager profiles={allProfiles || []} />
            </motion.div>
          )}

          {/* ═══ Users Tab ═══ */}
          {tab === "users" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                <h2 className="text-xl font-bold font-display text-foreground">Users</h2>
                <div className="flex items-center gap-2 flex-wrap">
                  <Select value={userStatusFilter} onValueChange={(v) => { setUserStatusFilter(v); setUserPage(0); }}>
                    <SelectTrigger className="h-8 text-xs w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={userRoleFilter} onValueChange={(v) => { setUserRoleFilter(v); setUserPage(0); }}>
                    <SelectTrigger className="h-8 text-xs w-28"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Roles</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="moderator">Moderator</SelectItem>
                      <SelectItem value="user">User</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="relative w-56">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input placeholder="Search by name, phone, city..." value={userSearch} onChange={(e) => { setUserSearch(e.target.value); setUserPage(0); }} className="h-8 text-xs pl-8" />
                  </div>
                </div>
              </div>
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">User</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Phone</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">City</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Role</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Joined</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Orders</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedUsers?.map((p: any) => {
                        const role = getUserRole(p.user_id);
                        const userOrders = orders?.filter(o => o.user_id === p.user_id) || [];
                        const isSuspended = p.is_suspended;
                        return (
                          <tr key={p.id} className={`border-b border-border last:border-0 hover:bg-muted/30 ${isSuspended ? "opacity-60" : ""}`}>
                            <td className="px-4 py-3 cursor-pointer" onClick={() => { setSelectedUserId(p.user_id); setSelectedUserRole(role); setUserDetailOpen(true); }}>
                              <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${isSuspended ? "bg-destructive/10 text-destructive" : "bg-secondary/10 text-secondary"}`}>
                                  {(p.full_name || "U")[0].toUpperCase()}
                                </div>
                                <div>
                                  <p className="font-medium text-foreground">{p.full_name || "—"}</p>
                                  <p className="text-xs text-muted-foreground">{p.user_id.slice(0, 8)}...</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">{p.phone || "—"}</td>
                            <td className="px-4 py-3 text-muted-foreground">{p.city || "—"}</td>
                            <td className="px-4 py-3">
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${role === "admin" ? "bg-destructive/10 text-destructive" : role === "moderator" ? "bg-accent/20 text-accent-foreground" : "bg-muted text-muted-foreground"}`}>
                                {role}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${isSuspended ? "bg-destructive/10 text-destructive" : "bg-secondary/10 text-secondary"}`}>
                                {isSuspended ? "Suspended" : "Active"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground text-xs">{p.created_at ? new Date(p.created_at).toLocaleDateString() : "—"}</td>
                            <td className="px-4 py-3 text-foreground font-medium">{userOrders.length}</td>
                            <td className="px-4 py-3 text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={(e) => e.stopPropagation()}>
                                    <MoreVertical className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                  <DropdownMenuItem onClick={() => { setSelectedUserId(p.user_id); setSelectedUserRole(role); setUserDetailOpen(true); }}>
                                    <Eye className="w-4 h-4 mr-2" /> View Details
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => openEditUser(p.user_id)}>
                                    <Pencil className="w-4 h-4 mr-2" /> Edit User
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => { setRoleTarget({ id: p.user_id, name: p.full_name || "User", currentRole: role }); setRoleDialog(true); }}>
                                    <Shield className="w-4 h-4 mr-2" /> Change Role
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  {isSuspended ? (
                                    <DropdownMenuItem onClick={() => handleUnsuspendUser(p.user_id)} className="text-secondary">
                                      <UserCheck className="w-4 h-4 mr-2" /> Unsuspend
                                    </DropdownMenuItem>
                                  ) : (
                                    <DropdownMenuItem onClick={() => { setSuspendTarget({ id: p.user_id, name: p.full_name || "User" }); setSuspendDialog(true); }} className="text-destructive">
                                      <Ban className="w-4 h-4 mr-2" /> Suspend
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem onClick={() => { setDeleteTarget({ id: p.user_id, name: p.full_name || "User" }); setDeleteDialog(true); }} className="text-destructive">
                                    <UserX className="w-4 h-4 mr-2" /> Delete User
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </td>
                          </tr>
                        );
                      })}
                      {(!allProfiles || allProfiles.length === 0) && (
                        <tr><td colSpan={8} className="text-center py-16 text-muted-foreground"><Users className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>No users yet</p></td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              {renderPagination(userPage, totalUserPages, setUserPage, filteredUsers?.length || 0)}
              <UserDetailDialog open={userDetailOpen} onOpenChange={setUserDetailOpen} userId={selectedUserId} userRole={selectedUserRole} />

              {/* Suspend Dialog */}
              <AlertDialog open={suspendDialog} onOpenChange={setSuspendDialog}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Suspend User</AlertDialogTitle>
                    <AlertDialogDescription>
                      Suspend <strong>{suspendTarget?.name}</strong>? They will be unable to login, place orders, or use wallet/coupons.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="py-2">
                    <Label className="text-xs">Reason (optional)</Label>
                    <Input value={suspendReason} onChange={(e) => setSuspendReason(e.target.value)} placeholder="e.g. Violation of terms" className="mt-1" />
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleSuspendUser} disabled={userActionLoading} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      {userActionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Ban className="w-4 h-4 mr-1" />} Suspend
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              {/* Delete Dialog */}
              <AlertDialog open={deleteDialog} onOpenChange={setDeleteDialog}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete User</AlertDialogTitle>
                    <AlertDialogDescription>
                      Delete <strong>{deleteTarget?.name}</strong>? This cannot be undone. Users with existing orders cannot be deleted — use suspend instead.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={userActionLoading}>Cancel</AlertDialogCancel>
                    <Button
                      onClick={handleDeleteUser}
                      disabled={userActionLoading}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {userActionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <UserX className="w-4 h-4 mr-1" />} Delete
                    </Button>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              {/* Role Change Dialog */}
              <AlertDialog open={roleDialog} onOpenChange={setRoleDialog}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Change User Role</AlertDialogTitle>
                    <AlertDialogDescription>
                      Change the role for <strong>{roleTarget?.name}</strong>. Current role: <strong className="capitalize">{roleTarget?.currentRole}</strong>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="flex flex-col gap-2 py-3">
                    <Button
                      variant={roleTarget?.currentRole === "admin" ? "default" : "outline"}
                      size="sm"
                      className="justify-start gap-2"
                      disabled={roleTarget?.currentRole === "admin" || userActionLoading}
                      onClick={() => handleRoleChange("admin")}
                    >
                      <Shield className="w-4 h-4" /> Admin
                      <span className="text-xs text-muted-foreground ml-auto">Full access to everything</span>
                    </Button>
                    <Button
                      variant={roleTarget?.currentRole === "moderator" ? "default" : "outline"}
                      size="sm"
                      className="justify-start gap-2"
                      disabled={roleTarget?.currentRole === "moderator" || userActionLoading}
                      onClick={() => handleRoleChange("moderator")}
                    >
                      <Shield className="w-4 h-4" /> Moderator
                      <span className="text-xs text-muted-foreground ml-auto">Manage orders only</span>
                    </Button>
                    <Button
                      variant={roleTarget?.currentRole === "user" ? "default" : "outline"}
                      size="sm"
                      className="justify-start gap-2"
                      disabled={roleTarget?.currentRole === "user" || userActionLoading}
                      onClick={() => handleRoleChange("user")}
                    >
                      <Users className="w-4 h-4" /> User
                      <span className="text-xs text-muted-foreground ml-auto">No admin access</span>
                    </Button>
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              {/* Edit User Dialog */}
              <Dialog open={userEditDialog} onOpenChange={setUserEditDialog}>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Edit User</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs">Full Name</Label>
                      <Input value={userEditForm.full_name} onChange={(e) => setUserEditForm(prev => ({ ...prev, full_name: e.target.value }))} className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs">Email (leave empty to keep current)</Label>
                      <Input value={userEditForm.email} onChange={(e) => setUserEditForm(prev => ({ ...prev, email: e.target.value }))} placeholder="new@email.com" className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs">Phone</Label>
                      <Input value={userEditForm.phone} onChange={(e) => setUserEditForm(prev => ({ ...prev, phone: e.target.value }))} className="mt-1" />
                      <p className="text-[10px] text-muted-foreground mt-0.5">Changing phone resets verification status</p>
                    </div>
                    <div>
                      <Label className="text-xs">City</Label>
                      <Input value={userEditForm.city} onChange={(e) => setUserEditForm(prev => ({ ...prev, city: e.target.value }))} className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs">Address Line 1</Label>
                      <Input value={userEditForm.address_line1} onChange={(e) => setUserEditForm(prev => ({ ...prev, address_line1: e.target.value }))} className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs">Address Line 2</Label>
                      <Input value={userEditForm.address_line2} onChange={(e) => setUserEditForm(prev => ({ ...prev, address_line2: e.target.value }))} className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs">Postal Code</Label>
                      <Input value={userEditForm.postal_code} onChange={(e) => setUserEditForm(prev => ({ ...prev, postal_code: e.target.value }))} className="mt-1" />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <Button variant="outline" onClick={() => setUserEditDialog(false)}>Cancel</Button>
                      <Button onClick={handleSaveEditUser} disabled={userActionLoading}>
                        {userActionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />} Save
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </motion.div>
          )}

          {/* ═══ Reviews Tab ═══ */}
          {tab === "reviews" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold font-display text-foreground">Reviews Moderation</h2>
                <div className="relative w-56">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input placeholder="Search by product or comment..." value={reviewSearch} onChange={(e) => { setReviewSearch(e.target.value); setReviewPage(0); }} className="h-8 text-xs pl-8" />
                </div>
              </div>
              <div className="space-y-3">
                {paginatedReviews?.map((r: any) => (
                  <div key={r.id} className="bg-card rounded-xl border border-border p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Link to={`/product/${r.products?.slug}`} className="font-semibold text-foreground hover:text-secondary transition-colors">
                            {r.products?.name || "Unknown Product"}
                          </Link>
                          <div className="flex items-center">
                            {[...Array(5)].map((_, i) => (
                              <Star key={i} className={`w-3 h-3 ${i < r.rating ? "text-accent fill-accent" : "text-border"}`} />
                            ))}
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mb-1">User: {r.user_id.slice(0, 8)}... • {new Date(r.created_at!).toLocaleDateString()}</p>
                        {r.comment ? (
                          <p className="text-sm text-foreground">{r.comment}</p>
                        ) : (
                          <p className="text-sm text-muted-foreground italic">No comment</p>
                        )}
                      </div>
                      <button onClick={() => deleteReview(r.id)} className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0" title="Delete review">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                {(!allReviews || allReviews.length === 0) && (
                  <div className="text-center py-16 text-muted-foreground">
                    <Star className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>No reviews yet</p>
                  </div>
                )}
              </div>
              {renderPagination(reviewPage, totalReviewPages, setReviewPage, filteredReviews?.length || 0)}
            </motion.div>
          )}

          {/* ═══ Contact Messages Tab ═══ */}
          {tab === "contacts" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold font-display text-foreground">
                  {adminSelectedConvo ? "Conversation" : "Messages"}
                </h2>
                {adminSelectedConvo && (
                  <Button variant="outline" size="sm" onClick={() => setAdminSelectedConvo(null)}>← Back to list</Button>
                )}
              </div>

              {adminSelectedConvo ? (
                <div className="bg-card rounded-xl border border-border overflow-hidden">
                  <div className="p-4 space-y-3 max-h-[500px] overflow-y-auto">
                    {adminConvoMessages?.map((m: any) => (
                      <div key={m.id} className={`flex ${m.sender_type === "admin" ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[70%] rounded-xl px-4 py-2.5 text-sm ${
                          m.sender_type === "admin" ? "bg-secondary text-secondary-foreground" : "bg-muted text-foreground"
                        }`}>
                          <p className="text-[10px] font-medium mb-1 opacity-70">{m.sender_type === "admin" ? "You" : "Customer"}</p>
                          <p className="whitespace-pre-wrap">{m.message}</p>
                          <p className={`text-[10px] mt-1 opacity-60`}>
                            {new Date(m.created_at).toLocaleString("en-US", { hour: "numeric", minute: "2-digit", month: "short", day: "numeric" })}
                          </p>
                        </div>
                      </div>
                    ))}
                    {(!adminConvoMessages || adminConvoMessages.length === 0) && (
                      <p className="text-center text-muted-foreground text-sm py-8">No messages in this conversation</p>
                    )}
                  </div>
                  <div className="p-3 border-t border-border flex gap-2">
                    <Input placeholder="Type your reply..." value={adminReplyText} onChange={(e) => setAdminReplyText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendAdminReply(); } }} className="flex-1" />
                    <Button onClick={sendAdminReply} disabled={adminSendingReply || !adminReplyText.trim()} size="sm" className="gap-1.5">
                      <Send className="w-3.5 h-3.5" /> Reply
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Conversations */}
                  {adminConversations && adminConversations.length > 0 && (
                    <div className="space-y-3 mb-6">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Conversations</h3>
                      {adminConversations.map((c: any) => (
                        <button key={c.id} onClick={() => setAdminSelectedConvo(c.id)}
                          className="w-full text-left bg-card rounded-xl border border-border p-4 hover:bg-muted/30 transition-colors">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-foreground text-sm truncate">{c.subject}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {c.profiles?.full_name || "User"} • {new Date(c.updated_at).toLocaleDateString()}
                              </p>
                            </div>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${c.status === "open" ? "bg-secondary/10 text-secondary" : "bg-muted text-muted-foreground"}`}>{c.status}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Legacy contact messages */}
                  {paginatedContacts && paginatedContacts.length > 0 && (
                    <>
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Guest Messages</h3>
                      {paginatedContacts.map((m: any) => (
                        <div key={m.id} className={`bg-card rounded-xl border p-5 ${m.is_read ? "border-border" : "border-secondary/30 bg-secondary/5"}`}>
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold text-foreground">{m.subject}</h3>
                                {!m.is_read && <span className="text-xs bg-secondary/10 text-secondary px-2 py-0.5 rounded-full font-medium">New</span>}
                              </div>
                              <p className="text-sm text-muted-foreground mb-2">From: {m.name} ({m.email})</p>
                              <p className="text-sm text-foreground whitespace-pre-wrap">{m.message}</p>
                              <p className="text-xs text-muted-foreground mt-2">{new Date(m.created_at).toLocaleString()}</p>
                            </div>
                            <div className="flex gap-1 shrink-0">
                              {!m.is_read && (
                                <button onClick={() => markAsRead(m.id)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Mark as read"><Check className="w-3.5 h-3.5" /></button>
                              )}
                              <a href={`mailto:${m.email}?subject=Re: ${encodeURIComponent(m.subject)}`} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Reply"><Mail className="w-3.5 h-3.5" /></a>
                              <button onClick={() => deleteContact(m.id)} className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </>
                  )}

                  {(!contactMessages || contactMessages.length === 0) && (!adminConversations || adminConversations.length === 0) && (
                    <div className="text-center py-16 text-muted-foreground">
                      <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p>No messages yet</p>
                    </div>
                  )}
                </div>
              )}
              {!adminSelectedConvo && renderPagination(contactPage, totalContactPages, setContactPage, filteredContacts?.length || 0)}
            </motion.div>
          )}

          {/* ═══ SEO Settings Tab ═══ */}
          {tab === "seo" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold font-display text-foreground">SEO Settings</h2>
                <Button onClick={saveSeoSettings} size="sm" className="gap-1.5" disabled={!seoForm}><Save className="w-4 h-4" /> Save Settings</Button>
              </div>
              {seoForm ? (
                <div className="space-y-6">
                  <div className="bg-card rounded-xl border border-border p-6 space-y-4">
                    <h3 className="font-semibold text-foreground">Store Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div><Label>Store Name</Label><Input value={seoForm.store_name || ""} onChange={(e) => setSeoForm({ ...seoForm, store_name: e.target.value })} placeholder="NanoCircuit.lk" /></div>
                      <div><Label>Tagline</Label><Input value={seoForm.tagline || ""} onChange={(e) => setSeoForm({ ...seoForm, tagline: e.target.value })} placeholder="Sri Lanka's #1 Electronics Store" /></div>
                    </div>
                    <div><Label>Meta Description</Label><Textarea value={seoForm.meta_description || ""} onChange={(e) => setSeoForm({ ...seoForm, meta_description: e.target.value })} rows={3} placeholder="Brief description for search engines (max 160 chars)" /></div>
                    <p className="text-xs text-muted-foreground">{(seoForm.meta_description || "").length}/160 characters</p>
                    <div><Label>Meta Keywords</Label><Input value={seoForm.meta_keywords || ""} onChange={(e) => setSeoForm({ ...seoForm, meta_keywords: e.target.value })} placeholder="electronics, arduino, sensors, Sri Lanka" /></div>
                    <div><Label>OG Image URL</Label><Input value={seoForm.og_image || ""} onChange={(e) => setSeoForm({ ...seoForm, og_image: e.target.value })} placeholder="https://example.com/og-image.jpg" /></div>
                    <div>
                      <Label>Favicon (Site Icon)</Label>
                      <div className="flex items-center gap-3 mt-1">
                        {seoForm.favicon_url && (
                          <div className="relative group">
                            <img src={seoForm.favicon_url} alt="Favicon" className="w-10 h-10 rounded border border-border object-contain bg-muted" />
                            <button type="button" onClick={() => setSeoForm({ ...seoForm, favicon_url: "" })} className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-3 h-3" /></button>
                          </div>
                        )}
                        <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors text-sm text-muted-foreground">
                          <Upload className="w-4 h-4" />{uploading ? "Uploading..." : "Upload favicon"}
                          <input type="file" accept="image/*" onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            setUploading(true);
                            const url = await uploadFile(file, "favicon");
                            if (url) setSeoForm((prev: any) => ({ ...prev, favicon_url: url }));
                            setUploading(false);
                            e.target.value = "";
                          }} className="hidden" disabled={uploading} />
                        </label>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Upload an icon image (PNG/ICO recommended, 32×32 or 64×64px)</p>
                    </div>
                  </div>

                  <div className="bg-card rounded-xl border border-border p-6 space-y-4">
                    <h3 className="font-semibold text-foreground">Analytics & Tracking</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div><Label>Google Analytics ID</Label><Input value={seoForm.google_analytics_id || ""} onChange={(e) => setSeoForm({ ...seoForm, google_analytics_id: e.target.value })} placeholder="G-XXXXXXXXXX" /></div>
                      <div><Label>Facebook Pixel ID</Label><Input value={seoForm.facebook_pixel_id || ""} onChange={(e) => setSeoForm({ ...seoForm, facebook_pixel_id: e.target.value })} placeholder="123456789" /></div>
                    </div>
                    <p className="text-xs text-muted-foreground">Add your tracking IDs to enable analytics on the storefront.</p>
                  </div>

                  <div className="bg-card rounded-xl border border-border p-6 space-y-4">
                    <h3 className="font-semibold text-foreground">SEO Preview</h3>
                    <div className="bg-muted/50 rounded-lg p-4 space-y-1">
                      <p className="text-secondary text-lg font-medium truncate">{seoForm.store_name || "Store Name"} — {seoForm.tagline || "Tagline"}</p>
                      <p className="text-xs text-secondary">https://shop-sun-lk.lovable.app</p>
                      <p className="text-sm text-muted-foreground line-clamp-2">{seoForm.meta_description || "Add a meta description to improve search visibility."}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-16 text-muted-foreground">
                  <Search className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>Loading SEO settings...</p>
                </div>
              )}
            </motion.div>
          )}

          {/* ═══ Homepage Sections Manager Tab ═══ */}
          {tab === "homepage_sections" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <HomepageSectionsManager />
            </motion.div>
          )}

          {/* ═══ Navbar Manager Tab ═══ */}
          {tab === "navbar" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <NavbarManager categories={categories || []} />
            </motion.div>
          )}

          {/* ═══ Invoice Template Builder Tab ═══ */}
          {tab === "invoice_template" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-bold font-display text-foreground">Invoice Template Builder</h2>
              </div>
              <InvoiceTemplateBuilder />
            </motion.div>
          )}

          {/* ═══ Company Info Tab ═══ */}
          {tab === "company" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold font-display text-foreground">Company Information</h2>
                <Button onClick={saveCompanySettings} size="sm" className="gap-1.5" disabled={!companyForm}><Save className="w-4 h-4" /> Save</Button>
              </div>
              {companyForm ? (
                <div className="space-y-6">
                  <div className="bg-card rounded-xl border border-border p-6 space-y-4">
                    <h3 className="font-semibold text-foreground">Basic Details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div><Label>Store / Company Name</Label><Input value={companyForm.store_name || ""} onChange={(e) => setCompanyForm({ ...companyForm, store_name: e.target.value })} placeholder="NanoCircuit.lk" /></div>
                      <div><Label>Tagline</Label><Input value={companyForm.tagline || ""} onChange={(e) => setCompanyForm({ ...companyForm, tagline: e.target.value })} placeholder="Sri Lanka's #1 Electronics Store" /></div>
                    </div>
                    <div><Label>Short Description</Label><Textarea value={companyForm.description || ""} onChange={(e) => setCompanyForm({ ...companyForm, description: e.target.value })} rows={2} placeholder="Brief description shown in footer" /></div>
                    <div><Label>Copyright Text</Label><Input value={companyForm.copyright_text || ""} onChange={(e) => setCompanyForm({ ...companyForm, copyright_text: e.target.value })} placeholder="© 2026 NanoCircuit.lk. All rights reserved." /></div>
                    <div>
                      <Label>Company Logo</Label>
                      <div className="flex items-center gap-3 mt-1">
                        {companyForm.logo_url && (
                          <div className="relative group">
                            <img src={companyForm.logo_url} alt="Logo" className="h-14 rounded border border-border object-contain bg-muted p-1" />
                            <button type="button" onClick={() => setCompanyForm({ ...companyForm, logo_url: "" })} className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-3 h-3" /></button>
                          </div>
                        )}
                        <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors text-sm text-muted-foreground">
                          <Upload className="w-4 h-4" />{uploading ? "Uploading..." : "Upload logo"}
                          <input type="file" accept="image/*" onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            setUploading(true);
                            const url = await uploadFile(file, "logo");
                            if (url) setCompanyForm((prev: any) => ({ ...prev, logo_url: url }));
                            setUploading(false);
                            e.target.value = "";
                          }} className="hidden" disabled={uploading} />
                        </label>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Recommended: PNG with transparent background, 200×60px or similar</p>
                    </div>
                  </div>

                  <div className="bg-card rounded-xl border border-border p-6 space-y-4">
                    <h3 className="font-semibold text-foreground">Contact Details</h3>
                    <div><Label>Address</Label><Textarea value={companyForm.address || ""} onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })} rows={2} placeholder="No. 42, Galle Road, Colombo 03, Sri Lanka" /></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div><Label>Phone</Label><Input value={companyForm.phone || ""} onChange={(e) => setCompanyForm({ ...companyForm, phone: e.target.value })} placeholder="+94 77 123 4567" /></div>
                      <div><Label>WhatsApp</Label><Input value={companyForm.whatsapp || ""} onChange={(e) => setCompanyForm({ ...companyForm, whatsapp: e.target.value })} placeholder="+94771234567" /></div>
                    </div>
                    <div><Label>Email</Label><Input value={companyForm.email || ""} onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })} placeholder="info@nanocircuit.lk" /></div>
                    <div><Label>Business Hours</Label><Textarea value={companyForm.business_hours || ""} onChange={(e) => setCompanyForm({ ...companyForm, business_hours: e.target.value })} rows={3} placeholder={"Mon-Fri: 9AM-6PM\nSat: 9AM-2PM\nSun: Closed"} /></div>
                  </div>

                  <div className="bg-card rounded-xl border border-border p-6 space-y-4">
                    <h3 className="font-semibold text-foreground">Social Media Links</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <div><Label>Facebook URL</Label><Input value={companyForm.facebook_url || ""} onChange={(e) => setCompanyForm({ ...companyForm, facebook_url: e.target.value })} placeholder="https://facebook.com/nanocircuit" /></div>
                      <div><Label>Instagram URL</Label><Input value={companyForm.instagram_url || ""} onChange={(e) => setCompanyForm({ ...companyForm, instagram_url: e.target.value })} placeholder="https://instagram.com/nanocircuit" /></div>
                      <div><Label>YouTube URL</Label><Input value={companyForm.youtube_url || ""} onChange={(e) => setCompanyForm({ ...companyForm, youtube_url: e.target.value })} placeholder="https://youtube.com/@nanocircuit" /></div>
                      <div><Label>TikTok URL</Label><Input value={companyForm.tiktok_url || ""} onChange={(e) => setCompanyForm({ ...companyForm, tiktok_url: e.target.value })} placeholder="https://tiktok.com/@nanocircuit" /></div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-16 text-muted-foreground">
                  <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>Loading company info...</p>
                </div>
              )}
            </motion.div>
          )}

          {/* ═══ Bank Details Tab ═══ */}
          {tab === "bank" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold font-display text-foreground">බැංකු ගිණුම් / Bank Accounts</h2>
                <div className="flex gap-2">
                  <Button onClick={addBankAccount} size="sm" variant="outline" className="gap-1.5"><Plus className="w-4 h-4" /> Add Account</Button>
                  <Button onClick={saveBankSettings} size="sm" className="gap-1.5" disabled={!bankForm}><Save className="w-4 h-4" /> Save</Button>
                </div>
              </div>
              {bankForm && Array.isArray(bankForm) ? (
                <div className="space-y-6">
                  {bankForm.map((acc: any, idx: number) => (
                    <div key={idx} className="bg-card rounded-xl border border-border p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-foreground">ගිණුම / Account #{idx + 1}</h3>
                        {bankForm.length > 1 && (
                          <Button onClick={() => removeBankAccount(idx)} size="sm" variant="ghost" className="text-destructive hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
                        )}
                      </div>
                      <div><Label>බැංකුවේ නම / Bank Name *</Label><Input value={acc.bank_name || ""} onChange={(e) => updateBankAccount(idx, "bank_name", e.target.value)} placeholder="Commercial Bank of Ceylon" /></div>
                      <div><Label>ගිණුම් හිමියාගේ නම / Account Name *</Label><Input value={acc.account_name || ""} onChange={(e) => updateBankAccount(idx, "account_name", e.target.value)} placeholder="TechLK (Pvt) Ltd" /></div>
                      <div><Label>ගිණුම් අංකය / Account Number *</Label><Input value={acc.account_number || ""} onChange={(e) => updateBankAccount(idx, "account_number", e.target.value)} placeholder="8012345678" /></div>
                      <div><Label>ශාඛාව / Branch *</Label><Input value={acc.branch || ""} onChange={(e) => updateBankAccount(idx, "branch", e.target.value)} placeholder="Colombo Fort" /></div>
                      <div><Label>අමතර තොරතුරු / Additional Info</Label><Textarea value={acc.additional_info || ""} onChange={(e) => updateBankAccount(idx, "additional_info", e.target.value)} rows={2} placeholder="SWIFT code, special instructions, etc." /></div>
                    </div>
                  ))}

                  {/* Bilingual Preview */}
                  <div className="bg-card rounded-xl border border-border p-6 space-y-4">
                    <h3 className="font-semibold text-foreground">පෙරදසුන / Preview (as shown to customers)</h3>
                    {bankForm.map((acc: any, idx: number) => (
                      <div key={idx} className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
                        {bankForm.length > 1 && <p className="text-xs font-bold text-foreground mb-2">ගිණුම / Account #{idx + 1}</p>}
                        {[
                          { si: "බැංකුව", en: "Bank", value: acc.bank_name },
                          { si: "ගිණුම් නම", en: "Account Name", value: acc.account_name },
                          { si: "ගිණුම් අංකය", en: "Account No", value: acc.account_number },
                          { si: "ශාඛාව", en: "Branch", value: acc.branch },
                        ].map((r) => (
                          <div key={r.en} className="flex justify-between">
                            <span className="text-muted-foreground">{r.si} / {r.en}</span>
                            <span className="font-medium text-foreground">{r.value || "—"}</span>
                          </div>
                        ))}
                        {acc.additional_info && <p className="text-xs text-muted-foreground pt-1 border-t border-border">{acc.additional_info}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-16 text-muted-foreground">
                  <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>Loading bank details...</p>
                </div>
              )}
            </motion.div>
          )}

          {/* ═══ Payment Settings Tab ═══ */}
          {tab === "payment_settings" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold font-display text-foreground">Payment Methods</h2>
                <Button size="sm" className="gap-1.5" disabled={!paymentMethodSettings} onClick={async () => {
                  const { data: existing } = await supabase.from("site_settings" as any).select("id").eq("key", "payment_methods").maybeSingle();
                  if (existing) {
                    const { error } = await supabase.from("site_settings" as any).update({ value: paymentMethodSettings, updated_at: new Date().toISOString() } as any).eq("key", "payment_methods");
                    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
                  } else {
                    const { error } = await supabase.from("site_settings" as any).insert({ key: "payment_methods", value: paymentMethodSettings } as any);
                    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
                  }
                  toast({ title: "Payment settings saved" });
                  queryClient.invalidateQueries({ queryKey: ["admin-payment-settings"] });
                  queryClient.invalidateQueries({ queryKey: ["payment-methods-settings"] });
                }}>
                  <Save className="w-4 h-4" /> Save
                </Button>
              </div>
              {paymentMethodSettings ? (
                <div className="space-y-4 max-w-lg">
                  <div className="bg-card rounded-xl border border-border p-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <CreditCard className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium text-foreground">Credit / Debit Card (Stripe)</p>
                          <p className="text-xs text-muted-foreground">Visa, MasterCard payments via Stripe</p>
                        </div>
                      </div>
                      <Switch
                        checked={paymentMethodSettings.stripe_enabled}
                        onCheckedChange={(v) => setPaymentMethodSettings({ ...paymentMethodSettings, stripe_enabled: v })}
                      />
                    </div>
                  </div>
                  <div className="bg-card rounded-xl border border-border p-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Building2 className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium text-foreground">Direct Bank Transfer</p>
                          <p className="text-xs text-muted-foreground">Manual bank transfer with receipt upload</p>
                        </div>
                      </div>
                      <Switch
                        checked={paymentMethodSettings.bank_transfer_enabled}
                        onCheckedChange={(v) => setPaymentMethodSettings({ ...paymentMethodSettings, bank_transfer_enabled: v })}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">⚠️ At least one payment method must remain enabled. Disabled methods will not be shown on the checkout page.</p>
                </div>
              ) : (
                <div className="text-center py-16 text-muted-foreground">
                  <Settings className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>Loading payment settings...</p>
                </div>
              )}
            </motion.div>
          )}

          {/* ═══ Shipping Settings Tab ═══ */}
          {tab === "shipping_settings" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold font-display text-foreground">Shipping Charges</h2>
                <Button size="sm" className="gap-1.5" disabled={!shippingForm} onClick={async () => {
                  const { data: existing } = await supabase.from("site_settings" as any).select("id").eq("key", "shipping_settings").maybeSingle();
                  if (existing) {
                    const { error } = await supabase.from("site_settings" as any).update({ value: shippingForm, updated_at: new Date().toISOString() } as any).eq("key", "shipping_settings");
                    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
                  } else {
                    const { error } = await supabase.from("site_settings" as any).insert({ key: "shipping_settings", value: shippingForm } as any);
                    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
                  }
                  toast({ title: "Shipping settings saved" });
                  queryClient.invalidateQueries({ queryKey: ["admin-shipping-settings"] });
                  queryClient.invalidateQueries({ queryKey: ["shipping-settings"] });
                }}>
                  <Save className="w-4 h-4" /> Save
                </Button>
              </div>
              {shippingForm ? (
                <div className="space-y-4 max-w-lg">
                  <div className="bg-card rounded-xl border border-border p-5 space-y-4">
                    <div>
                      <Label className="text-sm font-medium">Local Shipping Fee (Rs.)</Label>
                      <p className="text-xs text-muted-foreground mb-2">Applied to products marked as "Local" shipping</p>
                      <Input type="number" value={shippingForm.local_fee} onChange={(e) => setShippingForm({ ...shippingForm, local_fee: Number(e.target.value) || 0 })} />
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Overseas Shipping Fee (Rs.)</Label>
                      <p className="text-xs text-muted-foreground mb-2">Applied to products marked as "Overseas" shipping</p>
                      <Input type="number" value={shippingForm.overseas_fee} onChange={(e) => setShippingForm({ ...shippingForm, overseas_fee: Number(e.target.value) || 0 })} />
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Free Shipping Threshold (Rs.)</Label>
                      <p className="text-xs text-muted-foreground mb-2">Orders above this amount get free local shipping</p>
                      <Input type="number" value={shippingForm.free_shipping_threshold} onChange={(e) => setShippingForm({ ...shippingForm, free_shipping_threshold: Number(e.target.value) || 0 })} />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">💡 If cart has any overseas product, overseas fee is used. Otherwise local fee applies. Free shipping threshold only applies to local shipping.</p>
                </div>
              ) : (
                <div className="text-center py-16 text-muted-foreground">
                  <Truck className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>Loading shipping settings...</p>
                </div>
              )}
            </motion.div>
          )}

          {tab === "sales" && (
            <SalesAnalytics orders={orders || []} products={products || []} />
          )}

          {/* ═══ Reports Tab ═══ */}
          {tab === "reports" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h2 className="text-xl font-bold font-display text-foreground mb-6">Reports & Analytics</h2>
              {reportData ? (
                <div className="space-y-6">
                  {/* Overview Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-card rounded-xl border border-border p-5">
                      <p className="text-sm text-muted-foreground mb-1">Total Orders</p>
                      <p className="text-2xl font-bold font-display text-foreground">{reportData.totalSales}</p>
                    </div>
                    <div className="bg-card rounded-xl border border-border p-5">
                      <p className="text-sm text-muted-foreground mb-1">Total Revenue (Paid)</p>
                      <p className="text-2xl font-bold font-display text-secondary">Rs. {reportData.totalRevenue.toLocaleString()}</p>
                    </div>
                    <div className="bg-card rounded-xl border border-border p-5">
                      <p className="text-sm text-muted-foreground mb-1">Pending Revenue</p>
                      <p className="text-2xl font-bold font-display text-accent">Rs. {reportData.pendingRevenue.toLocaleString()}</p>
                    </div>
                    <div className="bg-card rounded-xl border border-border p-5">
                      <p className="text-sm text-muted-foreground mb-1">Avg. Order Value</p>
                      <p className="text-2xl font-bold font-display text-foreground">
                        Rs. {reportData.totalSales > 0 ? Math.round(reportData.totalRevenue / reportData.totalSales).toLocaleString() : 0}
                      </p>
                    </div>
                  </div>

                  {/* Financial Summary */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-card rounded-xl border border-border p-5">
                      <p className="text-sm text-muted-foreground mb-1">Total Cost</p>
                      <p className="text-2xl font-bold font-display text-foreground">Rs. {reportData.totalCost.toLocaleString()}</p>
                    </div>
                    <div className="bg-card rounded-xl border border-border p-5">
                      <p className="text-sm text-muted-foreground mb-1">Gross Profit</p>
                      <p className={`text-2xl font-bold font-display ${reportData.totalProfit >= 0 ? "text-secondary" : "text-destructive"}`}>Rs. {reportData.totalProfit.toLocaleString()}</p>
                      {reportData.totalRevenue > 0 && <p className="text-xs text-muted-foreground mt-1">{((reportData.totalProfit / reportData.totalRevenue) * 100).toFixed(1)}% margin</p>}
                    </div>
                    <div className="bg-card rounded-xl border border-border p-5">
                      <p className="text-sm text-muted-foreground mb-1">Total Discounts Given</p>
                      <p className="text-2xl font-bold font-display text-foreground">
                        Rs. {(orders?.filter(o => o.payment_status === "paid").reduce((s, o) => s + (Number(o.discount_amount) || 0), 0) || 0).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {/* Coupon Usage */}
                  {(() => {
                    const couponUsage = new Map<string, { count: number; totalDiscount: number }>();
                    orders?.filter(o => o.coupon_code).forEach(o => {
                      const existing = couponUsage.get(o.coupon_code!) || { count: 0, totalDiscount: 0 };
                      existing.count += 1;
                      existing.totalDiscount += Number(o.discount_amount) || 0;
                      couponUsage.set(o.coupon_code!, existing);
                    });
                    if (couponUsage.size === 0) return null;
                    return (
                      <div className="bg-card rounded-xl border border-border p-5">
                        <h3 className="font-semibold text-foreground mb-4">Coupon Usage</h3>
                        <div className="space-y-2">
                          {Array.from(couponUsage.entries()).sort((a, b) => b[1].count - a[1].count).map(([code, data]) => (
                            <div key={code} className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-2">
                                <span className="font-mono bg-muted px-2 py-0.5 rounded text-xs">{code}</span>
                                <span className="text-muted-foreground">{data.count} uses</span>
                              </div>
                              <span className="text-foreground font-medium">-Rs. {data.totalDiscount.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Category-wise Revenue */}
                  {(() => {
                    const catRevenue = new Map<string, { name: string; revenue: number; qty: number; cost: number }>();
                    orders?.filter(o => o.payment_status === "paid").forEach(o => {
                      (o.order_items as any[])?.forEach((item: any) => {
                        const prod = products?.find(p => p.id === item.product_id);
                        const catName = (prod as any)?.categories?.name || "Uncategorized";
                        const catId = prod?.category_id || "none";
                        const existing = catRevenue.get(catId) || { name: catName, revenue: 0, qty: 0, cost: 0 };
                        existing.revenue += Number(item.total_price);
                        existing.qty += item.quantity;
                        existing.cost += (Number((prod as any)?.cost_price) || 0) * item.quantity;
                        catRevenue.set(catId, existing);
                      });
                    });
                    if (catRevenue.size === 0) return null;
                    const catData = Array.from(catRevenue.values()).sort((a, b) => b.revenue - a.revenue);
                    return (
                      <div className="bg-card rounded-xl border border-border p-5">
                        <h3 className="font-semibold text-foreground mb-4">Revenue by Category</h3>
                        <div className="space-y-3">
                          {catData.map((c, i) => {
                            const maxRev = Math.max(...catData.map(x => x.revenue));
                            const pct = maxRev > 0 ? (c.revenue / maxRev) * 100 : 0;
                            return (
                              <div key={i} className="space-y-1">
                                <div className="flex items-center justify-between text-sm">
                                  <span className="text-foreground font-medium">{c.name}</span>
                                  <div className="flex items-center gap-3">
                                    <span className="text-xs text-muted-foreground">{c.qty} items</span>
                                    <span className="font-medium text-foreground">Rs. {c.revenue.toLocaleString()}</span>
                                  </div>
                                </div>
                                <div className="h-2 bg-muted rounded-full overflow-hidden">
                                  <div className="h-full bg-secondary rounded-full transition-all" style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {reportData.monthlyRevenue.length > 0 && (
                    <div className="bg-card rounded-xl border border-border p-5">
                      <h3 className="font-semibold text-foreground mb-4">Monthly Revenue</h3>
                      <div className="space-y-3">
                        {reportData.monthlyRevenue.map((m) => {
                          const maxRevenue = Math.max(...reportData.monthlyRevenue.map(r => r.total));
                          const pct = maxRevenue > 0 ? (m.total / maxRevenue) * 100 : 0;
                          return (
                            <div key={m.month} className="flex items-center gap-3">
                              <span className="text-sm text-muted-foreground w-20">{m.month}</span>
                              <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                                <div className="h-full bg-secondary rounded-full transition-all" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-sm font-medium text-foreground w-32 text-right">Rs. {m.total.toLocaleString()}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-card rounded-xl border border-border p-5">
                      <h3 className="font-semibold text-foreground mb-4">Best Selling Products</h3>
                      {reportData.bestSellers.length > 0 ? (
                        <div className="space-y-3">
                          {reportData.bestSellers.map((p, i) => (
                            <div key={i} className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-muted-foreground w-5">#{i + 1}</span>
                                <span className="text-sm text-foreground line-clamp-1">{p.name}</span>
                              </div>
                              <div className="flex items-center gap-4">
                                <span className="text-xs text-muted-foreground">{p.qty} sold</span>
                                <span className="text-sm font-medium text-foreground">Rs. {p.revenue.toLocaleString()}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-sm">No sales data yet</p>
                      )}
                    </div>
                    <div className="space-y-6">
                      <div className="bg-card rounded-xl border border-border p-5">
                        <h3 className="font-semibold text-foreground mb-4">Payment Methods</h3>
                        <div className="space-y-2">
                          {reportData.paymentMethods.map(([method, count]) => (
                            <div key={method} className="flex items-center justify-between">
                              <span className="text-sm capitalize text-muted-foreground">{method === "stripe" ? "Card (Stripe)" : "Bank Transfer"}</span>
                              <span className="text-sm font-bold text-foreground">{count} orders</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="bg-card rounded-xl border border-border p-5">
                        <h3 className="font-semibold text-foreground mb-4">Order Status Breakdown</h3>
                        <div className="space-y-2">
                          {reportData.statusBreakdown.map(([status, count]) => (
                            <div key={status} className="flex items-center justify-between">
                              <span className="text-sm capitalize text-muted-foreground">{status}</span>
                              <span className="text-sm font-bold text-foreground">{count}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Customer Stats */}
                      <div className="bg-card rounded-xl border border-border p-5">
                        <h3 className="font-semibold text-foreground mb-4">Customer Stats</h3>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Total Customers</span>
                            <span className="font-bold text-foreground">{allProfiles?.length || 0}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Customers with Orders</span>
                            <span className="font-bold text-foreground">{new Set(orders?.map(o => o.user_id)).size}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Repeat Customers</span>
                            <span className="font-bold text-foreground">
                              {(() => {
                                const userOrders = new Map<string, number>();
                                orders?.forEach(o => userOrders.set(o.user_id, (userOrders.get(o.user_id) || 0) + 1));
                                return Array.from(userOrders.values()).filter(c => c > 1).length;
                              })()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Shipping Revenue */}
                  <div className="bg-card rounded-xl border border-border p-5">
                    <h3 className="font-semibold text-foreground mb-4">Shipping Summary</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Total Shipping Revenue</p>
                        <p className="text-lg font-bold text-foreground">Rs. {(orders?.filter(o => o.payment_status === "paid").reduce((s, o) => s + Number(o.shipping_fee), 0) || 0).toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Free Shipping Orders</p>
                        <p className="text-lg font-bold text-foreground">{orders?.filter(o => Number(o.shipping_fee) === 0).length || 0}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Paid Shipping Orders</p>
                        <p className="text-lg font-bold text-foreground">{orders?.filter(o => Number(o.shipping_fee) > 0).length || 0}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-16 text-muted-foreground">
                  <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>Loading report data...</p>
                </div>
              )}
            </motion.div>
          )}


          {/* ═══ Stock Tab ═══ */}
          {tab === "stock" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h2 className="text-xl font-bold font-display text-foreground mb-6">Stock Management</h2>
              {reportData ? (
                <div className="space-y-6">
                  {/* Stock Overview Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-card rounded-xl border border-border p-5">
                      <p className="text-sm text-muted-foreground mb-1">Total Products</p>
                      <p className="text-2xl font-bold font-display text-foreground">{reportData.totalProducts}</p>
                    </div>
                    <div className="bg-card rounded-xl border border-border p-5">
                      <p className="text-sm text-muted-foreground mb-1">Total Stock Qty</p>
                      <p className="text-2xl font-bold font-display text-foreground">{reportData.totalStockQty.toLocaleString()}</p>
                    </div>
                    <div className="bg-card rounded-xl border border-border p-5">
                      <p className="text-sm text-muted-foreground mb-1">Stock Value (Selling)</p>
                      <p className="text-2xl font-bold font-display text-secondary">Rs. {reportData.totalStockValue.toLocaleString()}</p>
                    </div>
                    <div className="bg-card rounded-xl border border-border p-5">
                      <p className="text-sm text-muted-foreground mb-1">Stock Value (Cost)</p>
                      <p className="text-2xl font-bold font-display text-foreground">Rs. {reportData.totalStockCostValue.toLocaleString()}</p>
                    </div>
                  </div>

                  {/* Low Stock Threshold Setting */}
                  <div className="bg-card rounded-xl border border-border p-5">
                    <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                      <Package className="w-4 h-4" /> Low Stock Threshold
                    </h3>
                    <div className="flex flex-wrap items-center gap-3">
                      <Input
                        type="number"
                        min={1}
                        value={lowStockThreshold}
                        onChange={e => setLowStockThreshold(Number(e.target.value) || 1)}
                        className="w-24"
                      />
                      <span className="text-sm text-muted-foreground">Products with stock ≤ this value will be flagged</span>
                      <Button size="sm" onClick={async () => {
                        const val = { low_stock_threshold: lowStockThreshold };
                        const { data: existing } = await supabase.from("site_settings" as any).select("id").eq("key", "stock_settings").maybeSingle();
                        if (existing) {
                          const { error } = await supabase.from("site_settings" as any).update({ value: val, updated_at: new Date().toISOString() } as any).eq("key", "stock_settings");
                          if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
                        } else {
                          const { error } = await supabase.from("site_settings" as any).insert({ key: "stock_settings", value: val } as any);
                          if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
                        }
                        toast({ title: "Threshold saved" });
                        queryClient.invalidateQueries({ queryKey: ["admin-stock-settings"] });
                      }}>
                        <Save className="w-3 h-3 mr-1" /> Save
                      </Button>
                    </div>
                  </div>

                  {/* Out of Stock Products */}
                  <div className="bg-card rounded-xl border border-destructive/30 p-5">
                    <h3 className="font-semibold text-destructive mb-4 flex items-center gap-2">
                      <Package className="w-4 h-4" /> Out of Stock ({reportData.outOfStockProducts.length})
                    </h3>
                    {reportData.outOfStockProducts.length > 0 ? (
                      <div className="space-y-2">
                        {reportData.outOfStockProducts.map((p: any) => (
                          <div key={p.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border last:border-0">
                            <div className="flex items-center gap-3">
                              <img src={p.images?.[0] || "/placeholder.svg"} alt="" className="w-8 h-8 rounded object-cover" />
                              <span className="text-foreground">{p.name}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-muted-foreground">{(p.categories as any)?.name || "—"}</span>
                              <span className="text-xs text-destructive font-medium px-2 py-0.5 bg-destructive/10 rounded-full">0 units</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No out-of-stock products 🎉</p>
                    )}
                  </div>

                  {/* Low Stock Products */}
                  <div className="bg-card rounded-xl border border-accent/30 p-5">
                    <h3 className="font-semibold text-accent-foreground mb-4 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" /> {"Low Stock ≤"}{lowStockThreshold} ({reportData.lowStockProducts.length})
                    </h3>
                    {reportData.lowStockProducts.length > 0 ? (
                      <div className="space-y-2">
                        {reportData.lowStockProducts.map((p: any) => (
                          <div key={p.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border last:border-0">
                            <div className="flex items-center gap-3">
                              <img src={p.images?.[0] || "/placeholder.svg"} alt="" className="w-8 h-8 rounded object-cover" />
                              <span className="text-foreground">{p.name}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-muted-foreground">{(p.categories as any)?.name || "—"}</span>
                              <span className="text-xs text-accent-foreground font-medium px-2 py-0.5 bg-accent/10 rounded-full">{p.stock_quantity} units</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No low-stock products 🎉</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-16 text-muted-foreground">
                  <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>Loading stock data...</p>
                </div>
              )}
            </motion.div>
          )}

          {/* ═══ QR Stock Scan Tab ═══ */}
          {tab === "qr_scan" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <QRStockScanner />
            </motion.div>
          )}

          {/* ═══ Pre-Orders Tab ═══ */}
          {tab === "preorders" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <AdminPreOrders
                requests={preorderRequests || []}
                onRefresh={refetchPreorders}
                allProfiles={allProfiles || []}
                onOpenConversation={(convId) => {
                  setAdminSelectedConvo(convId);
                  setTab("contacts");
                }}
              />
            </motion.div>
          )}

          {/* ═══ DB Tools Tab ═══ */}
          {tab === "db_tools" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h2 className="text-xl font-bold font-display text-foreground mb-6">Database Tools</h2>
              <DatabaseTools />
            </motion.div>
          )}

          {/* ═══ SMS Templates Tab ═══ */}
          {tab === "sms_templates" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold font-display text-foreground">SMS Templates</h2>
                <Button size="sm" className="gap-1" onClick={() => {
                  setEditingTemplateId(null);
                  setTemplateForm({ template_key: "", name: "", message_template: "", description: "", is_active: true });
                  setTemplateDialog(true);
                }}><Plus className="w-4 h-4" /> Add Template</Button>
              </div>
              <p className="text-sm text-muted-foreground mb-4">Placeholders: {"{{customer_name}}, {{order_id}}, {{total}}, {{status}}, {{tracking_info}}, {{eta}}, {{OTP5}}"}</p>
              {/* SMS Balance Card */}
              <div className="bg-card rounded-xl border border-border p-4 mb-6 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-secondary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">SMS Balance</p>
                  <p className="text-lg font-bold text-foreground">
                    {smsBalance?.balance !== null && smsBalance?.balance !== undefined
                      ? `Rs. ${Number(smsBalance.balance).toLocaleString()}`
                      : "—"}
                  </p>
                </div>
              </div>
              <div className="space-y-3">
                {smsTemplates?.map((t: any) => (
                  <div key={t.id} className="bg-card rounded-xl border border-border p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">{t.name}</span>
                        <span className="text-xs bg-muted px-2 py-0.5 rounded text-muted-foreground font-mono">{t.template_key}</span>
                        <span className={`text-xs px-2 py-0.5 rounded ${t.is_active ? 'bg-secondary/10 text-secondary' : 'bg-destructive/10 text-destructive'}`}>
                          {t.is_active ? 'Active' : 'Disabled'}
                        </span>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => {
                          setEditingTemplateId(t.id);
                          setTemplateForm({ template_key: t.template_key, name: t.name, message_template: t.message_template, description: t.description || "", is_active: t.is_active });
                          setTemplateDialog(true);
                        }} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={async () => {
                          if (!confirm("Delete this template?")) return;
                          await supabase.from("sms_templates" as any).delete().eq("id", t.id);
                          queryClient.invalidateQueries({ queryKey: ["admin-sms-templates"] });
                          toast({ title: "Template deleted" });
                        }} className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground bg-muted/50 p-2 rounded font-mono">{t.message_template}</p>
                    {t.description && <p className="text-xs text-muted-foreground mt-1">{t.description}</p>}
                    <p className="text-xs text-muted-foreground mt-1">{t.message_template.length} characters</p>
                  </div>
                ))}
                {(!smsTemplates || smsTemplates.length === 0) && (
                  <div className="text-center py-16 text-muted-foreground">
                    <Send className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>No SMS templates yet</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ═══ SMS Logs Tab ═══ */}
          {tab === "sms_logs" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="flex items-center justify-between mb-6 gap-3">
                <h2 className="text-xl font-bold font-display text-foreground">SMS Delivery Log</h2>
                <div className="flex items-center gap-2">
                  <div className="relative w-48">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input placeholder="Search by phone, status..." value={smsLogSearch} onChange={(e) => { setSmsLogSearch(e.target.value); setSmsLogPage(0); }} className="h-8 text-xs pl-8" />
                  </div>
                  {smsLogs && smsLogs.length > 0 && (
                    <Button variant="destructive" size="sm" className="gap-1" onClick={deleteAllSmsLogs}><Trash2 className="w-4 h-4" /> Clear All</Button>
                  )}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border text-left">
                    <th className="px-3 py-2 text-muted-foreground font-medium">Time</th>
                    <th className="px-3 py-2 text-muted-foreground font-medium">Phone</th>
                    <th className="px-3 py-2 text-muted-foreground font-medium">Template</th>
                    <th className="px-3 py-2 text-muted-foreground font-medium">Status</th>
                    <th className="px-3 py-2 text-muted-foreground font-medium">Message</th>
                    <th className="px-3 py-2 text-muted-foreground font-medium">Actions</th>
                  </tr></thead>
                  <tbody>
                    {paginatedSmsLogs?.map((log: any) => (
                      <tr key={log.id} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">{log.phone}</td>
                        <td className="px-3 py-2">
                          {log.template_key && <span className="text-xs bg-muted px-2 py-0.5 rounded font-mono">{log.template_key}</span>}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`text-xs px-2 py-0.5 rounded ${log.status === 'sent' ? 'bg-secondary/10 text-secondary' : 'bg-destructive/10 text-destructive'}`}>
                            {log.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground max-w-xs truncate">{log.message}</td>
                        <td className="px-3 py-2">
                          <button onClick={() => deleteSmsLog(log.id)} className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(!smsLogs || smsLogs.length === 0) && (
                  <div className="text-center py-16 text-muted-foreground">
                    <Phone className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>No SMS logs yet</p>
                  </div>
                )}
              </div>
              {renderPagination(smsLogPage, totalSmsLogPages, setSmsLogPage, filteredSmsLogs?.length || 0)}
            </motion.div>
          )}
        </main>
      </div>

      {/* ═══ Product Dialog ═══ */}
      <Dialog open={productDialog} onOpenChange={setProductDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingProductId ? "Edit Product" : "Add Product"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Name *</Label><Input value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} placeholder="Product name" /></div>
            <div><Label>Slug</Label><Input value={productForm.slug} onChange={(e) => setProductForm({ ...productForm, slug: e.target.value })} placeholder="auto-generated-from-name" /></div>
            <div>
              <Label>Category</Label>
              <Select value={productForm.category_id} onValueChange={(v) => setProductForm({ ...productForm, category_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>{categories?.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            {/* LCSC Auto-Import — only for Micro Electronics category */}
            {!editingProductId && categories?.find(c => c.id === productForm.category_id && c.name.toLowerCase().includes("micro")) && (
              <div className={`border rounded-lg p-3 space-y-2 ${lcscFailed ? "border-destructive/50 bg-destructive/5" : "border-secondary/40 bg-secondary/5"}`}>
                <div className="flex items-center gap-2 text-sm font-semibold text-secondary">
                  <ExternalLink className="w-4 h-4" />
                  LCSC Auto-Import
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="C93216  or  lcsc.com/product-detail/C93216.html"
                    value={lcscPartNumber}
                    onChange={(e) => { setLcscPartNumber(e.target.value); setLcscFailed(false); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') fetchFromLcsc(); }}
                    className="flex-1 text-xs"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={fetchFromLcsc}
                    disabled={lcscLoading || !lcscPartNumber}
                    className="shrink-0"
                  >
                    {lcscLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    {lcscLoading ? "Fetching..." : "Fetch from LCSC"}
                  </Button>
                </div>
                {!lcscFailed && (
                  <p className="text-xs text-muted-foreground">Enter a part number (C93216) or paste a full LCSC URL to auto-fill name, SKU, datasheet & specs. Then set price & stock.</p>
                )}

                {/* Manual fallback — shown when LCSC fetch fails */}
                {lcscFailed && (
                  <div className="space-y-2 pt-1 border-t border-destructive/20">
                    <p className="text-xs text-destructive font-medium flex items-center gap-1.5">
                      <X className="w-3.5 h-3.5" /> Part not found on LCSC — fill in manually:
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">LCSC Part Number (C‑number)</Label>
                        <Input
                          placeholder="e.g. C5381776"
                          value={lcscFailedLcscNum}
                          onChange={(e) => {
                            setLcscFailedLcscNum(e.target.value);
                            setProductForm((prev) => ({ ...prev, sku: e.target.value }));
                          }}
                          className="text-xs h-8 font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">MPN (Manufacturer Part Number)</Label>
                        <Input
                          placeholder="e.g. TP4054"
                          value={lcscFailedMpn}
                          onChange={(e) => {
                            setLcscFailedMpn(e.target.value);
                            setProductForm((prev) => ({
                              ...prev,
                              name: e.target.value || prev.name,
                              slug: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || prev.slug,
                            }));
                          }}
                          className="text-xs h-8 font-mono"
                        />
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      LCSC number will be saved as SKU. Fill in the product name, description and other fields below.
                    </p>
                  </div>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Price (Rs.) *</Label><Input type="number" value={productForm.price} onChange={(e) => setProductForm({ ...productForm, price: e.target.value })} /></div>
              <div><Label>Original Price (Rs.)</Label><Input type="number" value={productForm.discount_price} onChange={(e) => setProductForm({ ...productForm, discount_price: e.target.value })} placeholder="Higher price" /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Cost Price (Rs.)</Label><Input type="number" value={productForm.cost_price} onChange={(e) => setProductForm({ ...productForm, cost_price: e.target.value })} placeholder="Your cost" /></div>
              <div><Label>SKU</Label><Input value={productForm.sku} onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })} /></div>
              <div><Label>Stock Quantity</Label><Input type="number" value={productForm.stock_quantity} onChange={(e) => setProductForm({ ...productForm, stock_quantity: e.target.value })} /></div>
            </div>
            <div><Label>Description</Label><Textarea value={productForm.description} onChange={(e) => setProductForm({ ...productForm, description: e.target.value })} rows={3} /></div>
            <div>
              <Label>Images</Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {productImagePreviews.map((url, i) => (
                  <div key={i} className="relative group w-16 h-16">
                    <img src={url} alt="" className="w-16 h-16 rounded-lg object-cover border border-border" />
                    <button type="button" onClick={() => removeProductImage(i)} className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-3 h-3" /></button>
                  </div>
                ))}
              </div>
              <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors text-sm text-muted-foreground">
                <Upload className="w-4 h-4" />{uploading ? "Uploading..." : "Upload images / පින්තූර එකතු කරන්න"}
                <input type="file" accept="image/*" multiple onChange={handleProductImageUpload} className="hidden" disabled={uploading} />
              </label>
            </div>
            <div className="border-t border-border pt-4 space-y-4">
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2"><Video className="w-4 h-4 text-secondary" /> වීඩියෝ සහ ලේඛන / Videos & Documents</h4>
              <div><Label>වීඩියෝ URL / Video URL</Label><Input value={productForm.video_url} onChange={(e) => setProductForm({ ...productForm, video_url: e.target.value })} placeholder="https://youtube.com/watch?v=... හෝ වීඩියෝ link එක" /></div>
              <div><Label>Datasheet / PDF URL</Label><Input value={productForm.datasheet_url} onChange={(e) => setProductForm({ ...productForm, datasheet_url: e.target.value })} placeholder="https://... datasheet PDF link එක" /></div>
              <p className="text-xs text-muted-foreground">සියලුම නිෂ්පාදන සඳහා මේවා අවශ්‍ය නොවේ. තිබේ නම් පමණක් එකතු කරන්න.</p>
            </div>
            {/* International Links & Similar Products (only when editing) */}
            {editingProductId && (
              <ProductLinksManager
                productId={editingProductId}
                allProducts={(products || []).map((p) => ({ id: p.id, name: p.name }))}
              />
            )}
            <div className="border-t border-border pt-4 space-y-4">
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2"><Truck className="w-4 h-4 text-secondary" /> Shipping / ප්‍රවාහනය</h4>
              <div>
                <Label>Shipping Source</Label>
                <Select value={productForm.shipping_type} onValueChange={(v) => setProductForm({ ...productForm, shipping_type: v })}>
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="local">🇱🇰 Local</SelectItem>
                    <SelectItem value="overseas">🌍 Overseas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Ships From</Label><Input value={productForm.ships_from} onChange={(e) => setProductForm({ ...productForm, ships_from: e.target.value })} placeholder="e.g. Colombo, Sri Lanka" /></div>
              <div><Label>Delivery ETA (after payment)</Label><Input value={productForm.delivery_eta} onChange={(e) => setProductForm({ ...productForm, delivery_eta: e.target.value })} placeholder="e.g. 2-4 Days or 7-14 Business Days" /></div>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2"><Switch checked={productForm.is_active} onCheckedChange={(v) => setProductForm({ ...productForm, is_active: v })} /><Label>Active</Label></div>
              <div className="flex items-center gap-2"><Switch checked={productForm.is_featured} onCheckedChange={(v) => setProductForm({ ...productForm, is_featured: v })} /><Label>Featured</Label></div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setProductDialog(false)}>Cancel</Button>
              <Button onClick={saveProduct} disabled={!productForm.name || !productForm.price}>Save Product</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ Category Dialog ═══ */}
      <Dialog open={categoryDialog} onOpenChange={setCategoryDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingCategoryId ? "Edit Category" : "Add Category"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Name *</Label><Input value={categoryForm.name} onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })} placeholder="Category name" /></div>
            <div><Label>Slug</Label><Input value={categoryForm.slug} onChange={(e) => setCategoryForm({ ...categoryForm, slug: e.target.value })} placeholder="auto-generated" /></div>
            <div><Label>Description</Label><Textarea value={categoryForm.description} onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })} rows={2} /></div>
            <div>
              <Label>Image</Label>
              {categoryForm.image_url && (
                <div className="relative group w-20 h-20 mb-2">
                  <img src={categoryForm.image_url} alt="" className="w-20 h-20 rounded-lg object-cover border border-border" />
                  <button type="button" onClick={() => setCategoryForm({ ...categoryForm, image_url: "" })} className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-3 h-3" /></button>
                </div>
              )}
              <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors text-sm text-muted-foreground">
                <Upload className="w-4 h-4" />{uploading ? "Uploading..." : "Upload image"}
                <input type="file" accept="image/*" onChange={handleCategoryImageUpload} className="hidden" disabled={uploading} />
              </label>
            </div>
            <div><Label>Sort Order</Label><Input type="number" value={categoryForm.sort_order} onChange={(e) => setCategoryForm({ ...categoryForm, sort_order: e.target.value })} /></div>
            <div className="flex items-center gap-2"><Switch checked={categoryForm.is_active} onCheckedChange={(v) => setCategoryForm({ ...categoryForm, is_active: v })} /><Label>Active</Label></div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setCategoryDialog(false)}>Cancel</Button>
              <Button onClick={saveCategory} disabled={!categoryForm.name}>Save Category</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ Banner Dialog ═══ */}
      <Dialog open={bannerDialog} onOpenChange={setBannerDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingBannerId ? "Edit Banner" : "Add Banner"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Title *</Label><Input value={bannerForm.title} onChange={(e) => setBannerForm({ ...bannerForm, title: e.target.value })} placeholder="Banner title" /></div>
            <div><Label>Subtitle</Label><Input value={bannerForm.subtitle} onChange={(e) => setBannerForm({ ...bannerForm, subtitle: e.target.value })} /></div>
            <div><Label>Redirect Link</Label><Input value={bannerForm.link_url} onChange={(e) => setBannerForm({ ...bannerForm, link_url: e.target.value })} placeholder="/category/arduino-boards" /></div>
            <div>
              <Label>Banner Image *</Label>
              {bannerForm.image_url && (
                <div className="relative group mb-2">
                  <img src={bannerForm.image_url} alt="" className="w-full h-32 rounded-lg object-cover border border-border" />
                  <button type="button" onClick={() => setBannerForm({ ...bannerForm, image_url: "" })} className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-3 h-3" /></button>
                </div>
              )}
              <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors text-sm text-muted-foreground">
                <Upload className="w-4 h-4" />{uploading ? "Uploading..." : "Upload banner image"}
                <input type="file" accept="image/*" onChange={handleBannerImageUpload} className="hidden" disabled={uploading} />
              </label>
            </div>
            <div><Label>Sort Order</Label><Input type="number" value={bannerForm.sort_order} onChange={(e) => setBannerForm({ ...bannerForm, sort_order: e.target.value })} /></div>
            <div className="flex items-center gap-2"><Switch checked={bannerForm.is_active} onCheckedChange={(v) => setBannerForm({ ...bannerForm, is_active: v })} /><Label>Active</Label></div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setBannerDialog(false)}>Cancel</Button>
              <Button onClick={saveBanner} disabled={!bannerForm.title || !bannerForm.image_url}>Save Banner</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ Deal Dialog ═══ */}
      <Dialog open={dealDialog} onOpenChange={setDealDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingDealId ? "Edit Deal" : "Add Deal"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Product *</Label>
              <Select value={dealForm.product_id} onValueChange={(v) => setDealForm({ ...dealForm, product_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select a product" /></SelectTrigger>
                <SelectContent className="max-h-60">{products?.map((p) => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Discount %</Label><Input type="number" value={dealForm.discount_percent} onChange={(e) => setDealForm({ ...dealForm, discount_percent: e.target.value })} placeholder="20" /></div>
              <div><Label>Deal Price (Rs.)</Label><Input type="number" value={dealForm.deal_price} onChange={(e) => setDealForm({ ...dealForm, deal_price: e.target.value })} placeholder="Special price" /></div>
            </div>
            <div><Label>Starts At</Label><Input type="datetime-local" value={dealForm.starts_at} onChange={(e) => setDealForm({ ...dealForm, starts_at: e.target.value })} /></div>
            <div><Label>Ends At *</Label><Input type="datetime-local" value={dealForm.ends_at} onChange={(e) => setDealForm({ ...dealForm, ends_at: e.target.value })} /></div>
            <div className="flex items-center gap-2"><Switch checked={dealForm.is_active} onCheckedChange={(v) => setDealForm({ ...dealForm, is_active: v })} /><Label>Active</Label></div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDealDialog(false)}>Cancel</Button>
              <Button onClick={saveDeal} disabled={!dealForm.product_id || !dealForm.ends_at}>Save Deal</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ Page Dialog ═══ */}
      <Dialog open={pageDialog} onOpenChange={setPageDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingPageId ? "Edit Page" : "Add Page"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Title *</Label><Input value={pageForm.title} onChange={(e) => setPageForm({ ...pageForm, title: e.target.value })} placeholder="Page title" /></div>
            <div><Label>Slug</Label><Input value={pageForm.slug} onChange={(e) => setPageForm({ ...pageForm, slug: e.target.value })} placeholder="auto-generated-from-title" /></div>
            <div>
              <Label>Content</Label>
              <p className="text-xs text-muted-foreground mb-1">Use **bold**, bullet points with "- ", and separate paragraphs with blank lines.</p>
              <Textarea value={pageForm.content} onChange={(e) => setPageForm({ ...pageForm, content: e.target.value })} rows={12} className="font-mono text-xs" />
            </div>
            <div className="flex items-center gap-2"><Switch checked={pageForm.is_published} onCheckedChange={(v) => setPageForm({ ...pageForm, is_published: v })} /><Label>Published</Label></div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setPageDialog(false)}>Cancel</Button>
              <Button onClick={savePage} disabled={!pageForm.title}>Save Page</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ Coupon Dialog ═══ */}
      <Dialog open={couponDialog} onOpenChange={setCouponDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingCouponId ? "Edit Coupon" : "Add Coupon"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Code *</Label><Input value={couponForm.code} onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })} placeholder="SAVE20" /></div>
              <div><Label>Internal Name</Label><Input value={couponForm.name} onChange={(e) => setCouponForm({ ...couponForm, name: e.target.value })} placeholder="Summer Sale 20%" /></div>
            </div>
            <div><Label>Description</Label><Input value={couponForm.description} onChange={(e) => setCouponForm({ ...couponForm, description: e.target.value })} placeholder="20% off your order" /></div>

            {/* Coupon Type */}
            <div>
              <Label>Coupon Access</Label>
              <Select value={couponForm.coupon_type} onValueChange={(v) => setCouponForm({ ...couponForm, coupon_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public (Anyone)</SelectItem>
                  <SelectItem value="private">Private (Assigned Users)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Private: User assignment picker */}
            {couponForm.coupon_type === "private" && (
              <CouponUserPicker
                allProfiles={allProfiles || []}
                selectedPhones={couponForm.assigned_phones}
                onChange={(phones) => setCouponForm({ ...couponForm, assigned_phones: phones })}
              />
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Discount Type</Label>
                <Select value={couponForm.discount_type} onValueChange={(v) => setCouponForm({ ...couponForm, discount_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                    <SelectItem value="fixed">Fixed Amount (Rs.)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>{couponForm.discount_type === "percentage" ? "Discount %" : "Amount (Rs.)"}</Label><Input type="number" value={couponForm.discount_value} onChange={(e) => setCouponForm({ ...couponForm, discount_value: e.target.value })} /></div>
            </div>

            {couponForm.discount_type === "percentage" && (
              <div><Label>Max Discount Cap (Rs.)</Label><Input type="number" value={couponForm.max_discount_cap} onChange={(e) => setCouponForm({ ...couponForm, max_discount_cap: e.target.value })} placeholder="No cap" /></div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div><Label>Min Order (Rs.)</Label><Input type="number" value={couponForm.min_order_amount} onChange={(e) => setCouponForm({ ...couponForm, min_order_amount: e.target.value })} placeholder="0" /></div>
              <div><Label>Max Uses (Total)</Label><Input type="number" value={couponForm.max_uses} onChange={(e) => setCouponForm({ ...couponForm, max_uses: e.target.value })} placeholder="Unlimited" /></div>
            </div>
            <div><Label>Per-User Limit</Label><Input type="number" value={couponForm.per_user_limit} onChange={(e) => setCouponForm({ ...couponForm, per_user_limit: e.target.value })} placeholder="Unlimited" /></div>

            {/* Category Scope */}
            <div>
              <Label>Category Scope</Label>
              <Select value={couponForm.category_scope} onValueChange={(v) => setCouponForm({ ...couponForm, category_scope: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="selected">Selected Categories Only</SelectItem>
                  <SelectItem value="excluded">Exclude Selected Categories</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {couponForm.category_scope !== "all" && (
              <div>
                <Label>{couponForm.category_scope === "selected" ? "Valid Categories" : "Excluded Categories"}</Label>
                <div className="max-h-32 overflow-y-auto border border-border rounded-md p-2 space-y-1.5">
                  {categories?.map((cat: any) => (
                    <label key={cat.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={couponForm.valid_category_ids.includes(cat.id)}
                        onCheckedChange={(checked) => {
                          setCouponForm(prev => ({
                            ...prev,
                            valid_category_ids: checked
                              ? [...prev.valid_category_ids, cat.id]
                              : prev.valid_category_ids.filter(id => id !== cat.id)
                          }));
                        }}
                      />
                      <span className="text-foreground">{cat.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div><Label>Starts At</Label><Input type="datetime-local" value={couponForm.starts_at} onChange={(e) => setCouponForm({ ...couponForm, starts_at: e.target.value })} /></div>
              <div><Label>Expires At</Label><Input type="datetime-local" value={couponForm.expires_at} onChange={(e) => setCouponForm({ ...couponForm, expires_at: e.target.value })} /></div>
            </div>
            <div className="flex items-center gap-2"><Switch checked={couponForm.is_active} onCheckedChange={(v) => setCouponForm({ ...couponForm, is_active: v })} /><Label>Active</Label></div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setCouponDialog(false)}>Cancel</Button>
              <Button onClick={saveCoupon} disabled={!couponForm.code || !couponForm.discount_value}>Save Coupon</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ Combo Dialog ═══ */}
      <Dialog open={comboDialog} onOpenChange={setComboDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingComboId ? "Edit Combo Pack" : "Add Combo Pack"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Name *</Label><Input value={comboForm.name} onChange={(e) => setComboForm({ ...comboForm, name: e.target.value })} placeholder="Arduino Starter Kit" /></div>
            <div><Label>Slug</Label><Input value={comboForm.slug} onChange={(e) => setComboForm({ ...comboForm, slug: e.target.value })} placeholder="auto-generated" /></div>
            <div><Label>Description</Label><Textarea value={comboForm.description} onChange={(e) => setComboForm({ ...comboForm, description: e.target.value })} rows={2} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Combo Price (Rs.) *</Label><Input type="number" value={comboForm.combo_price} onChange={(e) => setComboForm({ ...comboForm, combo_price: e.target.value })} /></div>
              <div><Label>Original Price (Rs.)</Label><Input type="number" value={comboForm.original_price} onChange={(e) => setComboForm({ ...comboForm, original_price: e.target.value })} /></div>
            </div>
            <div>
              <Label>Images</Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {comboImagePreviews.map((url, i) => (
                  <div key={i} className="relative group w-16 h-16">
                    <img src={url} alt="" className="w-16 h-16 rounded-lg object-cover border border-border" />
                    <button type="button" onClick={() => {
                      const updated = comboImagePreviews.filter((_, j) => j !== i);
                      setComboImagePreviews(updated);
                      setComboForm(prev => ({ ...prev, images: updated.join(", ") }));
                    }} className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-3 h-3" /></button>
                  </div>
                ))}
              </div>
              <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors text-sm text-muted-foreground">
                <Upload className="w-4 h-4" />{uploading ? "Uploading..." : "Upload images"}
                <input type="file" accept="image/*" multiple onChange={handleComboImageUpload} className="hidden" disabled={uploading} />
              </label>
            </div>
            <div>
              <Label className="mb-2 block">Bundled Products</Label>
              {comboForm.items.map((item, i) => (
                <div key={i} className="flex items-center gap-2 mb-2">
                  <Select value={item.product_id} onValueChange={(v) => {
                    const updated = [...comboForm.items];
                    updated[i] = { ...updated[i], product_id: v };
                    setComboForm({ ...comboForm, items: updated });
                  }}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder="Select product" /></SelectTrigger>
                    <SelectContent className="max-h-60">{products?.map((p) => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}</SelectContent>
                  </Select>
                  <Input type="number" value={item.quantity} onChange={(e) => {
                    const updated = [...comboForm.items];
                    updated[i] = { ...updated[i], quantity: e.target.value };
                    setComboForm({ ...comboForm, items: updated });
                  }} className="w-20" placeholder="Qty" />
                  {comboForm.items.length > 1 && (
                    <button onClick={() => setComboForm({ ...comboForm, items: comboForm.items.filter((_, j) => j !== i) })} className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                  )}
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setComboForm({ ...comboForm, items: [...comboForm.items, { product_id: "", quantity: "1" }] })} className="gap-1 mt-1"><Plus className="w-3.5 h-3.5" /> Add Product</Button>
            </div>
            <div className="border-t border-border pt-4 space-y-4">
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">Shipping / ප්‍රවාහනය</h4>
              <div>
                <Label>Shipping Source</Label>
                <Select value={comboForm.shipping_type} onValueChange={(v) => setComboForm({ ...comboForm, shipping_type: v })}>
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="local">🇱🇰 Local</SelectItem>
                    <SelectItem value="overseas">🌍 Overseas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Ships From</Label><Input value={comboForm.ships_from} onChange={(e) => setComboForm({ ...comboForm, ships_from: e.target.value })} placeholder="e.g. Colombo, Sri Lanka" /></div>
              <div><Label>Delivery ETA (after payment)</Label><Input value={comboForm.delivery_eta} onChange={(e) => setComboForm({ ...comboForm, delivery_eta: e.target.value })} placeholder="e.g. 2-4 Days or 7-14 Business Days" /></div>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2"><Switch checked={comboForm.is_active} onCheckedChange={(v) => setComboForm({ ...comboForm, is_active: v })} /><Label>Active</Label></div>
              <div className="flex items-center gap-2"><Switch checked={comboForm.is_featured} onCheckedChange={(v) => setComboForm({ ...comboForm, is_featured: v })} /><Label>Featured</Label></div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setComboDialog(false)}>Cancel</Button>
              <Button onClick={saveCombo} disabled={!comboForm.name || !comboForm.combo_price}>Save Combo</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ Promo Banner Dialog ═══ */}
      <Dialog open={promoDialog} onOpenChange={setPromoDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingPromoId ? "Edit" : "Add"} Promo Banner</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Title *</Label><Input value={promoForm.title} onChange={(e) => setPromoForm({ ...promoForm, title: e.target.value })} placeholder="Combo Starter Packs" /></div>
            <div><Label>Badge Text</Label><Input value={promoForm.badge_text} onChange={(e) => setPromoForm({ ...promoForm, badge_text: e.target.value })} placeholder="⚡ Flash Sale" /></div>
            <div><Label>Description</Label><Textarea value={promoForm.description} onChange={(e) => setPromoForm({ ...promoForm, description: e.target.value })} rows={2} placeholder="Short description..." /></div>
            <div>
              <Label>Banner Image</Label>
              <div className="flex gap-2 items-center">
                <Input value={promoForm.image_url} onChange={(e) => setPromoForm({ ...promoForm, image_url: e.target.value })} placeholder="https://... or upload" className="flex-1" />
                <label className="cursor-pointer">
                  <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setUploading(true);
                    const url = await uploadFile(file, "promo-banners");
                    setUploading(false);
                    if (url) setPromoForm((prev: any) => ({ ...prev, image_url: url }));
                  }} />
                  <span className="inline-flex items-center gap-1 px-3 py-2 text-sm border border-input rounded-md bg-background hover:bg-muted transition-colors">
                    <Upload className="w-4 h-4" /> {uploading ? "Uploading..." : "Upload"}
                  </span>
                </label>
              </div>
              {promoForm.image_url && (
                <img src={promoForm.image_url} alt="Preview" className="mt-2 w-full h-32 object-cover rounded-lg border border-border" />
              )}
            </div>
            <div><Label>Link URL</Label><Input value={promoForm.link_url} onChange={(e) => setPromoForm({ ...promoForm, link_url: e.target.value })} placeholder="/category/..." /></div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Gradient Color</Label>
                <Select value={promoForm.gradient_from} onValueChange={(v) => setPromoForm({ ...promoForm, gradient_from: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="primary">Primary (Blue)</SelectItem>
                    <SelectItem value="destructive">Destructive (Red)</SelectItem>
                    <SelectItem value="secondary">Secondary (Green)</SelectItem>
                    <SelectItem value="accent">Accent (Gold)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Sort Order</Label><Input type="number" value={promoForm.sort_order} onChange={(e) => setPromoForm({ ...promoForm, sort_order: e.target.value })} /></div>
            </div>
            <div className="flex items-center gap-2"><Switch checked={promoForm.is_active} onCheckedChange={(v) => setPromoForm({ ...promoForm, is_active: v })} /><Label>Active</Label></div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setPromoDialog(false)}>Cancel</Button>
              <Button onClick={savePromo} disabled={!promoForm.title}>Save Promo Banner</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ SMS Template Dialog ═══ */}
      <Dialog open={templateDialog} onOpenChange={setTemplateDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingTemplateId ? "Edit" : "Add"} SMS Template</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Name *</Label><Input value={templateForm.name} onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })} placeholder="Order Placed" /></div>
            <div><Label>Template Key *</Label><Input value={templateForm.template_key} onChange={(e) => setTemplateForm({ ...templateForm, template_key: e.target.value })} placeholder="order_placed" disabled={!!editingTemplateId} /></div>
            <div>
              <Label>Message Template *</Label>
              <Textarea value={templateForm.message_template} onChange={(e) => setTemplateForm({ ...templateForm, message_template: e.target.value })} rows={4} placeholder="Hi {{customer_name}}, your order #{{order_id}}..." />
              <p className="text-xs text-muted-foreground mt-1">{templateForm.message_template.length} characters</p>
            </div>
            <div><Label>Description</Label><Input value={templateForm.description} onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })} placeholder="When this template is used" /></div>
            <div className="flex items-center gap-2"><Switch checked={templateForm.is_active} onCheckedChange={(v) => setTemplateForm({ ...templateForm, is_active: v })} /><Label>Active</Label></div>
            {templateForm.message_template && (
              <div className="bg-muted/50 rounded-lg p-3 border border-border">
                <p className="text-xs text-muted-foreground mb-1 font-semibold">Preview:</p>
                <p className="text-sm text-foreground">{templateForm.message_template
                  .replace(/\{\{customer_name\}\}/g, "John")
                  .replace(/\{\{order_id\}\}/g, "A1B2C3D4")
                  .replace(/\{\{total\}\}/g, "4,500")
                  .replace(/\{\{status\}\}/g, "shipped")
                  .replace(/\{\{tracking_info\}\}/g, "Tracking: TRK123456. ")
                  .replace(/\{\{eta\}\}/g, "3-5 business days")
                  .replace(/\{\{OTP\d\}\}/g, "12345")
                }</p>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setTemplateDialog(false)}>Cancel</Button>
              <Button disabled={!templateForm.name || !templateForm.template_key || !templateForm.message_template} onClick={async () => {
                const payload = {
                  name: templateForm.name,
                  template_key: templateForm.template_key,
                  message_template: templateForm.message_template,
                  description: templateForm.description || null,
                  is_active: templateForm.is_active,
                };
                if (editingTemplateId) {
                  const { error } = await supabase.from("sms_templates" as any).update(payload).eq("id", editingTemplateId);
                  if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
                  toast({ title: "Template updated" });
                } else {
                  const { error } = await supabase.from("sms_templates" as any).insert(payload);
                  if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
                  toast({ title: "Template created" });
                }
                setTemplateDialog(false);
                queryClient.invalidateQueries({ queryKey: ["admin-sms-templates"] });
              }}>Save Template</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {/* ═══ Order Detail Dialog ═══ */}
      <AdminOrderDetailDialog
        open={orderDetailDialog}
        onOpenChange={setOrderDetailDialog}
        order={selectedOrder}
        companySettings={companySettings}
      />

      {/* Bulk Delete Confirmation Dialog */}
      <Dialog open={confirmBulkDelete} onOpenChange={setConfirmBulkDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive"><Trash2 className="w-5 h-5" /> Delete {selectedProducts.size} products?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">This will permanently delete <strong>{selectedProducts.size} products</strong>. Products linked to active orders may fail to delete.</p>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={() => setConfirmBulkDelete(false)}>Cancel</Button>
            <Button variant="destructive" onClick={bulkDeleteProducts} disabled={bulkDeleting}>
              {bulkDeleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Delete {selectedProducts.size} Products
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;
