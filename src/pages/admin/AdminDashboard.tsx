import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Package, ShoppingBag, Image, BarChart3, Loader2, FolderTree, Plus, Trash2, Pencil, X, Upload, Tag, FileText, TrendingUp, DollarSign, Eye, MessageSquare, Ticket, Mail, Check, Users, Star, Layers, Search, Save, Building2, Video, FileDown, LogOut } from "lucide-react";
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

type Tab = "products" | "categories" | "orders" | "banners" | "promo_banners" | "deals" | "pages" | "reports" | "contacts" | "coupons" | "users" | "reviews" | "combos" | "seo" | "bank";

interface ProductForm {
  name: string; slug: string; description: string; price: string; discount_price: string;
  sku: string; stock_quantity: string; category_id: string; images: string; is_active: boolean; is_featured: boolean;
  video_url: string; datasheet_url: string;
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
interface ComboForm {
  name: string; slug: string; description: string; combo_price: string; original_price: string;
  images: string; is_active: boolean; is_featured: boolean; items: { product_id: string; quantity: string }[];
}

const emptyProduct: ProductForm = { name: "", slug: "", description: "", price: "", discount_price: "", sku: "", stock_quantity: "", category_id: "", images: "", is_active: true, is_featured: false, video_url: "", datasheet_url: "" };
const emptyCategory: CategoryForm = { name: "", slug: "", description: "", image_url: "", sort_order: "0", is_active: true };
const emptyBanner: BannerForm = { title: "", subtitle: "", image_url: "", link_url: "", sort_order: "0", is_active: true };
const emptyDeal: DealForm = { product_id: "", discount_percent: "", deal_price: "", starts_at: "", ends_at: "", is_active: true };
const emptyPage: PageForm = { title: "", slug: "", content: "", is_published: true };
const emptyCoupon: CouponForm = { code: "", description: "", discount_type: "percentage", discount_value: "", min_order_amount: "", max_uses: "", is_active: true, expires_at: "" };
const emptyCombo: ComboForm = { name: "", slug: "", description: "", combo_price: "", original_price: "", images: "", is_active: true, is_featured: false, items: [{ product_id: "", quantity: "1" }] };

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

  const [comboDialog, setComboDialog] = useState(false);
  const [editingComboId, setEditingComboId] = useState<string | null>(null);
  const [comboForm, setComboForm] = useState<ComboForm>(emptyCombo);
  const [comboImagePreviews, setComboImagePreviews] = useState<string[]>([]);

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

  const [seoForm, setSeoForm] = useState<any>(null);
  const [bankForm, setBankForm] = useState<any>(null);
  useEffect(() => {
    if (seoSettings && !seoForm) setSeoForm(seoSettings);
  }, [seoSettings]);
  useEffect(() => {
    if (bankSettings && !bankForm) setBankForm(bankSettings);
  }, [bankSettings]);

  const unreadContacts = contactMessages?.filter((m: any) => !m.is_read).length || 0;

  const comboCategoryProducts = useMemo(() => {
    const comboCategoryId = categories?.find((c: any) => c.slug === "combo-packs")?.id;
    if (!comboCategoryId || !products) return [];
    return products.filter((p: any) => p.category_id === comboCategoryId);
  }, [categories, products]);

  const tabs = [
    { id: "products" as Tab, label: "Products", icon: Package, count: products?.length || 0 },
    { id: "categories" as Tab, label: "Categories", icon: FolderTree, count: categories?.length || 0 },
    { id: "orders" as Tab, label: "Orders", icon: ShoppingBag, count: orders?.length || 0 },
    { id: "banners" as Tab, label: "Hero Banners", icon: Image, count: banners?.length || 0 },
    { id: "promo_banners" as Tab, label: "Promo Banners", icon: Image, count: promoBanners?.length || 0 },
    { id: "deals" as Tab, label: "Daily Deals", icon: Tag, count: deals?.length || 0 },
    { id: "combos" as Tab, label: "Combo Packs", icon: Layers, count: (comboPacks?.length || 0) + comboCategoryProducts.length },
    { id: "pages" as Tab, label: "Pages", icon: FileText, count: pages?.length || 0 },
    { id: "coupons" as Tab, label: "Coupons", icon: Ticket, count: coupons?.length || 0 },
    { id: "users" as Tab, label: "Users", icon: Users, count: allProfiles?.length || 0 },
    { id: "reviews" as Tab, label: "Reviews", icon: Star, count: allReviews?.length || 0 },
    { id: "contacts" as Tab, label: "Messages", icon: MessageSquare, count: unreadContacts },
    { id: "seo" as Tab, label: "SEO", icon: Search, count: 0 },
    { id: "bank" as Tab, label: "Bank Details", icon: Building2, count: 0 },
    { id: "reports" as Tab, label: "Reports", icon: TrendingUp, count: 0 },
  ];

