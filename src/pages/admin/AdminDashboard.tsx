import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Package, ShoppingBag, Image, BarChart3, Loader2, FolderTree, Plus, Trash2, Pencil, X, Upload, Tag, FileText, TrendingUp, DollarSign, Eye, MessageSquare, Ticket, Mail, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { motion } from "framer-motion";
import { toast } from "@/hooks/use-toast";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { Link } from "react-router-dom";

type Tab = "products" | "categories" | "orders" | "banners" | "deals" | "pages" | "reports" | "contacts" | "coupons";

interface ProductForm {
  name: string; slug: string; description: string; price: string; discount_price: string;
  sku: string; stock_quantity: string; category_id: string; images: string; is_active: boolean; is_featured: boolean;
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
  code: string; description: string; discount_type: string; discount_value: string;
  min_order_amount: string; max_uses: string; is_active: boolean; expires_at: string;
}

const emptyProduct: ProductForm = { name: "", slug: "", description: "", price: "", discount_price: "", sku: "", stock_quantity: "", category_id: "", images: "", is_active: true, is_featured: false };
const emptyCategory: CategoryForm = { name: "", slug: "", description: "", image_url: "", sort_order: "0", is_active: true };
const emptyBanner: BannerForm = { title: "", subtitle: "", image_url: "", link_url: "", sort_order: "0", is_active: true };
const emptyDeal: DealForm = { product_id: "", discount_percent: "", deal_price: "", starts_at: "", ends_at: "", is_active: true };
const emptyPage: PageForm = { title: "", slug: "", content: "", is_published: true };
const emptyCoupon: CouponForm = { code: "", description: "", discount_type: "percentage", discount_value: "", min_order_amount: "", max_uses: "", is_active: true, expires_at: "" };

