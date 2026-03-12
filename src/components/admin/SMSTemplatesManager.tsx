import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import {
  Plus, Pencil, Trash2, Send, CreditCard, ShoppingBag, Cpu, Package, Shield,
  ChevronDown, ChevronUp,
} from "lucide-react";

// ── Category definitions ─────────────────────────────────────────────────────
const CATEGORIES: { key: string; label: string; icon: React.ElementType; color: string; prefixes: string[] }[] = [
  {
    key: "auth",
    label: "Auth & OTP",
    icon: Shield,
    color: "text-violet-600 bg-violet-50 border-violet-200",
    prefixes: ["otp_", "phone_", "verify_"],
  },
  {
    key: "orders",
    label: "Standard Orders",
    icon: ShoppingBag,
    color: "text-blue-600 bg-blue-50 border-blue-200",
    prefixes: ["order_"],
  },
  {
    key: "pcb",
    label: "PCB Orders",
    icon: Cpu,
    color: "text-emerald-600 bg-emerald-50 border-emerald-200",
    prefixes: ["pcb_"],
  },
  {
    key: "preorder",
    label: "Pre-Orders",
    icon: Package,
    color: "text-orange-600 bg-orange-50 border-orange-200",
    prefixes: ["preorder_"],
  },
  {
    key: "other",
    label: "Other",
    icon: Send,
    color: "text-muted-foreground bg-muted border-border",
    prefixes: [],
  },
];

function getCategory(templateKey: string) {
  for (const cat of CATEGORIES) {
    if (cat.key === "other") continue;
    if (cat.prefixes.some((p) => templateKey.startsWith(p))) return cat.key;
  }
  return "other";
}

const emptyForm = { template_key: "", name: "", message_template: "", description: "", is_active: true };

