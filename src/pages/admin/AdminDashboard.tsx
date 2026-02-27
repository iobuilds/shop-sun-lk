import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Package, ShoppingBag, Image, BarChart3, Loader2, FolderTree, Plus, Trash2, Pencil, X } from "lucide-react";
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

type Tab = "products" | "categories" | "orders" | "banners";

interface ProductForm {
  name: string;
  slug: string;
  description: string;
  price: string;
  discount_price: string;
  sku: string;
  stock_quantity: string;
  category_id: string;
  images: string;
  is_active: boolean;
  is_featured: boolean;
}

interface CategoryForm {
  name: string;
  slug: string;
  description: string;
  image_url: string;
  sort_order: string;
  is_active: boolean;
}

const emptyProduct: ProductForm = { name: "", slug: "", description: "", price: "", discount_price: "", sku: "", stock_quantity: "", category_id: "", images: "", is_active: true, is_featured: false };
const emptyCategory: CategoryForm = { name: "", slug: "", description: "", image_url: "", sort_order: "0", is_active: true };

const AdminDashboard = () => {
  const { isAdmin, loading } = useAdminAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("products");
  const [search, setSearch] = useState("");

  // Dialogs
  const [productDialog, setProductDialog] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [productForm, setProductForm] = useState<ProductForm>(emptyProduct);

  const [categoryDialog, setCategoryDialog] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [categoryForm, setCategoryForm] = useState<CategoryForm>(emptyCategory);

  const { data: products } = useQuery({
    queryKey: ["admin-products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*, categories(name)").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: categories } = useQuery({
    queryKey: ["admin-categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("*").order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const { data: orders } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("*, order_items(*, products(name))").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: banners } = useQuery({
    queryKey: ["admin-banners"],
    queryFn: async () => {
      const { data, error } = await supabase.from("banners").select("*").order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const tabs = [
    { id: "products" as Tab, label: "Products", icon: Package, count: products?.length || 0 },
    { id: "categories" as Tab, label: "Categories", icon: FolderTree, count: categories?.length || 0 },
    { id: "orders" as Tab, label: "Orders", icon: ShoppingBag, count: orders?.length || 0 },
    { id: "banners" as Tab, label: "Banners", icon: Image, count: banners?.length || 0 },
  ];

  const filteredProducts = products?.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  // Product CRUD
  const openAddProduct = () => { setEditingProductId(null); setProductForm(emptyProduct); setProductDialog(true); };
  const openEditProduct = (p: any) => {
    setEditingProductId(p.id);
    setProductForm({
      name: p.name, slug: p.slug, description: p.description || "", price: String(p.price),
      discount_price: p.discount_price ? String(p.discount_price) : "", sku: p.sku || "",
      stock_quantity: String(p.stock_quantity || 0), category_id: p.category_id || "",
      images: (p.images || []).join(", "), is_active: p.is_active ?? true, is_featured: p.is_featured ?? false,
    });
    setProductDialog(true);
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

  // Category CRUD
  const openAddCategory = () => { setEditingCategoryId(null); setCategoryForm(emptyCategory); setCategoryDialog(true); };
  const openEditCategory = (c: any) => {
    setEditingCategoryId(c.id);
    setCategoryForm({
      name: c.name, slug: c.slug, description: c.description || "",
      image_url: c.image_url || "", sort_order: String(c.sort_order || 0), is_active: c.is_active ?? true,
    });
    setCategoryDialog(true);
  };

  const saveCategory = async () => {
    const payload = {
      name: categoryForm.name,
      slug: categoryForm.slug || categoryForm.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
      description: categoryForm.description || null,
      image_url: categoryForm.image_url || null,
      sort_order: Number(categoryForm.sort_order) || 0,
      is_active: categoryForm.is_active,
    };

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
                <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{t.count}</span>
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

          {/* Products Tab */}
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
                              <button onClick={() => openEditProduct(p)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => deleteProduct(p.id)} className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
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

          {/* Categories Tab */}
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
                        <button onClick={() => openEditCategory(c)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => deleteCategory(c.id)} className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${c.is_active ? "bg-secondary/10 text-secondary" : "bg-muted text-muted-foreground"}`}>
                        {c.is_active ? "Active" : "Inactive"}
                      </span>
                      <span className="text-xs text-muted-foreground">Order: {c.sort_order}</span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Orders Tab */}
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
                          <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                          <th className="text-left px-4 py-3 font-medium text-muted-foreground">Payment</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orders.map((o) => (
                          <tr key={o.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                            <td className="px-4 py-3 font-mono text-xs text-foreground">{o.id.slice(0, 8)}</td>
                            <td className="px-4 py-3 text-muted-foreground">{new Date(o.created_at!).toLocaleDateString()}</td>
                            <td className="px-4 py-3 font-medium text-foreground">Rs. {o.total.toLocaleString()}</td>
                            <td className="px-4 py-3">
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${
                                o.status === "completed" ? "bg-secondary/10 text-secondary" :
                                o.status === "pending" ? "bg-accent/10 text-accent-foreground" :
                                "bg-muted text-muted-foreground"
                              }`}>{o.status}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`text-xs capitalize ${o.payment_status === "paid" ? "text-secondary" : "text-muted-foreground"}`}>
                                {o.payment_status}
                              </span>
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

          {/* Banners Tab */}
          {tab === "banners" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h2 className="text-xl font-bold font-display text-foreground mb-6">Banners</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {banners?.map((b) => (
                  <div key={b.id} className="bg-card rounded-xl border border-border overflow-hidden">
                    <img src={b.image_url} alt={b.title} className="w-full h-40 object-cover" />
                    <div className="p-4">
                      <h3 className="font-semibold text-foreground">{b.title}</h3>
                      {b.subtitle && <p className="text-sm text-muted-foreground">{b.subtitle}</p>}
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${b.is_active ? "bg-secondary/10 text-secondary" : "bg-muted text-muted-foreground"}`}>
                          {b.is_active ? "Active" : "Inactive"}
                        </span>
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
        </main>
      </div>

      {/* Product Dialog */}
      <Dialog open={productDialog} onOpenChange={setProductDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProductId ? "Edit Product" : "Add Product"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name *</Label>
              <Input value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} placeholder="Product name" />
            </div>
            <div>
              <Label>Slug</Label>
              <Input value={productForm.slug} onChange={(e) => setProductForm({ ...productForm, slug: e.target.value })} placeholder="auto-generated-from-name" />
            </div>
            <div>
              <Label>Category</Label>
              <Select value={productForm.category_id} onValueChange={(v) => setProductForm({ ...productForm, category_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Price (Rs.) *</Label>
                <Input type="number" value={productForm.price} onChange={(e) => setProductForm({ ...productForm, price: e.target.value })} />
              </div>
              <div>
                <Label>Original Price (Rs.)</Label>
                <Input type="number" value={productForm.discount_price} onChange={(e) => setProductForm({ ...productForm, discount_price: e.target.value })} placeholder="Higher price for discount" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>SKU</Label>
                <Input value={productForm.sku} onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })} />
              </div>
              <div>
                <Label>Stock Quantity</Label>
                <Input type="number" value={productForm.stock_quantity} onChange={(e) => setProductForm({ ...productForm, stock_quantity: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={productForm.description} onChange={(e) => setProductForm({ ...productForm, description: e.target.value })} rows={3} />
            </div>
            <div>
              <Label>Image URLs (comma separated)</Label>
              <Textarea value={productForm.images} onChange={(e) => setProductForm({ ...productForm, images: e.target.value })} rows={2} placeholder="https://example.com/img1.jpg, https://example.com/img2.jpg" />
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch checked={productForm.is_active} onCheckedChange={(v) => setProductForm({ ...productForm, is_active: v })} />
                <Label>Active</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={productForm.is_featured} onCheckedChange={(v) => setProductForm({ ...productForm, is_featured: v })} />
                <Label>Featured</Label>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setProductDialog(false)}>Cancel</Button>
              <Button onClick={saveProduct} disabled={!productForm.name || !productForm.price}>Save Product</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Category Dialog */}
      <Dialog open={categoryDialog} onOpenChange={setCategoryDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingCategoryId ? "Edit Category" : "Add Category"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name *</Label>
              <Input value={categoryForm.name} onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })} placeholder="Category name" />
            </div>
            <div>
              <Label>Slug</Label>
              <Input value={categoryForm.slug} onChange={(e) => setCategoryForm({ ...categoryForm, slug: e.target.value })} placeholder="auto-generated-from-name" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={categoryForm.description} onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })} rows={2} />
            </div>
            <div>
              <Label>Image URL</Label>
              <Input value={categoryForm.image_url} onChange={(e) => setCategoryForm({ ...categoryForm, image_url: e.target.value })} placeholder="https://example.com/category.jpg" />
            </div>
            <div>
              <Label>Sort Order</Label>
              <Input type="number" value={categoryForm.sort_order} onChange={(e) => setCategoryForm({ ...categoryForm, sort_order: e.target.value })} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={categoryForm.is_active} onCheckedChange={(v) => setCategoryForm({ ...categoryForm, is_active: v })} />
              <Label>Active</Label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setCategoryDialog(false)}>Cancel</Button>
              <Button onClick={saveCategory} disabled={!categoryForm.name}>Save Category</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;