const AdminDashboard = () => {
  const { isAdmin, loading } = useAdminAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("products");
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);

  const [productDialog, setProductDialog] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [productForm, setProductForm] = useState<ProductForm>(emptyProduct);
  const [productImagePreviews, setProductImagePreviews] = useState<string[]>([]);

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

  const unreadContacts = contactMessages?.filter((m: any) => !m.is_read).length || 0;

  const tabs = [
    { id: "products" as Tab, label: "Products", icon: Package, count: products?.length || 0 },
    { id: "categories" as Tab, label: "Categories", icon: FolderTree, count: categories?.length || 0 },
    { id: "orders" as Tab, label: "Orders", icon: ShoppingBag, count: orders?.length || 0 },
    { id: "banners" as Tab, label: "Banners", icon: Image, count: banners?.length || 0 },
    { id: "deals" as Tab, label: "Daily Deals", icon: Tag, count: deals?.length || 0 },
    { id: "pages" as Tab, label: "Pages", icon: FileText, count: pages?.length || 0 },
    { id: "coupons" as Tab, label: "Coupons", icon: Ticket, count: coupons?.length || 0 },
    { id: "contacts" as Tab, label: "Messages", icon: MessageSquare, count: unreadContacts },
    { id: "reports" as Tab, label: "Reports", icon: TrendingUp, count: 0 },
  ];

  const filteredProducts = products?.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));

  // ── Product CRUD ──
  const openAddProduct = () => { setEditingProductId(null); setProductForm(emptyProduct); setProductImagePreviews([]); setProductDialog(true); };
  const openEditProduct = (p: any) => {
    setEditingProductId(p.id);
    const imgs = p.images || [];
    setProductImagePreviews(imgs);
    setProductForm({
      name: p.name, slug: p.slug, description: p.description || "", price: String(p.price),
      discount_price: p.discount_price ? String(p.discount_price) : "", sku: p.sku || "",
      stock_quantity: String(p.stock_quantity || 0), category_id: p.category_id || "",
      images: imgs.join(", "), is_active: p.is_active ?? true, is_featured: p.is_featured ?? false,
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

  const saveProduct = async () => {
    const payload = {
      name: productForm.name,
      slug: productForm.slug || productForm.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
      description: productForm.description || null,
      price: Number(productForm.price),
      discount_price: productForm.discount_price ? Number(productForm.discount_price) : null,
      sku: productForm.sku || null,
      stock_quantity: Number(productForm.stock_quantity) || 0,
      category_id: productForm.category_id || null,
      images: productForm.images ? productForm.images.split(",").map((s) => s.trim()).filter(Boolean) : [],
      is_active: productForm.is_active,
      is_featured: productForm.is_featured,
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
    queryClient.invalidateQueries({ queryKey: ["admin-products"] });
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
    setCouponForm({ code: c.code, description: c.description || "", discount_type: c.discount_type, discount_value: String(c.discount_value), min_order_amount: c.min_order_amount ? String(c.min_order_amount) : "", max_uses: c.max_uses ? String(c.max_uses) : "", is_active: c.is_active ?? true, expires_at: c.expires_at ? new Date(c.expires_at).toISOString().slice(0, 16) : "" });
    setCouponDialog(true);
  };
  const saveCoupon = async () => {
    const payload = {
      code: couponForm.code.toUpperCase().trim(),
      description: couponForm.description || null,
      discount_type: couponForm.discount_type,
      discount_value: Number(couponForm.discount_value) || 0,
      min_order_amount: couponForm.min_order_amount ? Number(couponForm.min_order_amount) : 0,
      max_uses: couponForm.max_uses ? Number(couponForm.max_uses) : null,
      is_active: couponForm.is_active,
      expires_at: couponForm.expires_at ? new Date(couponForm.expires_at).toISOString() : null,
    };
    if (editingCouponId) {
      const { error } = await supabase.from("coupons").update(payload).eq("id", editingCouponId);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Coupon updated" });
    } else {
      const { error } = await supabase.from("coupons").insert(payload);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Coupon created" });
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

  // ── Order status ──
  const updateOrderStatus = async (orderId: string, status: string) => {
    const { error } = await supabase.from("orders").update({ status }).eq("id", orderId);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: `Order status changed to ${status}` });
    queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
  };
  const updatePaymentStatus = async (orderId: string, payment_status: string) => {
    const { error } = await supabase.from("orders").update({ payment_status }).eq("id", orderId);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: `Payment status changed to ${payment_status}` });
    queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
  };

  // ── Reports data ──
  const reportData = useMemo(() => {
    if (!orders) return null;
    const totalSales = orders.length;
    const totalRevenue = orders.filter(o => o.payment_status === "paid").reduce((sum, o) => sum + Number(o.total), 0);
    const pendingRevenue = orders.filter(o => o.payment_status === "pending").reduce((sum, o) => sum + Number(o.total), 0);

    // Monthly revenue
    const monthlyMap = new Map<string, number>();
    orders.filter(o => o.payment_status === "paid").forEach(o => {
      const d = new Date(o.created_at!);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthlyMap.set(key, (monthlyMap.get(key) || 0) + Number(o.total));
    });
    const monthlyRevenue = Array.from(monthlyMap.entries()).sort().slice(-6).map(([month, total]) => ({ month, total }));

    // Best sellers
    const productSales = new Map<string, { name: string; qty: number; revenue: number }>();
    orders.forEach(o => {
      (o.order_items as any[])?.forEach((item: any) => {
        const key = item.product_id;
        const existing = productSales.get(key) || { name: item.products?.name || "Unknown", qty: 0, revenue: 0 };
        existing.qty += item.quantity;
        existing.revenue += Number(item.total_price);
        productSales.set(key, existing);
      });
    });
    const bestSellers = Array.from(productSales.values()).sort((a, b) => b.qty - a.qty).slice(0, 10);

    // Payment method breakdown
    const paymentMethods = new Map<string, number>();
    orders.forEach(o => {
      paymentMethods.set(o.payment_method, (paymentMethods.get(o.payment_method) || 0) + 1);
    });

    // Status breakdown
    const statusMap = new Map<string, number>();
    orders.forEach(o => {
      statusMap.set(o.status, (statusMap.get(o.status) || 0) + 1);
    });

    return { totalSales, totalRevenue, pendingRevenue, monthlyRevenue, bestSellers, paymentMethods: Array.from(paymentMethods.entries()), statusBreakdown: Array.from(statusMap.entries()) };
  }, [orders]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-secondary" />
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 min-h-screen bg-card border-r border-border p-6 hidden md:block">
          <Link to="/">
            <h1 className="text-xl font-bold font-display text-foreground mb-1 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-secondary" /> Admin Panel
            </h1>
          </Link>
          <p className="text-xs text-muted-foreground mb-8">TechLK Management</p>
          <nav className="space-y-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  tab === t.id ? "bg-secondary/10 text-secondary font-medium" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <span className="flex items-center gap-2"><t.icon className="w-4 h-4" />{t.label}</span>
                {t.count > 0 && <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{t.count}</span>}
              </button>
            ))}
          </nav>
        </aside>

        <main className="flex-1 p-6 md:p-8">
          {/* Mobile tabs */}
          <div className="flex md:hidden gap-2 mb-6 overflow-x-auto pb-2">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm whitespace-nowrap ${
                  tab === t.id ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground"
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
                <Button onClick={openAddProduct} size="sm" className="gap-1.5"><Plus className="w-4 h-4" /> Add Product</Button>
              </div>
              <Input placeholder="Search products..." value={search} onChange={(e) => setSearch(e.target.value)} className="mb-4 max-w-sm" />
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Product</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">SKU</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Price</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Stock</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProducts?.map((p) => (
                        <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
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
                            <span className={`text-xs font-medium ${(p.stock_quantity || 0) > 10 ? "text-secondary" : "text-destructive"}`}>
                              {p.stock_quantity || 0}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${p.is_active ? "bg-secondary/10 text-secondary" : "bg-muted text-muted-foreground"}`}>
                              {p.is_active ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <button onClick={() => openEditProduct(p)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                              <button onClick={() => deleteProduct(p.id)} className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
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
              <h2 className="text-xl font-bold font-display text-foreground mb-6">Orders</h2>
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
                        </tr>
                      </thead>
                      <tbody>
                        {orders.map((o) => (
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
                                <SelectTrigger className="h-7 text-xs w-[120px]"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {["pending", "confirmed", "shipped", "delivered", "cancelled"].map((s) => (
                                    <SelectItem key={s} value={s} className="capitalize text-xs">{s}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="px-4 py-3">
                              <Select value={o.payment_status} onValueChange={(v) => updatePaymentStatus(o.id, v)}>
                                <SelectTrigger className="h-7 text-xs w-[110px]"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {["pending", "paid", "failed", "refunded"].map((s) => (
                                    <SelectItem key={s} value={s} className="capitalize text-xs">{s}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="px-4 py-3">
                              {(o as any).receipt_url ? (
                                <a href={(o as any).receipt_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-secondary hover:underline">
                                  <Eye className="w-3.5 h-3.5" /> View
                                </a>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
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
            </motion.div>
          )}

          {/* ═══ Banners Tab ═══ */}
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
                      {deals?.map((d) => {
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

          {/* ═══ Reports Tab ═══ */}
          {tab === "reports" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h2 className="text-xl font-bold font-display text-foreground mb-6">Reports & Analytics</h2>
              {reportData ? (
                <div className="space-y-6">
                  {/* Summary Cards */}
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

                  {/* Monthly Revenue */}
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
                    {/* Best Sellers */}
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

                    {/* Payment & Status Breakdown */}
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
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Discount</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Min Order</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Usage</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Expires</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {coupons?.map((c: any) => {
                        const isExpired = c.expires_at && new Date(c.expires_at) < new Date();
                        return (
                          <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                            <td className="px-4 py-3 font-mono font-bold text-foreground">{c.code}</td>
                            <td className="px-4 py-3 text-foreground">
                              {c.discount_type === "percentage" ? `${c.discount_value}%` : `Rs. ${Number(c.discount_value).toLocaleString()}`}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">{c.min_order_amount ? `Rs. ${Number(c.min_order_amount).toLocaleString()}` : "—"}</td>
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
                        <tr><td colSpan={7} className="text-center py-16 text-muted-foreground"><Ticket className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>No coupons yet</p></td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {/* ═══ Contact Messages Tab ═══ */}
          {tab === "contacts" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h2 className="text-xl font-bold font-display text-foreground mb-6">Contact Messages</h2>
              <div className="space-y-4">
                {contactMessages?.map((m: any) => (
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
                {(!contactMessages || contactMessages.length === 0) && (
                  <div className="text-center py-16 text-muted-foreground">
                    <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>No messages yet</p>
                  </div>
                )}
              </div>
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
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Price (Rs.) *</Label><Input type="number" value={productForm.price} onChange={(e) => setProductForm({ ...productForm, price: e.target.value })} /></div>
              <div><Label>Original Price (Rs.)</Label><Input type="number" value={productForm.discount_price} onChange={(e) => setProductForm({ ...productForm, discount_price: e.target.value })} placeholder="Higher price" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
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
                <Upload className="w-4 h-4" />{uploading ? "Uploading..." : "Upload images"}
                <input type="file" accept="image/*" multiple onChange={handleProductImageUpload} className="hidden" disabled={uploading} />
              </label>
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
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingCouponId ? "Edit Coupon" : "Add Coupon"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Code *</Label><Input value={couponForm.code} onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })} placeholder="SAVE20" /></div>
            <div><Label>Description</Label><Input value={couponForm.description} onChange={(e) => setCouponForm({ ...couponForm, description: e.target.value })} placeholder="20% off your order" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
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
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Min Order (Rs.)</Label><Input type="number" value={couponForm.min_order_amount} onChange={(e) => setCouponForm({ ...couponForm, min_order_amount: e.target.value })} placeholder="0" /></div>
              <div><Label>Max Uses</Label><Input type="number" value={couponForm.max_uses} onChange={(e) => setCouponForm({ ...couponForm, max_uses: e.target.value })} placeholder="Unlimited" /></div>
            </div>
            <div><Label>Expires At</Label><Input type="datetime-local" value={couponForm.expires_at} onChange={(e) => setCouponForm({ ...couponForm, expires_at: e.target.value })} /></div>
            <div className="flex items-center gap-2"><Switch checked={couponForm.is_active} onCheckedChange={(v) => setCouponForm({ ...couponForm, is_active: v })} /><Label>Active</Label></div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setCouponDialog(false)}>Cancel</Button>
              <Button onClick={saveCoupon} disabled={!couponForm.code || !couponForm.discount_value}>Save Coupon</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;
