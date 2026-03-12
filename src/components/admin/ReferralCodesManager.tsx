import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Copy, Users, Tag, RefreshCw } from "lucide-react";

interface ReferralCodeForm {
  code: string;
  name: string;
  description: string;
  code_purpose: string;
  discount_type: string;
  discount_value: string;
  max_discount_cap: string;
  min_order_amount: string;
  max_uses: string;
  per_user_limit: string;
  is_active: boolean;
  expires_at: string;
}

const emptyForm: ReferralCodeForm = {
  code: "", name: "", description: "",
  code_purpose: "discount",
  discount_type: "percentage", discount_value: "",
  max_discount_cap: "", min_order_amount: "",
  max_uses: "", per_user_limit: "1",
  is_active: true, expires_at: "",
};

const generateCode = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
};

const ReferralCodesManager = () => {
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ReferralCodeForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const { data: referralCodes, isLoading } = useQuery({
    queryKey: ["admin-referral-codes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("referral_codes" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: usageStats } = useQuery({
    queryKey: ["admin-referral-usage-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("referral_code_usage" as any)
        .select("referral_code_id, discount_applied");
      if (error) throw error;
      const stats: Record<string, { count: number; total: number }> = {};
      (data as any[]).forEach((u: any) => {
        if (!stats[u.referral_code_id]) stats[u.referral_code_id] = { count: 0, total: 0 };
        stats[u.referral_code_id].count++;
        stats[u.referral_code_id].total += Number(u.discount_applied);
      });
      return stats;
    },
  });

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm, code: generateCode() });
    setDialog(true);
  };

  const openEdit = (rc: any) => {
    setEditingId(rc.id);
    setForm({
      code: rc.code,
      name: rc.name || "",
      description: rc.description || "",
      code_purpose: rc.code_purpose || "discount",
      discount_type: rc.discount_type,
      discount_value: String(rc.discount_value),
      max_discount_cap: rc.max_discount_cap ? String(rc.max_discount_cap) : "",
      min_order_amount: rc.min_order_amount ? String(rc.min_order_amount) : "",
      max_uses: rc.max_uses ? String(rc.max_uses) : "",
      per_user_limit: rc.per_user_limit ? String(rc.per_user_limit) : "1",
      is_active: rc.is_active,
      expires_at: rc.expires_at ? rc.expires_at.slice(0, 16) : "",
    });
    setDialog(true);
  };

  const handleSave = async () => {
    if (!form.code.trim() || !form.discount_value) {
      toast({ title: "Code and discount value are required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        code: form.code.toUpperCase().trim(),
        name: form.name || null,
        description: form.description || null,
        code_purpose: form.code_purpose,
        discount_type: form.discount_type,
        discount_value: form.code_purpose === "reference" ? 0 : Number(form.discount_value),
        max_discount_cap: form.max_discount_cap ? Number(form.max_discount_cap) : null,
        min_order_amount: form.min_order_amount ? Number(form.min_order_amount) : 0,
        max_uses: form.max_uses ? Number(form.max_uses) : null,
        per_user_limit: form.per_user_limit ? Number(form.per_user_limit) : 1,
        is_active: form.is_active,
        expires_at: form.expires_at || null,
      };

      if (editingId) {
        const { error } = await supabase.from("referral_codes" as any).update(payload).eq("id", editingId);
        if (error) throw error;
        toast({ title: "Referral code updated" });
      } else {
        const { error } = await supabase.from("referral_codes" as any).insert(payload);
        if (error) throw error;
        toast({ title: "Referral code created" });
      }

      queryClient.invalidateQueries({ queryKey: ["admin-referral-codes"] });
      setDialog(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this referral code?")) return;
    const { error } = await supabase.from("referral_codes" as any).delete().eq("id", id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Referral code deleted" });
    queryClient.invalidateQueries({ queryKey: ["admin-referral-codes"] });
  };

  const handleToggleActive = async (id: string, current: boolean) => {
    const { error } = await supabase.from("referral_codes" as any).update({ is_active: !current }).eq("id", id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    queryClient.invalidateQueries({ queryKey: ["admin-referral-codes"] });
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: `Copied: ${code}` });
  };

  const filtered = (referralCodes || []).filter((rc: any) =>
    rc.code.toLowerCase().includes(search.toLowerCase()) ||
    (rc.name || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <Input
          placeholder="Search referral codes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Button onClick={openCreate} size="sm" className="gap-1">
          <Plus className="w-4 h-4" /> New Referral Code
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Tag className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No referral codes yet</p>
          <p className="text-sm mt-1">Create a referral code to allow users to get discounts at checkout.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((rc: any) => {
            const stats = usageStats?.[rc.id] || { count: 0, total: 0 };
            const isExpired = rc.expires_at && new Date(rc.expires_at) < new Date();
            return (
              <div key={rc.id} className="bg-card border border-border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-foreground bg-muted px-2 py-0.5 rounded text-sm tracking-wider">{rc.code}</span>
                    <button onClick={() => copyCode(rc.code)} className="text-muted-foreground hover:text-foreground transition-colors">
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    {rc.is_active && !isExpired ? (
                      <Badge variant="secondary" className="text-xs">Active</Badge>
                    ) : isExpired ? (
                      <Badge variant="destructive" className="text-xs">Expired</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-muted-foreground">Inactive</Badge>
                    )}
                  </div>
                  {rc.name && <p className="text-sm font-medium text-foreground mt-1">{rc.name}</p>}
                  <div className="flex items-center gap-3 mt-1.5 flex-wrap text-xs text-muted-foreground">
                    <span className="font-semibold text-secondary">
                      {rc.discount_type === "percentage" ? `${rc.discount_value}% off` : `Rs. ${Number(rc.discount_value).toLocaleString()} off`}
                      {rc.max_discount_cap ? ` (max Rs. ${Number(rc.max_discount_cap).toLocaleString()})` : ""}
                    </span>
                    {rc.min_order_amount > 0 && <span>Min: Rs. {Number(rc.min_order_amount).toLocaleString()}</span>}
                    {rc.expires_at && <span>Expires: {new Date(rc.expires_at).toLocaleDateString()}</span>}
                    {rc.max_uses && <span>Max uses: {rc.max_uses}</span>}
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" /> {stats.count} uses · Rs. {stats.total.toLocaleString()} saved
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Switch
                    checked={rc.is_active}
                    onCheckedChange={() => handleToggleActive(rc.id, rc.is_active)}
                  />
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(rc)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(rc.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Referral Code" : "Create Referral Code"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="flex gap-2">
              <div className="flex-1">
                <Label>Code *</Label>
                <Input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  placeholder="SUMMER20"
                  className="font-mono uppercase"
                />
              </div>
              <div className="flex items-end">
                <Button type="button" variant="outline" size="icon" onClick={() => setForm({ ...form, code: generateCode() })} title="Generate random code">
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div>
              <Label>Name (optional)</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Summer Sale Referral" />
            </div>

            <div>
              <Label>Description (optional)</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Brief description..." />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Discount Type *</Label>
                <Select value={form.discount_type} onValueChange={(v) => setForm({ ...form, discount_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                    <SelectItem value="fixed">Fixed Amount (Rs.)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Discount Value *</Label>
                <Input
                  type="number" min="0"
                  value={form.discount_value}
                  onChange={(e) => setForm({ ...form, discount_value: e.target.value })}
                  placeholder={form.discount_type === "percentage" ? "10" : "500"}
                />
              </div>
            </div>

            {form.discount_type === "percentage" && (
              <div>
                <Label>Max Discount Cap (Rs.)</Label>
                <Input
                  type="number" min="0"
                  value={form.max_discount_cap}
                  onChange={(e) => setForm({ ...form, max_discount_cap: e.target.value })}
                  placeholder="Leave blank for no cap"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Min Order Amount (Rs.)</Label>
                <Input
                  type="number" min="0"
                  value={form.min_order_amount}
                  onChange={(e) => setForm({ ...form, min_order_amount: e.target.value })}
                  placeholder="0"
                />
              </div>
              <div>
                <Label>Per User Limit</Label>
                <Input
                  type="number" min="1"
                  value={form.per_user_limit}
                  onChange={(e) => setForm({ ...form, per_user_limit: e.target.value })}
                  placeholder="1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Total Max Uses</Label>
                <Input
                  type="number" min="0"
                  value={form.max_uses}
                  onChange={(e) => setForm({ ...form, max_uses: e.target.value })}
                  placeholder="Leave blank for unlimited"
                />
              </div>
              <div>
                <Label>Expires At</Label>
                <Input
                  type="datetime-local"
                  value={form.expires_at}
                  onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <Label>Active</Label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialog(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : editingId ? "Update" : "Create"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ReferralCodesManager;
