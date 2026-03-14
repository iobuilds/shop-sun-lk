import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Lock, AlertTriangle, Clock, Globe, Eye, EyeOff, Loader2, ShieldAlert } from "lucide-react";

interface SiteModeSettings {
  coming_soon_enabled: boolean;
  maintenance_enabled: boolean;
  coming_soon_title: string;
  coming_soon_subtitle: string;
  maintenance_title: string;
  maintenance_message: string;
}

const DEFAULT_SETTINGS: SiteModeSettings = {
  coming_soon_enabled: false,
  maintenance_enabled: false,
  coming_soon_title: "Coming Soon",
  coming_soon_subtitle: "We're working on something amazing. Stay tuned!",
  maintenance_title: "Site Under Maintenance",
  maintenance_message: "We're performing scheduled maintenance. We'll be back shortly. For urgent inquiries, please contact us.",
};

export default function SiteModesManager() {
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<SiteModeSettings>(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);

  // Password confirm dialog
  const [pwDialog, setPwDialog] = useState(false);
  const [pwInput, setPwInput] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [pendingChange, setPendingChange] = useState<{ field: keyof SiteModeSettings; value: boolean } | null>(null);

  const { data: rawSettings, isLoading } = useQuery({
    queryKey: ["site-modes-settings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("site_settings" as any)
        .select("value")
        .eq("key", "site_modes")
        .maybeSingle();
      return (data as any)?.value as SiteModeSettings | null;
    },
  });

  useEffect(() => {
    if (rawSettings) {
      setSettings({ ...DEFAULT_SETTINGS, ...rawSettings });
    }
  }, [rawSettings]);

  const saveSettings = async (updated: SiteModeSettings) => {
    setSaving(true);
    const { error } = await (supabase as any)
      .from("site_settings")
      .upsert({ key: "site_modes", value: updated, updated_at: new Date().toISOString() }, { onConflict: "key" });
    setSaving(false);
    if (error) {
      toast({ title: "Error saving", description: error.message, variant: "destructive" });
    } else {
      queryClient.invalidateQueries({ queryKey: ["site-modes-settings"] });
      queryClient.invalidateQueries({ queryKey: ["public-site-modes"] });
      toast({ title: "Settings saved" });
    }
  };

  // Toggle requires password confirmation
  const requestToggle = (field: "coming_soon_enabled" | "maintenance_enabled", value: boolean) => {
    setPendingChange({ field, value });
    setPwInput("");
    setPwDialog(true);
  };

  const confirmToggle = async () => {
    if (!pendingChange) return;
    setPwLoading(true);
    // Re-authenticate with current session email
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.email) {
      setPwLoading(false);
      toast({ title: "No session found", variant: "destructive" });
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({
      email: session.user.email,
      password: pwInput,
    });
    setPwLoading(false);
    if (error) {
      toast({ title: "Incorrect password", description: "Please try again.", variant: "destructive" });
      return;
    }
    // Password correct — apply the toggle
    const updated = { ...settings, [pendingChange.field]: pendingChange.value };
    // If turning on one, auto-turn off the other (can't have both)
    if (pendingChange.field === "coming_soon_enabled" && pendingChange.value) {
      updated.maintenance_enabled = false;
    }
    if (pendingChange.field === "maintenance_enabled" && pendingChange.value) {
      updated.coming_soon_enabled = false;
    }
    setSettings(updated);
    await saveSettings(updated);
    setPwDialog(false);
    setPwInput("");
    setPendingChange(null);
  };

  const saveText = async () => {
    await saveSettings(settings);
  };

  const modeStatus = settings.coming_soon_enabled
    ? "coming_soon"
    : settings.maintenance_enabled
    ? "maintenance"
    : "live";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Banner */}
      <div className={`rounded-xl border-2 p-4 flex items-center gap-4 ${
        modeStatus === "live"
          ? "border-secondary/50 bg-secondary/5"
          : modeStatus === "coming_soon"
          ? "border-accent/50 bg-accent/5"
          : "border-destructive/50 bg-destructive/5"
      }`}>
        <div className={`w-3 h-3 rounded-full animate-pulse ${
          modeStatus === "live" ? "bg-secondary" : modeStatus === "coming_soon" ? "bg-accent" : "bg-destructive"
        }`} />
        <div className="flex-1">
          <p className="font-semibold text-foreground">
            Site is currently:{" "}
            <span className={
              modeStatus === "live" ? "text-secondary" : modeStatus === "coming_soon" ? "text-accent" : "text-destructive"
            }>
              {modeStatus === "live" ? "🟢 LIVE" : modeStatus === "coming_soon" ? "🕐 Coming Soon" : "🔧 Maintenance"}
            </span>
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {modeStatus === "live"
              ? "All visitors can access the site normally."
              : modeStatus === "coming_soon"
              ? "Public visitors see the Coming Soon page. Staff/admin can still access everything."
              : "Public visitors see the Maintenance page. Staff/admin can still access everything."}
          </p>
        </div>
        <Badge variant={modeStatus === "live" ? "secondary" : modeStatus === "coming_soon" ? "outline" : "destructive"}>
          {modeStatus === "live" ? "Live" : modeStatus === "coming_soon" ? "Coming Soon" : "Maintenance"}
        </Badge>
      </div>

      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
        <Lock className="w-3.5 h-3.5" />
        Toggling these modes requires admin password confirmation. Both cannot be active simultaneously — enabling one will disable the other.
      </p>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Coming Soon */}
        <div className={`rounded-xl border-2 p-5 space-y-4 transition-colors ${
          settings.coming_soon_enabled ? "border-accent/60 bg-accent/5" : "border-border"
        }`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                settings.coming_soon_enabled ? "bg-accent/20" : "bg-muted"
              }`}>
                <Clock className={`w-5 h-5 ${settings.coming_soon_enabled ? "text-accent" : "text-muted-foreground"}`} />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Coming Soon Page</h3>
                <p className="text-xs text-muted-foreground">Show a teaser page before launch</p>
              </div>
            </div>
            <Switch
              checked={settings.coming_soon_enabled}
              onCheckedChange={(v) => requestToggle("coming_soon_enabled", v)}
            />
          </div>

          <div className="space-y-3">
            <div>
              <Label className="text-xs">Page Title</Label>
              <Input
                value={settings.coming_soon_title}
                onChange={(e) => setSettings({ ...settings, coming_soon_title: e.target.value })}
                placeholder="Coming Soon"
                className="mt-1 h-9"
              />
            </div>
            <div>
              <Label className="text-xs">Subtitle / Message</Label>
              <Input
                value={settings.coming_soon_subtitle}
                onChange={(e) => setSettings({ ...settings, coming_soon_subtitle: e.target.value })}
                placeholder="We're working on something amazing..."
                className="mt-1 h-9"
              />
            </div>
          </div>
        </div>

        {/* Maintenance Mode */}
        <div className={`rounded-xl border-2 p-5 space-y-4 transition-colors ${
          settings.maintenance_enabled ? "border-destructive/60 bg-destructive/5" : "border-border"
        }`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                settings.maintenance_enabled ? "bg-destructive/20" : "bg-muted"
              }`}>
                <ShieldAlert className={`w-5 h-5 ${settings.maintenance_enabled ? "text-destructive" : "text-muted-foreground"}`} />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Maintenance Mode</h3>
                <p className="text-xs text-muted-foreground">For urgent downtime with contact info</p>
              </div>
            </div>
            <Switch
              checked={settings.maintenance_enabled}
              onCheckedChange={(v) => requestToggle("maintenance_enabled", v)}
            />
          </div>

          <div className="space-y-3">
            <div>
              <Label className="text-xs">Page Title</Label>
              <Input
                value={settings.maintenance_title}
                onChange={(e) => setSettings({ ...settings, maintenance_title: e.target.value })}
                placeholder="Site Under Maintenance"
                className="mt-1 h-9"
              />
            </div>
            <div>
              <Label className="text-xs">Message to Visitors</Label>
              <Input
                value={settings.maintenance_message}
                onChange={(e) => setSettings({ ...settings, maintenance_message: e.target.value })}
                placeholder="We'll be back shortly..."
                className="mt-1 h-9"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Save text changes */}
      <div className="flex justify-end">
        <Button onClick={saveText} disabled={saving} className="gap-2">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Save Text Changes
        </Button>
      </div>

      {/* Admin/Staff bypass note */}
      <div className="rounded-lg bg-muted/50 border border-border p-4 flex items-start gap-3">
        <Eye className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
        <div className="text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">Staff bypass is always active</p>
          <p>Logged-in admins and moderators can always access the full site regardless of which mode is active. Only public (non-logged-in) visitors and regular customers are shown the mode pages.</p>
        </div>
      </div>

      {/* Password Confirm Dialog */}
      <Dialog open={pwDialog} onOpenChange={(o) => { if (!o) { setPwDialog(false); setPendingChange(null); setPwInput(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-primary" />
              Confirm Admin Password
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              You are about to{" "}
              <strong>{pendingChange?.value ? "enable" : "disable"}</strong>{" "}
              <strong>{pendingChange?.field === "coming_soon_enabled" ? "Coming Soon" : "Maintenance"} mode</strong>.
              Please enter your password to confirm.
            </p>
            {pendingChange?.value && (
              <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/30 p-3">
                <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  This will make the site inaccessible to all public visitors immediately.
                </p>
              </div>
            )}
            <div>
              <Label>Admin Password</Label>
              <Input
                type="password"
                value={pwInput}
                onChange={(e) => setPwInput(e.target.value)}
                placeholder="Enter your password"
                onKeyDown={(e) => { if (e.key === "Enter" && pwInput.length > 0) confirmToggle(); }}
                autoFocus
                className="mt-1"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setPwDialog(false); setPendingChange(null); setPwInput(""); }}>
                Cancel
              </Button>
              <Button
                onClick={confirmToggle}
                disabled={pwInput.length === 0 || pwLoading}
                variant={pendingChange?.value ? "destructive" : "default"}
              >
                {pwLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Confirm
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
