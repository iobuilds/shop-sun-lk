import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import {
  Plus, Pencil, Trash2, Send, Mail, Eye, Code, Save,
  Loader2, ChevronDown, ChevronUp, TestTube, X,
} from "lucide-react";

// ── Variable help tokens ──────────────────────────────────────────────────────
const VARIABLE_TOKENS = [
  { token: "{{customer_name}}", desc: "Customer's full name" },
  { token: "{{order_id}}", desc: "Short order ID (8 chars)" },
  { token: "{{total}}", desc: "Order total (Rs.)" },
  { token: "{{payment_method}}", desc: "Payment method" },
  { token: "{{status}}", desc: "Order/request status" },
  { token: "{{tracking_number}}", desc: "Tracking number" },
  { token: "{{items}}", desc: "Item list summary" },
  { token: "{{site_name}}", desc: "Site name" },
];

interface EmailTemplate {
  id: string;
  template_key: string;
  name: string;
  subject: string;
  html_body: string;
  text_body: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

type PreviewMode = "html" | "source";

export default function EmailTemplatesManager() {
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("html");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null);
  const [testDialog, setTestDialog] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testTemplateName, setTestTemplateName] = useState("");
  const [testTemplateHtml, setTestTemplateHtml] = useState("");
  const [testTemplateSubject, setTestTemplateSubject] = useState("");
  const [testSending, setTestSending] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({ order: true, system: true });

  const [form, setForm] = useState({
    template_key: "",
    name: "",
    subject: "",
    html_body: "",
    text_body: "",
    description: "",
    is_active: true,
  });

  // Fetch templates from email_templates table
  const { data: templates, isLoading } = useQuery({
    queryKey: ["admin-email-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_templates" as any)
        .select("*")
        .order("name");
      if (error) throw error;
      return (data || []) as EmailTemplate[];
    },
  });

  const resetForm = () => {
    setForm({ template_key: "", name: "", subject: "", html_body: DEFAULT_HTML, text_body: "", description: "", is_active: true });
    setEditingId(null);
  };

  const openCreate = () => { resetForm(); setDialog(true); };

  const openEdit = (t: EmailTemplate) => {
    setForm({
      template_key: t.template_key,
      name: t.name,
      subject: t.subject,
      html_body: t.html_body,
      text_body: t.text_body || "",
      description: t.description || "",
      is_active: t.is_active,
    });
    setEditingId(t.id);
    setDialog(true);
  };

  const handleSave = async () => {
    if (!form.template_key || !form.name || !form.subject || !form.html_body) {
      toast({ title: "Required fields missing", description: "Key, name, subject and HTML body are required.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
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

      if (editingId) {
        const { error } = await (supabase as any).from("email_templates").update(payload).eq("id", editingId);
        if (error) throw error;
        toast({ title: "✅ Template updated" });
      } else {
        const { error } = await (supabase as any).from("email_templates").insert({ ...payload, created_at: new Date().toISOString() });
        if (error) throw error;
        toast({ title: "✅ Template created" });
      }
      queryClient.invalidateQueries({ queryKey: ["admin-email-templates"] });
      setDialog(false);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete template "${name}"?`)) return;
    const { error } = await (supabase as any).from("email_templates").delete().eq("id", id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Template deleted" });
    queryClient.invalidateQueries({ queryKey: ["admin-email-templates"] });
  };

  const handleToggleActive = async (t: EmailTemplate) => {
    await (supabase as any).from("email_templates").update({ is_active: !t.is_active }).eq("id", t.id);
    queryClient.invalidateQueries({ queryKey: ["admin-email-templates"] });
  };

  const handleTest = (t: EmailTemplate) => {
    setTestTemplateName(t.name);
    setTestTemplateHtml(t.html_body);
    setTestTemplateSubject(t.subject);
    setTestEmail("");
    setTestDialog(true);
  };

  const sendTest = async () => {
    if (!testEmail) { toast({ title: "Enter a test email address", variant: "destructive" }); return; }
    setTestSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-smtp-email", {
        body: {
          to: testEmail,
          subject: `[TEST] ${testTemplateSubject}`,
          html: testTemplateHtml.replace(/{{[\w_]+}}/g, (m) => `<span style="color:#888">${m}</span>`),
          text: `Test email for template: ${testTemplateName}`,
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

  const insertToken = (token: string) => {
    setForm((f) => ({ ...f, html_body: f.html_body + token }));
  };

  // Group templates
  const grouped = {
    order: templates?.filter((t) => t.template_key.startsWith("order_")) || [],
    system: templates?.filter((t) => !t.template_key.startsWith("order_")) || [],
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold font-display text-foreground">Email Templates</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Design and manage HTML email templates sent via SMTP</p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={openCreate}>
          <Plus className="w-4 h-4" /> New Template
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: "Total Templates", value: templates?.length || 0, color: "text-blue-600" },
          { label: "Active", value: templates?.filter((t) => t.is_active).length || 0, color: "text-emerald-600" },
          { label: "Inactive", value: templates?.filter((t) => !t.is_active).length || 0, color: "text-muted-foreground" },
        ].map((s) => (
          <div key={s.label} className="bg-muted/40 border border-border rounded-lg px-4 py-3">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Template groups */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : !templates?.length ? (
        <div className="text-center py-16 text-muted-foreground border-2 border-dashed border-border rounded-xl">
          <Mail className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No email templates yet</p>
          <p className="text-sm mt-1">Click "New Template" to create your first one</p>
        </div>
      ) : (
        <div className="space-y-4">
          {[
            { key: "order", label: "Order Templates", items: grouped.order },
            { key: "system", label: "System / Other", items: grouped.system },
          ].map((group) => group.items.length === 0 ? null : (
            <div key={group.key} className="border border-border rounded-xl overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors"
                onClick={() => setExpandedGroups((e) => ({ ...e, [group.key]: !e[group.key] }))}
              >
                <span className="font-semibold text-sm text-foreground">{group.label} <span className="text-muted-foreground font-normal">({group.items.length})</span></span>
                {expandedGroups[group.key] ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </button>
              {expandedGroups[group.key] && (
                <div className="divide-y divide-border">
                  {group.items.map((t) => (
                    <div key={t.id} className="flex items-start gap-3 px-4 py-3 hover:bg-muted/20 transition-colors">
                      <div className="mt-0.5">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center border border-blue-200">
                          <Mail className="w-4 h-4 text-blue-600" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm text-foreground">{t.name}</span>
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{t.template_key}</code>
                          <Badge variant={t.is_active ? "default" : "secondary"} className="text-xs h-4">
                            {t.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">Subject: {t.subject}</p>
                        {t.description && <p className="text-xs text-muted-foreground/70 mt-0.5 truncate">{t.description}</p>}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Switch
                          checked={t.is_active}
                          onCheckedChange={() => handleToggleActive(t)}
                          className="scale-75"
                        />
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setPreviewTemplate(t); setPreviewOpen(true); }}>
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleTest(t)}>
                          <TestTube className="w-3.5 h-3.5 text-emerald-600" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(t)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(t.id, t.name)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Create / Edit Dialog ── */}
      <Dialog open={dialog} onOpenChange={(o) => { if (!o) setDialog(false); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Email Template" : "New Email Template"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Template Key <span className="text-destructive">*</span></Label>
                <Input placeholder="e.g. order_shipped" value={form.template_key} onChange={(e) => setForm((f) => ({ ...f, template_key: e.target.value }))} className="font-mono text-sm" />
                <p className="text-xs text-muted-foreground">Unique identifier used in code</p>
              </div>
              <div className="space-y-1.5">
                <Label>Template Name <span className="text-destructive">*</span></Label>
                <Input placeholder="e.g. Order Shipped Notification" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Email Subject <span className="text-destructive">*</span></Label>
              <Input placeholder="e.g. Your order #{{order_id}} has shipped!" value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} />
            </div>

            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input placeholder="Optional description of when this email is sent" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>

            {/* Variable tokens helper */}
            <div className="space-y-1.5">
              <Label>Quick Insert Variables</Label>
              <div className="flex flex-wrap gap-1.5">
                {VARIABLE_TOKENS.map((v) => (
                  <button
                    key={v.token}
                    title={v.desc}
                    onClick={() => insertToken(v.token)}
                    className="text-xs bg-muted border border-border hover:bg-accent px-2 py-1 rounded font-mono transition-colors"
                  >
                    {v.token}
                  </button>
                ))}
              </div>
            </div>

            {/* HTML body editor with preview toggle */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>HTML Body <span className="text-destructive">*</span></Label>
                <div className="flex gap-1">
                  <Button variant={previewMode === "source" ? "secondary" : "ghost"} size="sm" className="h-7 text-xs gap-1" onClick={() => setPreviewMode("source")}>
                    <Code className="w-3.5 h-3.5" /> Source
                  </Button>
                  <Button variant={previewMode === "html" ? "secondary" : "ghost"} size="sm" className="h-7 text-xs gap-1" onClick={() => setPreviewMode("html")}>
                    <Eye className="w-3.5 h-3.5" /> Preview
                  </Button>
                </div>
              </div>
              {previewMode === "source" ? (
                <Textarea
                  value={form.html_body}
                  onChange={(e) => setForm((f) => ({ ...f, html_body: e.target.value }))}
                  className="font-mono text-xs h-72 resize-none"
                  placeholder="Enter full HTML email body..."
                />
              ) : (
                <div className="border border-border rounded-md h-72 overflow-auto bg-white">
                  <iframe
                    srcDoc={form.html_body}
                    title="Email Preview"
                    className="w-full h-full"
                    sandbox="allow-same-origin"
                  />
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Plain Text Body <span className="text-muted-foreground text-xs">(optional fallback)</span></Label>
              <Textarea
                value={form.text_body}
                onChange={(e) => setForm((f) => ({ ...f, text_body: e.target.value }))}
                className="text-sm h-20 resize-none"
                placeholder="Plain text version for email clients that don't support HTML..."
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))} />
              <Label>Active</Label>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button variant="outline" onClick={() => setDialog(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving} className="gap-1.5">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {editingId ? "Save Changes" : "Create Template"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Preview Dialog ── */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-4 h-4" /> Preview: {previewTemplate?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground border-b border-border pb-2 mb-2">
            <span className="font-medium">Subject:</span> {previewTemplate?.subject}
          </div>
          <div className="flex-1 overflow-auto border border-border rounded-lg bg-white min-h-0">
            {previewTemplate && (
              <iframe
                srcDoc={previewTemplate.html_body}
                title="Preview"
                className="w-full h-full min-h-[500px]"
                sandbox="allow-same-origin"
              />
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => { if (previewTemplate) handleTest(previewTemplate); setPreviewOpen(false); }} className="gap-1.5">
              <TestTube className="w-4 h-4" /> Send Test
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPreviewOpen(false)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Test Send Dialog ── */}
      <Dialog open={testDialog} onOpenChange={setTestDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TestTube className="w-4 h-4 text-emerald-600" /> Send Test Email
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="bg-muted/50 rounded-lg px-3 py-2 text-sm">
              <span className="text-muted-foreground">Template: </span>
              <span className="font-medium">{testTemplateName}</span>
            </div>
            <div className="space-y-1.5">
              <Label>Send test to</Label>
              <Input
                type="email"
                placeholder="test@example.com"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendTest()}
              />
              <p className="text-xs text-muted-foreground">Variables will be shown as-is in the test email.</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setTestDialog(false)}>Cancel</Button>
              <Button size="sm" onClick={sendTest} disabled={testSending} className="gap-1.5">
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

// ── Default HTML template ─────────────────────────────────────────────────────
const DEFAULT_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 30px auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header { background: #1a1a2e; color: #fff; padding: 24px 32px; }
    .header h1 { margin: 0; font-size: 20px; }
    .body { padding: 24px 32px; color: #333; line-height: 1.6; }
    .cta { text-align: center; margin: 24px 0; }
    .cta a { background: #1a1a2e; color: #fff; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: bold; }
    .footer { background: #f0f0f0; padding: 16px 32px; text-align: center; font-size: 12px; color: #888; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>NanoCircuit.lk</h1>
    </div>
    <div class="body">
      <p>Hi {{customer_name}},</p>
      <p>Your message here.</p>
      <div class="cta">
        <a href="https://shop-sun-lk.lovable.app">Visit Store</a>
      </div>
    </div>
    <div class="footer">NanoCircuit.lk &mdash; Automated notification</div>
  </div>
</body>
</html>`;