  const [productPage, setProductPage] = useState(0);
  const PRODUCTS_PER_PAGE = 15;
  const filteredProducts = products?.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));
  const totalProductPages = Math.ceil((filteredProducts?.length || 0) / PRODUCTS_PER_PAGE);
  const paginatedProducts = filteredProducts?.slice(productPage * PRODUCTS_PER_PAGE, (productPage + 1) * PRODUCTS_PER_PAGE);

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
      video_url: (p as any).video_url || "", datasheet_url: (p as any).datasheet_url || "",
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
    const payload: any = {
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
      video_url: productForm.video_url || null,
      datasheet_url: productForm.datasheet_url || null,
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

  // ── Review moderation ──
  const deleteReview = async (id: string) => {
    const { error } = await supabase.from("reviews").delete().eq("id", id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Review deleted" });
    queryClient.invalidateQueries({ queryKey: ["admin-reviews"] });
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
    const paymentMethods = new Map<string, number>();
    orders.forEach(o => { paymentMethods.set(o.payment_method, (paymentMethods.get(o.payment_method) || 0) + 1); });
    const statusMap = new Map<string, number>();
    orders.forEach(o => { statusMap.set(o.status, (statusMap.get(o.status) || 0) + 1); });
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

  // Helper to get user role
  const getUserRole = (userId: string) => {
    const role = userRoles?.find(r => r.user_id === userId);
    return role?.role || "user";
  };

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
          <div className="mt-6 pt-6 border-t border-border">
            <button
              onClick={async () => { await supabase.auth.signOut(); window.location.href = "/"; }}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="w-4 h-4" /> Sign Out
            </button>
          </div>
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
                      {paginatedProducts?.map((p) => (
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
                            <span className={`text-xs font-medium ${(p.stock_quantity || 0) > 10 ? "text-secondary" : (p.stock_quantity || 0) > 0 ? "text-accent-foreground" : "text-destructive"}`}>
                              {p.stock_quantity || 0}{(p.stock_quantity || 0) <= 5 && (p.stock_quantity || 0) > 0 ? " ⚠️" : ""}
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
              {/* Pagination */}
              {totalProductPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-xs text-muted-foreground">
                    Showing {productPage * PRODUCTS_PER_PAGE + 1}–{Math.min((productPage + 1) * PRODUCTS_PER_PAGE, filteredProducts?.length || 0)} of {filteredProducts?.length || 0}
                  </p>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" disabled={productPage === 0} onClick={() => setProductPage(p => p - 1)}>Previous</Button>
                    {Array.from({ length: totalProductPages }, (_, i) => (
                      <Button key={i} variant={productPage === i ? "default" : "outline"} size="sm" onClick={() => setProductPage(i)} className="w-8 h-8 p-0">{i + 1}</Button>
                    )).slice(Math.max(0, productPage - 2), productPage + 3)}
                    <Button variant="outline" size="sm" disabled={productPage >= totalProductPages - 1} onClick={() => setProductPage(p => p + 1)}>Next</Button>
                  </div>
                </div>
              )}
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
                          <th className="text-left px-4 py-3 font-medium text-muted-foreground">Actions</th>
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
                                <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {["pending", "confirmed", "shipped", "delivered", "cancelled"].map((s) => (
                                    <SelectItem key={s} value={s} className="capitalize text-xs">{s}</SelectItem>
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
                              <button onClick={() => deleteOrder(o.id)} className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title="Delete order"><Trash2 className="w-3.5 h-3.5" /></button>
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
                    <p>No saved combo packs yet</p>
                  </div>
                )}
              </div>

              {comboCategoryProducts.length > 0 && (
                <div className="bg-card rounded-xl border border-border p-4 md:p-5">
                  <h3 className="text-base font-semibold text-foreground mb-3">Products in "Combo Packs" category (not yet real combos)</h3>
                  <p className="text-xs text-muted-foreground mb-3">Convert these to real combo packs with bundled pricing and multiple products.</p>
                  <div className="space-y-2">
                    {comboCategoryProducts.map((p: any) => (
                      <div key={p.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <img src={p.images?.[0] || "/placeholder.svg"} alt={p.name} className="w-10 h-10 rounded-md object-cover" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                            <p className="text-xs text-muted-foreground">Rs. {Number(p.price).toLocaleString()}</p>
                          </div>
                        </div>
                        <Button size="sm" onClick={() => {
                          setEditingComboId(null);
                          setComboImagePreviews(p.images || []);
                          setComboForm({
                            name: p.name,
                            slug: p.slug || p.name.toLowerCase().replace(/\s+/g, "-"),
                            description: p.description || "",
                            combo_price: String(p.discount_price || p.price || ""),
                            original_price: String(p.price || ""),
                            images: (p.images || []).join(", "),
                            is_active: true,
                            is_featured: false,
                            items: [{ product_id: p.id, quantity: "1" }, { product_id: "", quantity: "1" }],
                          });
                          setComboDialog(true);
                        }}>Convert to Combo</Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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

          {/* ═══ Users Tab ═══ */}
          {tab === "users" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h2 className="text-xl font-bold font-display text-foreground mb-6">Users</h2>
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">User</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Phone</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">City</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Role</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Joined</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Orders</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allProfiles?.map((p) => {
                        const role = getUserRole(p.user_id);
                        const userOrders = orders?.filter(o => o.user_id === p.user_id) || [];
                        return (
                          <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-secondary/10 flex items-center justify-center text-secondary font-bold text-sm">
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
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${role === "admin" ? "bg-destructive/10 text-destructive" : role === "moderator" ? "bg-accent/10 text-accent-foreground" : "bg-muted text-muted-foreground"}`}>
                                {role}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground text-xs">{p.created_at ? new Date(p.created_at).toLocaleDateString() : "—"}</td>
                            <td className="px-4 py-3 text-foreground font-medium">{userOrders.length}</td>
                          </tr>
                        );
                      })}
                      {(!allProfiles || allProfiles.length === 0) && (
                        <tr><td colSpan={6} className="text-center py-16 text-muted-foreground"><Users className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>No users yet</p></td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {/* ═══ Reviews Tab ═══ */}
          {tab === "reviews" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h2 className="text-xl font-bold font-display text-foreground mb-6">Reviews Moderation</h2>
              <div className="space-y-3">
                {allReviews?.map((r: any) => (
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
                      <div><Label>Store Name</Label><Input value={seoForm.store_name || ""} onChange={(e) => setSeoForm({ ...seoForm, store_name: e.target.value })} placeholder="TechLK" /></div>
                      <div><Label>Tagline</Label><Input value={seoForm.tagline || ""} onChange={(e) => setSeoForm({ ...seoForm, tagline: e.target.value })} placeholder="Sri Lanka's #1 Electronics Store" /></div>
                    </div>
                    <div><Label>Meta Description</Label><Textarea value={seoForm.meta_description || ""} onChange={(e) => setSeoForm({ ...seoForm, meta_description: e.target.value })} rows={3} placeholder="Brief description for search engines (max 160 chars)" /></div>
                    <p className="text-xs text-muted-foreground">{(seoForm.meta_description || "").length}/160 characters</p>
                    <div><Label>Meta Keywords</Label><Input value={seoForm.meta_keywords || ""} onChange={(e) => setSeoForm({ ...seoForm, meta_keywords: e.target.value })} placeholder="electronics, arduino, sensors, Sri Lanka" /></div>
                    <div><Label>OG Image URL</Label><Input value={seoForm.og_image || ""} onChange={(e) => setSeoForm({ ...seoForm, og_image: e.target.value })} placeholder="https://example.com/og-image.jpg" /></div>
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

          {/* ═══ Reports Tab ═══ */}
          {tab === "reports" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h2 className="text-xl font-bold font-display text-foreground mb-6">Reports & Analytics</h2>
              {reportData ? (
                <div className="space-y-6">
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
    </div>
  );
};

export default AdminDashboard;
