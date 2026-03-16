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
  Plus, Pencil, Trash2, Mail, Eye, Code, Send,
  ShoppingBag, Cpu, Package, Shield,
  ChevronDown, ChevronUp, TestTube, Loader2,
} from "lucide-react";

// ── Categories (mirrors SMS structure) ───────────────────────────────────────
const CATEGORIES: { key: string; label: string; icon: React.ElementType; color: string; prefixes: string[] }[] = [
  {
    key: "auth",
    label: "Auth & Account",
    icon: Shield,
    color: "text-violet-600 bg-violet-50 border-violet-200",
    prefixes: ["auth_", "otp_", "verify_", "password_", "account_", "welcome_"],
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
    icon: Mail,
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

const VARIABLE_TOKENS = [
  "{{customer_name}}", "{{order_id}}", "{{total}}", "{{status}}",
  "{{tracking_number}}", "{{payment_method}}", "{{items}}", "{{site_name}}",
  "{{tracking_link}}", "{{eta}}", "{{quantity}}", "{{unit_cost}}",
  "{{shipping_fee}}", "{{tax_amount}}", "{{admin_notes}}",
];

const DEFAULT_HTML = `<p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:#344054;">Hi {{customer_name}},</p>
<p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:#344054;">Your update from <strong style="color:#111827;">NanoCircuit.lk</strong> is ready.</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 0;">
  <tr>
    <td style="border-radius:999px;background:#1a1a2e;">
      <a href="https://nanocircuit.lk/profile" style="display:inline-block;padding:12px 22px;font-size:14px;font-weight:600;line-height:1;color:#ffffff;text-decoration:none;">View details</a>
    </td>
  </tr>
</table>`;

const TEST_TEMPLATE_DATA: Record<string, string> = {
  customer_name: "Supun Chathuranga",
  order_id: "NC-240316",
  total: "12,500",
  status: "confirmed",
  tracking_number: "TRK-458921",
  payment_method: "Card Payment",
  items: "ESP32 Dev Board ×1, Soldering Kit ×1",
  site_name: "NanoCircuit.lk",
  tracking_link: "https://nanocircuit.lk/track-order",
  eta: "2-3 business days",
  quantity: "10",
  unit_cost: "8,900",
  shipping_fee: "1,400",
  tax_amount: "2,200",
  admin_notes: "Your files were checked and are ready for production.",
};

function buildPreviewHtml(subject: string, body: string) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:24px;background:#f5f7fb;font-family:Arial,sans-serif;">
  <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e6e8ef;border-radius:24px;overflow:hidden;box-shadow:0 18px 48px rgba(15,23,42,0.08);">
    <div style="padding:28px 32px 18px;background:linear-gradient(180deg,#eef2ff 0%,#ffffff 100%);border-bottom:1px solid #e6e8ef;">
      <p style="margin:0 0 10px;font-size:11px;line-height:1.4;letter-spacing:0.24em;text-transform:uppercase;color:#667085;">NanoCircuit.lk</p>
      <h1 style="margin:0;font-size:26px;line-height:1.2;color:#101828;font-weight:700;">${subject || "Email preview"}</h1>
    </div>
    <div style="padding:32px;">${body}</div>
    <div style="padding:16px 32px;background:#f8fafc;border-top:1px solid #e6e8ef;font-size:12px;line-height:1.6;color:#667085;text-align:center;">
      NanoCircuit.lk · Clean transactional email preview
    </div>
  </div>
</body>
</html>`;
}

const emptyForm = {
  template_key: "", name: "", subject: "", html_body: DEFAULT_HTML,
  text_body: "", description: "", is_active: true,
};

interface EmailTemplate {
  id: string; template_key: string; name: string; subject: string;
  html_body: string; text_body: string | null; description: string | null;
  is_active: boolean; created_at: string; updated_at: string;
}

export default function EmailTemplatesManager() {
  const queryClient = useQueryClient();
  const [openCategories, setOpenCategories] = useState<Set<string>>(
    new Set(["auth", "orders", "pcb", "preorder", "other"])
  );
  const [dialog, setDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [editorMode, setEditorMode] = useState<"source" | "preview">("source");

  // Test send
  const [testDialog, setTestDialog] = useState(false);
  const [testTemplate, setTestTemplate] = useState<EmailTemplate | null>(null);
  const [testEmail, setTestEmail] = useState("");
  const [testSending, setTestSending] = useState(false);

  // Preview (read-only)
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["admin-email-templates"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("email_templates").select("*").order("name");
      if (error) throw error;
      return data as EmailTemplate[];
    },
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-email-templates"] });

  // Categorise
  const byCategory = CATEGORIES.map((cat) => ({
    ...cat,
    templates: templates.filter((t) => getCategory(t.template_key) === cat.key),
  }));

  const toggleCat = (key: string) =>
    setOpenCategories((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const toggleActive = async (t: EmailTemplate) => {
    setTogglingId(t.id);
    const { error } = await (supabase as any)
      .from("email_templates").update({ is_active: !t.is_active }).eq("id", t.id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: t.is_active ? "Template disabled" : "Template enabled" }); refresh(); }
    setTogglingId(null);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete template "${name}"?`)) return;
    await (supabase as any).from("email_templates").delete().eq("id", id);
    refresh();
    toast({ title: "Template deleted" });
  };

  const handleSave = async () => {
    if (!form.template_key || !form.name || !form.subject || !form.html_body) {
      toast({ title: "Fill all required fields", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      template_key: form.template_key.trim().toLowerCase().replace(/\s+/g, "_"),
      name: form.name.trim(),
      subject: form.subject.trim(),
      html_body: form.html_body,
      text_body: form.text_body || null,
      description: form.description || null,
      is_active: form.is_active,
      updated_at: new Date().toISOString(),
    };
    const { error } = editingId
      ? await (supabase as any).from("email_templates").update(payload).eq("id", editingId)
      : await (supabase as any).from("email_templates").insert(payload);
    setSaving(false);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: editingId ? "Template updated" : "Template created" });
    refresh();
    setDialog(false);
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setEditorMode("source");
    setDialog(true);
  };

  const openEdit = (t: EmailTemplate) => {
    setEditingId(t.id);
    setForm({
      template_key: t.template_key, name: t.name, subject: t.subject,
      html_body: t.html_body, text_body: t.text_body || "",
      description: t.description || "", is_active: t.is_active,
    });
    setEditorMode("source");
    setDialog(true);
  };

  const sendTest = async () => {
    if (!testEmail || !testTemplate) {
      toast({ title: "Enter a test email address", variant: "destructive" });
      return;
    }
    setTestSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-smtp-email", {
        body: {
          to: testEmail,
          subject: `[TEST] ${testTemplate.subject}`,
          html: testTemplate.html_body,
          text: testTemplate.text_body || `Test email: ${testTemplate.name}`,
        },
      });
      if (error || !data?.success) throw new Error(error?.message || data?.error || "Failed");
      toast({ title: "✅ Test email sent!", description: `Sent to ${testEmail}` });
      setTestDialog(false);
    } catch (e: any) {
      toast({ title: "Failed to send", description: e.message, variant: "destructive" });
    } finally {
      setTestSending(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold font-display text-foreground">Email Templates</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Variables: <span className="font-mono">{"{{customer_name}}, {{order_id}}, {{total}}, {{status}}"}</span>
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={openCreate}>
          <Plus className="w-4 h-4" /> Add Template
        </Button>
      </div>

      {/* Stats */}
      <div className="bg-card rounded-xl border border-border p-4 mb-6 flex items-center gap-4">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Mail className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground font-medium">Email Templates</p>
          <p className="text-lg font-bold text-foreground">{templates.length} total</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-xs text-muted-foreground">Active</p>
          <p className="text-lg font-bold text-secondary">{templates.filter((t) => t.is_active).length}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Disabled</p>
          <p className="text-lg font-bold text-muted-foreground">{templates.filter((t) => !t.is_active).length}</p>
        </div>
      </div>

      {/* Category accordion */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
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
                  {isOpen
                    ? <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    : <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
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
                              {/* Preview */}
                              <button
                                onClick={() => setPreviewTemplate(t)}
                                className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              {/* Test send */}
                              <button
                                onClick={() => { setTestTemplate(t); setTestEmail(""); setTestDialog(true); }}
                                className="p-1.5 rounded-md hover:bg-secondary/10 text-muted-foreground hover:text-secondary transition-colors"
                              >
                                <TestTube className="w-3.5 h-3.5" />
                              </button>
                              {/* Edit */}
                              <button
                                onClick={() => openEdit(t)}
                                className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              {/* Delete */}
                              <button
                                onClick={() => handleDelete(t.id, t.name)}
                                className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Subject preview */}
                          <p className="text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded leading-relaxed">
                            <span className="text-muted-foreground/60 mr-1">Subject:</span>
                            {t.subject}
                          </p>

                          {/* Footer */}
                          {t.description && (
                            <p className="text-xs text-muted-foreground">{t.description}</p>
                          )}
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

      {/* ── Create / Edit Dialog ── */}
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Email Template" : "New Email Template"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Name *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Order Placed" />
              </div>
              <div>
                <Label>Template Key *</Label>
                <Input value={form.template_key} onChange={(e) => setForm({ ...form, template_key: e.target.value })} placeholder="e.g. order_placed" className="font-mono text-sm" />
              </div>
            </div>

            <div>
              <Label>Subject *</Label>
              <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="e.g. Your order #{{order_id}} has been placed" />
            </div>

            <div>
              <Label>Description</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Sent when a new order is placed" />
            </div>

            {/* Variable tokens */}
            <div>
              <Label>Quick Insert Variables</Label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {VARIABLE_TOKENS.map((v) => (
                  <button
                    key={v}
                    onClick={() => setForm((f) => ({ ...f, html_body: f.html_body + v }))}
                    className="text-xs bg-muted border border-border hover:bg-accent px-2 py-1 rounded font-mono transition-colors"
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {/* HTML editor */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label>HTML Body *</Label>
                <div className="flex gap-1">
                  <Button variant={editorMode === "source" ? "secondary" : "ghost"} size="sm" className="h-7 text-xs gap-1" onClick={() => setEditorMode("source")}>
                    <Code className="w-3 h-3" /> Source
                  </Button>
                  <Button variant={editorMode === "preview" ? "secondary" : "ghost"} size="sm" className="h-7 text-xs gap-1" onClick={() => setEditorMode("preview")}>
                    <Eye className="w-3 h-3" /> Preview
                  </Button>
                </div>
              </div>
              {editorMode === "source" ? (
                <Textarea
                  value={form.html_body}
                  onChange={(e) => setForm({ ...form, html_body: e.target.value })}
                  className="font-mono text-xs h-72 resize-none"
                  placeholder="Full HTML email body..."
                />
              ) : (
          <div className="border border-border rounded-md h-72 overflow-auto bg-background">
                  <iframe srcDoc={form.html_body} title="Preview" className="w-full h-full" sandbox="allow-same-origin" />
                </div>
              )}
            </div>

            <div>
              <Label>Plain Text <span className="text-xs text-muted-foreground">(optional fallback)</span></Label>
              <Textarea
                value={form.text_body}
                onChange={(e) => setForm({ ...form, text_body: e.target.value })}
                className="text-sm h-20 resize-none"
                placeholder="Plain text version..."
              />
            </div>

            <div className="flex items-center gap-3">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <Label className="cursor-pointer">Active</Label>
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setDialog(false)}>Cancel</Button>
              <Button className="flex-1" onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : editingId ? "Update Template" : "Create Template"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Preview Dialog (read-only) ── */}
      <Dialog open={!!previewTemplate} onOpenChange={(o) => { if (!o) setPreviewTemplate(null); }}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{previewTemplate?.name}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground mb-2">Subject: {previewTemplate?.subject}</p>
          <div className="border border-border rounded-md h-[60vh] overflow-auto bg-background">
            <iframe srcDoc={previewTemplate?.html_body || ""} title="Email Preview" className="w-full h-full" sandbox="allow-same-origin" />
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Test Send Dialog ── */}
      <Dialog open={testDialog} onOpenChange={setTestDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Send Test Email</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Sending test for: <strong>{testTemplate?.name}</strong>
          </p>
          <div className="space-y-3 pt-1">
            <div>
              <Label>Recipient Email *</Label>
              <Input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="test@example.com"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setTestDialog(false)}>Cancel</Button>
              <Button className="flex-1 gap-1.5" onClick={sendTest} disabled={testSending}>
                {testSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Send Test
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
