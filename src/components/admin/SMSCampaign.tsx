import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import {
  Send, Search, Users, Phone, X, Plus, Loader2, CheckCircle2,
  UserCheck, Filter, CreditCard, ChevronDown, ChevronUp,
} from "lucide-react";

// Sri Lanka districts
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

  // --- State ---
  const [message, setMessage] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState<string>("all");
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [sending, setSending] = useState(false);
  const [showUserList, setShowUserList] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");

  // SMS Balance
  const { data: smsBalance } = useQuery({
    queryKey: ["sms-balance"],
    queryFn: async () => {
      const { data } = await supabase.functions.invoke("sms-balance");
      return data;
    },
    staleTime: 2 * 60 * 1000,
  });

  // All registered users (profiles with phones)
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

  // Filtered user list based on search + district
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

  // Check if user is already in recipients
  const isAdded = (phone: string) => recipients.some((r) => r.phone === phone);

  // Add a single registered user
  const addUser = (p: typeof allProfiles[0]) => {
    if (!p.phone || isAdded(p.phone)) return;
    setRecipients((prev) => [
      ...prev,
      { phone: p.phone!, name: p.full_name || undefined, city: p.city || undefined, isRegistered: true },
    ]);
  };

  // Add all filtered users (bulk)
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

  // Add manual phone
  const addManualPhone = () => {
    const trimmed = manualPhone.trim().replace(/\s+/g, "");
    if (!trimmed) return;
    // Support comma-separated
    const nums = trimmed.split(",").map((n) => n.trim()).filter(Boolean);
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

  // Remove recipient
  const removeRecipient = (phone: string) => {
    setRecipients((prev) => prev.filter((r) => r.phone !== phone));
  };

  // Use template
  const applyTemplate = (templateId: string) => {
    const tmpl = smsTemplates.find((t) => t.id === templateId);
    if (tmpl) setMessage(tmpl.message_template);
    setSelectedTemplate(templateId);
  };

  // Send campaign
  const sendCampaign = async () => {
    if (!message.trim()) {
      toast({ title: "Enter a message", variant: "destructive" });
      return;
    }
    if (recipients.length === 0) {
      toast({ title: "Add at least one recipient", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const phones = recipients.map((r) => r.phone);
      const { data, error } = await supabase.functions.invoke("sms-campaign", {
        body: { phones, message: message.trim() },
      });
      if (error) throw error;
      if (data?.success) {
        toast({ title: `✅ Campaign sent to ${data.sent} / ${recipients.length} recipients!` });
        queryClient.invalidateQueries({ queryKey: ["admin-sms-logs"] });
        setRecipients([]);
        setMessage("");
        setSelectedTemplate("");
      } else {
        toast({ title: "Partial / failed send", description: data?.error || "Check SMS logs", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setSending(false);
  };

  const charCount = message.length;
  const smsCount = Math.ceil(charCount / 160) || 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold font-display text-foreground">SMS Campaign</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Send bulk SMS to registered users or custom numbers</p>
        </div>
        {/* Balance badge */}
        <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2">
          <CreditCard className="w-4 h-4 text-secondary" />
          <span className="text-xs text-muted-foreground">Balance:</span>
          <span className="text-sm font-bold text-foreground">
            {smsBalance?.balance !== undefined ? `Rs. ${Number(smsBalance.balance).toLocaleString()}` : "—"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* LEFT — Recipient Selector */}
        <div className="lg:col-span-2 space-y-4">
          {/* Registered Users Section */}
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
                {/* Filter Controls */}
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

                {/* District Filter */}
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

                {/* Add All Filtered */}
                <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs h-8" onClick={addAllFiltered}>
                  <UserCheck className="w-3.5 h-3.5" />
                  Add All Filtered ({filteredUsers.length})
                </Button>

                {/* User list */}
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
                          {isAdded(p.phone!) ? (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          ) : (
                            <Plus className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Manual Number Entry */}
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
                  <button
                    onClick={() => setRecipients([])}
                    className="text-xs text-destructive hover:underline"
                  >
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
            {smsTemplates.length > 0 && (
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Use a template (optional)</Label>
                <Select value={selectedTemplate} onValueChange={applyTemplate}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Pick a template…" />
                  </SelectTrigger>
                  <SelectContent>
                    {smsTemplates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        <span className="font-medium">{t.name}</span>
                        <span className="ml-2 text-muted-foreground font-mono text-xs">({t.template_key})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Message Body */}
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Message *</Label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your SMS message here…"
                className="min-h-[160px] text-sm font-mono"
              />
              <div className="flex items-center justify-between mt-1 text-xs text-muted-foreground">
                <span>
                  Placeholders: <span className="font-mono">{"{{customer_name}}"}</span>
                </span>
                <span className={charCount > 160 ? "text-destructive" : ""}>
                  {charCount} chars · {smsCount} SMS part{smsCount > 1 ? "s" : ""}
                </span>
              </div>
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

            {/* Send Button */}
            <Button
              className="w-full gap-2"
              onClick={sendCampaign}
              disabled={sending || recipients.length === 0 || !message.trim()}
            >
              {sending ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Sending Campaign…</>
              ) : (
                <><Send className="w-4 h-4" /> Send to {recipients.length} Recipient{recipients.length !== 1 ? "s" : ""}</>
              )}
            </Button>
          </div>

          {/* Preview */}
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
    </div>
  );
}
