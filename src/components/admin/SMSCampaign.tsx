import { useState, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
  Send, Search, Users, Phone, X, Plus, Loader2, CheckCircle2,
  UserCheck, Filter, CreditCard, ChevronDown, ChevronUp, Clock,
  History, CalendarDays, Trash2, Ban, RefreshCw, AlertCircle,
} from "lucide-react";

// All available placeholders for SMS campaigns
const ALL_PLACEHOLDERS = [
  { key: "{{customer_name}}", label: "Customer Name" },
  { key: "{{order_id}}", label: "Order ID" },
  { key: "{{total}}", label: "Total" },
  { key: "{{status}}", label: "Status" },
  { key: "{{tracking_number}}", label: "Tracking No." },
  { key: "{{tracking_link}}", label: "Tracking Link" },
  { key: "{{courier_name}}", label: "Courier" },
  { key: "{{expected_delivery}}", label: "Delivery Date" },
  { key: "{{phone}}", label: "Phone" },
  { key: "{{shop_name}}", label: "Shop Name" },
  { key: "{{OTP5}}", label: "OTP (5-digit)" },
];

const SL_DISTRICTS = [
  "Colombo", "Gampaha", "Kalutara", "Kandy", "Matale", "Nuwara Eliya",
  "Galle", "Matara", "Hambantota", "Jaffna", "Kilinochchi", "Mannar",
  "Vavuniya", "Mullaitivu", "Batticaloa", "Ampara", "Trincomalee",
  "Kurunegala", "Puttalam", "Anuradhapura", "Polonnaruwa", "Badulla",
  "Monaragala", "Ratnapura", "Kegalle",
];

interface Recipient {
  phone: string;
  name?: string;
  city?: string;
  isRegistered: boolean;
}