export default function SMSTemplatesManager() {
  const queryClient = useQueryClient();
  const [openCategories, setOpenCategories] = useState<Set<string>>(
    new Set(["auth", "orders", "pcb", "preorder", "other"])
  );
  const [dialog, setDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // SMS balance
  const { data: smsBalance } = useQuery({
    queryKey: ["sms-balance"],
    queryFn: async () => {
      const { data } = await supabase.functions.invoke("sms-balance");
      return data;
    },
    staleTime: 2 * 60 * 1000,
  });

  // Templates
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["admin-sms-templates"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("sms_templates").select("*").order("name");
      if (error) throw error;
      return data as any[];
    },
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-sms-templates"] });

  // Categorise
  const byCategory = CATEGORIES.map((cat) => ({
    ...cat,
    templates: templates.filter((t) => getCategory(t.template_key) === cat.key),
  }));

  // Toggle open/close category
  const toggleCat = (key: string) =>
    setOpenCategories((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  // Toggle active/inactive
  const toggleActive = async (t: any) => {
    setTogglingId(t.id);
    const { error } = await (supabase as any)
      .from("sms_templates")
      .update({ is_active: !t.is_active })
      .eq("id", t.id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else {
      toast({ title: t.is_active ? "Template disabled" : "Template enabled" });
      refresh();
    }
    setTogglingId(null);
  };

  // Delete
  const handleDelete = async (id: string) => {
    if (!confirm("Delete this template?")) return;
    await (supabase as any).from("sms_templates").delete().eq("id", id);
    refresh();
    toast({ title: "Template deleted" });
  };

  // Save (create / update)
  const handleSave = async () => {
    if (!form.template_key || !form.name || !form.message_template) {
      toast({ title: "Fill all required fields", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      template_key: form.template_key.trim().toLowerCase().replace(/\s+/g, "_"),
      name: form.name.trim(),
      message_template: form.message_template.trim(),
      description: form.description.trim() || null,
      is_active: form.is_active,
    };
    const { error } = editingId
      ? await (supabase as any).from("sms_templates").update(payload).eq("id", editingId)
      : await (supabase as any).from("sms_templates").insert(payload);
    setSaving(false);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: editingId ? "Template updated" : "Template created" });
    refresh();
    setDialog(false);
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setDialog(true);
  };

  const openEdit = (t: any) => {
    setEditingId(t.id);
    setForm({
      template_key: t.template_key,
      name: t.name,
      message_template: t.message_template,
      description: t.description || "",
      is_active: t.is_active,
    });
    setDialog(true);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold font-display text-foreground">SMS Templates</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Placeholders: <span className="font-mono">{"{{customer_name}}, {{order_id}}, {{total}}, {{status}}, {{OTP5}}"}</span>
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={openCreate}>
          <Plus className="w-4 h-4" /> Add Template
        </Button>
      </div>

      {/* SMS Balance */}
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
        <div className="ml-auto text-right">
          <p className="text-xs text-muted-foreground">Total Templates</p>
          <p className="text-lg font-bold text-foreground">{templates.length}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Active</p>
          <p className="text-lg font-bold text-secondary">
            {templates.filter((t) => t.is_active).length}
          </p>
        </div>
      </div>

      {/* Category accordion */}
      {isLoading ? (
        <div className="text-center py-16 text-muted-foreground text-sm">Loading templates…</div>
      ) : (
        <div className="space-y-4">
          {byCategory.map((cat) => {
            const isOpen = openCategories.has(cat.key);
            const Icon = cat.icon;
            const activeCount = cat.templates.filter((t) => t.is_active).length;

            return (
              <div key={cat.key} className="bg-card rounded-xl border border-border overflow-hidden">
                {/* Category header */}
                <button
                  onClick={() => toggleCat(cat.key)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors text-left"
                >
                  <div className={`w-8 h-8 rounded-lg border flex items-center justify-center flex-shrink-0 ${cat.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold text-foreground">{cat.label}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {activeCount}/{cat.templates.length} active
                    </span>
                  </div>
                  {isOpen ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  )}
                </button>

                {/* Templates */}
                {isOpen && (
                  <div className="divide-y divide-border/60">
                    {cat.templates.length === 0 ? (
                      <div className="px-4 py-6 text-center text-xs text-muted-foreground">
                        No templates in this category
                      </div>
                    ) : (
                      cat.templates.map((t) => (
                        <div key={t.id} className="px-4 py-3 flex flex-col gap-2">
                          {/* Top row */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 flex-wrap min-w-0">
                              <span className="text-sm font-semibold text-foreground truncate">{t.name}</span>
                              <span className="text-xs bg-muted px-2 py-0.5 rounded font-mono text-muted-foreground whitespace-nowrap">
                                {t.template_key}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {/* Active toggle */}
                              <div className="flex items-center gap-1.5">
                                <span className={`text-xs font-medium ${t.is_active ? "text-secondary" : "text-muted-foreground"}`}>
                                  {t.is_active ? "Active" : "Disabled"}
                                </span>
                                <Switch
                                  checked={t.is_active}
                                  disabled={togglingId === t.id}
                                  onCheckedChange={() => toggleActive(t)}
                                />
                              </div>
                              {/* Edit */}
                              <button
                                onClick={() => openEdit(t)}
                                className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              {/* Delete */}
                              <button
                                onClick={() => handleDelete(t.id)}
                                className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Message preview */}
                          <p className="text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded font-mono leading-relaxed">
                            {t.message_template}
                          </p>

                          {/* Footer */}
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            {t.description && <span>{t.description}</span>}
                            <span className="ml-auto">{t.message_template.length} characters</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Template" : "New SMS Template"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Name *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Order Placed"
                />
              </div>
              <div>
                <Label>Template Key *</Label>
                <Input
                  value={form.template_key}
                  onChange={(e) => setForm({ ...form, template_key: e.target.value })}
                  placeholder="e.g. order_placed"
                  className="font-mono text-sm"
                />
              </div>
            </div>

            <div>
              <Label>Message *</Label>
              <Textarea
                value={form.message_template}
                onChange={(e) => setForm({ ...form, message_template: e.target.value })}
                placeholder="Hi {{customer_name}}, your order #{{order_id}}…"
                className="font-mono text-sm min-h-[100px]"
              />
              <p className="text-xs text-muted-foreground mt-1">{form.message_template.length} characters</p>
            </div>

            <div>
              <Label>Description</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Sent when a new order is placed"
              />
            </div>

            <div className="flex items-center gap-3">
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) => setForm({ ...form, is_active: v })}
              />
              <Label className="cursor-pointer">Active</Label>
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setDialog(false)}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : editingId ? "Update Template" : "Create Template"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