export default function SMSCampaign() {
  const queryClient = useQueryClient();

  // Compose state
  const [message, setMessage] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState<string>("all");
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [sending, setSending] = useState(false);
  const [showUserList, setShowUserList] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("none");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Schedule state
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");

  // History clear state
  const [clearingHistory, setClearingHistory] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // SMS Balance
  const { data: smsBalance } = useQuery({
    queryKey: ["sms-balance"],
    queryFn: async () => {
      const { data } = await supabase.functions.invoke("sms-balance");
      return data;
    },
    staleTime: 2 * 60 * 1000,
  });

  // All registered users
  const { data: allProfiles = [] } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("user_id,full_name,phone,city").not("phone", "is", null);
      if (error) throw error;
      return data as { user_id: string; full_name: string | null; phone: string | null; city: string | null }[];
    },
  });

  // SMS Templates
  const { data: smsTemplates = [] } = useQuery({
    queryKey: ["admin-sms-templates"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("sms_templates").select("*").eq("is_active", true).order("name");
      if (error) throw error;
      return data as any[];
    },
  });

  // SMS Logs history
  const { data: smsLogs = [], isLoading: logsLoading, refetch: refetchLogs } = useQuery({
    queryKey: ["admin-sms-logs"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("sms_logs")
        .select("*")
        .eq("template_key", "campaign")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as any[];
    },
  });

  // Scheduled campaigns
  const { data: scheduledCampaigns = [], isLoading: scheduledLoading, refetch: refetchScheduled } = useQuery({
    queryKey: ["admin-scheduled-campaigns"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("sms_scheduled_campaigns")
        .select("*")
        .order("scheduled_at", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });

  // Filter users
  const filteredUsers = useMemo(() => {
    return allProfiles.filter((p) => {
      const q = userSearch.toLowerCase();
      const matchSearch =
        !q ||
        (p.full_name || "").toLowerCase().includes(q) ||
        (p.phone || "").includes(q) ||
        (p.city || "").toLowerCase().includes(q);
      const matchDistrict =
        selectedDistrict === "all" ||
        (p.city || "").toLowerCase() === selectedDistrict.toLowerCase();
      return matchSearch && matchDistrict;
    });
  }, [allProfiles, userSearch, selectedDistrict]);

  const isAdded = (phone: string) => recipients.some((r) => r.phone === phone);

  const addUser = (p: typeof allProfiles[0]) => {
    if (!p.phone || isAdded(p.phone)) return;
    setRecipients((prev) => [
      ...prev,
      { phone: p.phone!, name: p.full_name || undefined, city: p.city || undefined, isRegistered: true },
    ]);
  };

  const addAllFiltered = () => {
    const newOnes: Recipient[] = filteredUsers
      .filter((p) => p.phone && !isAdded(p.phone))
      .map((p) => ({ phone: p.phone!, name: p.full_name || undefined, city: p.city || undefined, isRegistered: true }));
    if (newOnes.length === 0) {
      toast({ title: "All users already added or no phone numbers available." });
      return;
    }
    setRecipients((prev) => [...prev, ...newOnes]);
    toast({ title: `Added ${newOnes.length} recipients` });
  };

  const normalizePhone = (raw: string) => {
    const digits = raw.replace(/\D/g, "");
    if (digits.startsWith("0") && digits.length === 10) return "94" + digits.slice(1);
    return digits || raw;
  };

  const addManualPhone = () => {
    const trimmed = manualPhone.trim().replace(/\s+/g, "");
    if (!trimmed) return;
    const nums = trimmed.split(",").map((n) => normalizePhone(n.trim())).filter(Boolean);
    const added: string[] = [];
    nums.forEach((num) => {
      if (!isAdded(num)) {
        setRecipients((prev) => [...prev, { phone: num, isRegistered: false }]);
        added.push(num);
      }
    });
    if (added.length > 0) {
      toast({ title: `Added ${added.length} number(s)` });
      setManualPhone("");
    } else {
      toast({ title: "Already added", variant: "destructive" });
    }
  };

  const removeRecipient = (phone: string) => {
    setRecipients((prev) => prev.filter((r) => r.phone !== phone));
  };

  const applyTemplate = (templateId: string) => {
    if (templateId === "none") {
      setMessage("");
      setSelectedTemplate("none");
      return;
    }
    const tmpl = smsTemplates.find((t) => t.id === templateId);
    if (tmpl) setMessage(tmpl.message_template);
    setSelectedTemplate(templateId);
  };

  // Send or schedule campaign
  const sendCampaign = async () => {
    if (!message.trim()) {
      toast({ title: "Enter a message", variant: "destructive" });
      return;
    }
    if (recipients.length === 0) {
      toast({ title: "Add at least one recipient", variant: "destructive" });
      return;
    }
    if (scheduleEnabled && !scheduledAt) {
      toast({ title: "Pick a scheduled date & time", variant: "destructive" });
      return;
    }

    setSending(true);
    try {
      const phones = recipients.map((r) => r.phone);

      if (scheduleEnabled) {
        // Save to sms_scheduled_campaigns
        const { error } = await (supabase as any).from("sms_scheduled_campaigns").insert({
          phones,
          message: message.trim(),
          scheduled_at: new Date(scheduledAt).toISOString(),
          recipient_count: phones.length,
          status: "scheduled",
        });
        if (error) throw error;
        toast({ title: `📅 Campaign scheduled for ${format(new Date(scheduledAt), "dd MMM yyyy HH:mm")}` });
        queryClient.invalidateQueries({ queryKey: ["admin-scheduled-campaigns"] });
        setRecipients([]);
        setMessage("");
        setSelectedTemplate("none");
        setScheduledAt("");
        setScheduleEnabled(false);
      } else {
        const { data, error } = await supabase.functions.invoke("sms-campaign", {
          body: { phones, message: message.trim() },
        });
        if (error) throw error;
        if (data?.success) {
          toast({ title: `✅ Campaign sent to ${data.sent} / ${recipients.length} recipients!` });
          queryClient.invalidateQueries({ queryKey: ["admin-sms-logs"] });
          setRecipients([]);
          setMessage("");
          setSelectedTemplate("none");
        } else {
          toast({ title: "Partial / failed send", description: data?.error || "Check SMS logs", variant: "destructive" });
        }
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setSending(false);
  };

  // Cancel a scheduled campaign
  const cancelScheduled = async (id: string) => {
    setCancellingId(id);
    try {
      const { error } = await (supabase as any)
        .from("sms_scheduled_campaigns")
        .update({ status: "cancelled" })
        .eq("id", id);
      if (error) throw error;
      toast({ title: "Scheduled campaign cancelled" });
      refetchScheduled();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setCancellingId(null);
  };

  // Clear campaign SMS history
  const clearHistory = async () => {
    setClearingHistory(true);
    try {
      const { error } = await (supabase as any)
        .from("sms_logs")
        .delete()
        .eq("template_key", "campaign");
      if (error) throw error;
      toast({ title: "SMS campaign history cleared" });
      refetchLogs();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setClearingHistory(false);
  };

  const charCount = message.length;
  const smsCount = Math.ceil(charCount / 160) || 1;

  const pendingScheduled = scheduledCampaigns.filter((c) => c.status === "scheduled");
  const pastScheduled = scheduledCampaigns.filter((c) => c.status !== "scheduled");

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold font-display text-foreground">SMS Campaign</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Send bulk SMS to registered users or custom numbers</p>
        </div>
        <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2">
          <CreditCard className="w-4 h-4 text-secondary" />
          <span className="text-xs text-muted-foreground">Balance:</span>
          <span className="text-sm font-bold text-foreground">
            {smsBalance?.balance !== undefined ? `Rs. ${Number(smsBalance.balance).toLocaleString()}` : "—"}
          </span>
        </div>
      </div>

      <Tabs defaultValue="compose">
        <TabsList className="h-9">
          <TabsTrigger value="compose" className="text-xs gap-1.5"><Send className="w-3.5 h-3.5" />Compose</TabsTrigger>
          <TabsTrigger value="scheduled" className="text-xs gap-1.5 relative">
            <CalendarDays className="w-3.5 h-3.5" />Scheduled
            {pendingScheduled.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
                {pendingScheduled.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="history" className="text-xs gap-1.5"><History className="w-3.5 h-3.5" />History</TabsTrigger>
        </TabsList>

        {/* ─── COMPOSE TAB ─── */}
        <TabsContent value="compose" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
            {/* LEFT — Recipient Selector */}
            <div className="lg:col-span-2 space-y-4">
              {/* Registered Users */}
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <button
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors text-left"
                  onClick={() => setShowUserList((v) => !v)}
                >
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Users className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold text-foreground">Registered Users</span>
                    <span className="text-xs text-muted-foreground ml-2">{allProfiles.length} with phone</span>
                  </div>
                  {showUserList ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </button>

                {showUserList && (
                  <div className="border-t border-border p-3 space-y-3">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <Input
                          placeholder="Search name / phone / city…"
                          value={userSearch}
                          onChange={(e) => setUserSearch(e.target.value)}
                          className="h-8 text-xs pl-8"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Filter className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                      <Select value={selectedDistrict} onValueChange={setSelectedDistrict}>
                        <SelectTrigger className="h-8 text-xs flex-1">
                          <SelectValue placeholder="Filter by district" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Districts</SelectItem>
                          {SL_DISTRICTS.map((d) => (
                            <SelectItem key={d} value={d}>{d}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs h-8" onClick={addAllFiltered}>
                      <UserCheck className="w-3.5 h-3.5" />
                      Add All Filtered ({filteredUsers.length})
                    </Button>
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {filteredUsers.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-4">No users match</p>
                      ) : (
                        filteredUsers.map((p) => (
                          <div key={p.user_id} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-md hover:bg-muted/50 text-sm">
                            <div className="min-w-0 flex-1">
                              <div className="font-medium text-xs text-foreground truncate">{p.full_name || "Unknown"}</div>
                              <div className="font-mono text-xs text-muted-foreground">{p.phone}</div>
                              {p.city && <div className="text-xs text-muted-foreground">{p.city}</div>}
                            </div>
                            <button
                              onClick={() => addUser(p)}
                              disabled={isAdded(p.phone!)}
                              className={`p-1.5 rounded-md transition-colors flex-shrink-0 ${
                                isAdded(p.phone!)
                                  ? "text-secondary bg-secondary/10 cursor-default"
                                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
                              }`}
                            >
                              {isAdded(p.phone!) ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Manual Numbers */}
              <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-semibold text-foreground">Manual / Unregistered Numbers</span>
                </div>
                <div className="flex gap-2">
                  <Input
                    value={manualPhone}
                    onChange={(e) => setManualPhone(e.target.value)}
                    placeholder="94710000000 or comma-separated"
                    className="text-xs font-mono flex-1"
                    onKeyDown={(e) => { if (e.key === "Enter") addManualPhone(); }}
                  />
                  <Button size="sm" variant="outline" onClick={addManualPhone} disabled={!manualPhone.trim()}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Enter multiple numbers separated by commas</p>
              </div>

              {/* Recipients List */}
              <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Send className="w-4 h-4 text-muted-foreground" />
                    Recipients
                  </span>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">{recipients.length}</Badge>
                    {recipients.length > 0 && (
                      <button onClick={() => setRecipients([])} className="text-xs text-destructive hover:underline">
                        Clear all
                      </button>
                    )}
                  </div>
                </div>
                {recipients.length === 0 ? (
                  <div className="text-center py-6 text-xs text-muted-foreground">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    No recipients yet
                  </div>
                ) : (
                  <div className="max-h-56 overflow-y-auto space-y-1">
                    {recipients.map((r) => (
                      <div key={r.phone} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-md bg-muted/30 text-xs">
                        <div className="min-w-0 flex-1">
                          <span className="font-mono text-foreground">{r.phone}</span>
                          {r.name && <span className="text-muted-foreground ml-1.5">({r.name})</span>}
                          {!r.isRegistered && (
                            <Badge variant="outline" className="ml-1.5 text-[10px] h-4 px-1">Manual</Badge>
                          )}
                        </div>
                        <button
                          onClick={() => removeRecipient(r.phone)}
                          className="p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT — Message Composer */}
            <div className="lg:col-span-3 space-y-4">
              <div className="bg-card border border-border rounded-xl p-5 space-y-4">
                <h3 className="text-sm font-semibold text-foreground">Compose Message</h3>

                {/* Template Picker */}
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Use a template (optional)</Label>
                  <Select value={selectedTemplate} onValueChange={applyTemplate}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Pick a template…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— No Template —</SelectItem>
                      {smsTemplates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          <span className="font-medium">{t.name}</span>
                          <span className="ml-2 text-muted-foreground font-mono text-xs">({t.template_key})</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Message Body */}
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Message *</Label>
                  <Textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Type your SMS message here…"
                    className="min-h-[140px] text-sm font-mono"
                  />
                  <div className="flex items-center justify-between mt-1 text-xs text-muted-foreground">
                    <span>Placeholders: <span className="font-mono">{"{{customer_name}}"}</span></span>
                    <span className={charCount > 160 ? "text-destructive" : ""}>
                      {charCount} chars · {smsCount} SMS part{smsCount > 1 ? "s" : ""}
                    </span>
                  </div>
                </div>

                {/* Schedule Toggle */}
                <div className="border border-border rounded-lg p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground">Schedule for later</span>
                    </div>
                    <button
                      onClick={() => { setScheduleEnabled((v) => !v); if (scheduleEnabled) setScheduledAt(""); }}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${scheduleEnabled ? "bg-primary" : "bg-muted"}`}
                    >
                      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${scheduleEnabled ? "translate-x-4" : "translate-x-0.5"}`} />
                    </button>
                  </div>
                  {scheduleEnabled && (
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">Scheduled date & time</Label>
                      <Input
                        type="datetime-local"
                        value={scheduledAt}
                        onChange={(e) => setScheduledAt(e.target.value)}
                        min={new Date().toISOString().slice(0, 16)}
                        className="h-9 text-sm"
                      />
                    </div>
                  )}
                </div>

                {/* Campaign Summary */}
                <div className="bg-muted/40 rounded-lg p-3 grid grid-cols-3 gap-3 text-center text-xs">
                  <div>
                    <div className="font-bold text-lg text-foreground">{recipients.length}</div>
                    <div className="text-muted-foreground">Recipients</div>
                  </div>
                  <div>
                    <div className="font-bold text-lg text-foreground">{smsCount}</div>
                    <div className="text-muted-foreground">SMS Parts</div>
                  </div>
                  <div>
                    <div className="font-bold text-lg text-foreground">{recipients.length * smsCount}</div>
                    <div className="text-muted-foreground">Total SMS</div>
                  </div>
                </div>

                {/* Send / Schedule Button */}
                <Button
                  className="w-full gap-2"
                  onClick={sendCampaign}
                  disabled={sending || recipients.length === 0 || !message.trim()}
                >
                  {sending ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> {scheduleEnabled ? "Scheduling…" : "Sending Campaign…"}</>
                  ) : scheduleEnabled ? (
                    <><CalendarDays className="w-4 h-4" /> Schedule Campaign ({recipients.length} recipient{recipients.length !== 1 ? "s" : ""})</>
                  ) : (
                    <><Send className="w-4 h-4" /> Send to {recipients.length} Recipient{recipients.length !== 1 ? "s" : ""}</>
                  )}
                </Button>
              </div>

              {/* Message Preview */}
              {message.trim() && (
                <div className="bg-card border border-border rounded-xl p-4 space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Message Preview</h4>
                  <div className="bg-muted/60 rounded-lg p-3 text-sm font-mono leading-relaxed text-foreground whitespace-pre-wrap">
                    {message}
                  </div>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ─── SCHEDULED TAB ─── */}
        <TabsContent value="scheduled" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Scheduled Campaigns</h3>
            <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => refetchScheduled()}>
              <RefreshCw className="w-3.5 h-3.5" />Refresh
            </Button>
          </div>

          {scheduledLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />Loading…
            </div>
          ) : scheduledCampaigns.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CalendarDays className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No scheduled campaigns</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingScheduled.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Pending</p>
                  <div className="space-y-2">
                    {pendingScheduled.map((c) => (
                      <div key={c.id} className="bg-card border border-border rounded-xl p-4 flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge className="text-[10px] h-5 bg-primary/10 text-primary border-primary/20">Scheduled</Badge>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {format(new Date(c.scheduled_at), "dd MMM yyyy, HH:mm")}
                            </span>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Users className="w-3 h-3" />{c.recipient_count} recipients
                            </span>
                          </div>
                          <p className="text-sm text-foreground line-clamp-2 font-mono">{c.message}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-8 gap-1.5 text-xs flex-shrink-0"
                          disabled={cancellingId === c.id}
                          onClick={() => cancelScheduled(c.id)}
                        >
                          {cancellingId === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />}
                          Cancel
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {pastScheduled.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 mt-4">Past</p>
                  <div className="space-y-2">
                    {pastScheduled.map((c) => (
                      <div key={c.id} className="bg-card border border-border rounded-xl p-4 flex items-start gap-4 opacity-70">
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant={c.status === "sent" ? "default" : "destructive"} className="text-[10px] h-5">
                              {c.status}
                            </Badge>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {format(new Date(c.scheduled_at), "dd MMM yyyy, HH:mm")}
                            </span>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Users className="w-3 h-3" />{c.recipient_count} recipients
                            </span>
                          </div>
                          <p className="text-sm text-foreground line-clamp-1 font-mono">{c.message}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* ─── HISTORY TAB ─── */}
        <TabsContent value="history" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Send History</h3>
              <p className="text-xs text-muted-foreground">{smsLogs.length} campaign SMS entries</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => refetchLogs()}>
                <RefreshCw className="w-3.5 h-3.5" />Refresh
              </Button>
              {smsLogs.length > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  disabled={clearingHistory}
                  onClick={clearHistory}
                >
                  {clearingHistory ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  Clear History
                </Button>
              )}
            </div>
          </div>

          {logsLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />Loading…
            </div>
          ) : smsLogs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <History className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No campaign history yet</p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="border-b border-border bg-muted/40">
                    <tr>
                      <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Phone</th>
                      <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Message</th>
                      <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Status</th>
                      <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Sent At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {smsLogs.map((log: any) => (
                      <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-2.5 font-mono text-foreground">{log.phone}</td>
                        <td className="px-4 py-2.5 text-muted-foreground max-w-xs truncate">{log.message}</td>
                        <td className="px-4 py-2.5">
                          {log.status === "sent" ? (
                            <span className="inline-flex items-center gap-1 text-secondary">
                              <CheckCircle2 className="w-3.5 h-3.5" /> sent
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-destructive">
                              <AlertCircle className="w-3.5 h-3.5" /> {log.status}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
                          {format(new Date(log.created_at), "dd MMM yy, HH:mm")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
