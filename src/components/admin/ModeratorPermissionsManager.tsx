import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Shield, Users, ShoppingBag, ShoppingCart, Layers, MessageSquare, Save, UserPlus, Trash2, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface PermSet {
  can_manage_orders: boolean;
  can_manage_preorders: boolean;
  can_manage_pcb_orders: boolean;
  can_view_contacts: boolean;
}

const defaultPerms: PermSet = {
  can_manage_orders: true,
  can_manage_preorders: false,
  can_manage_pcb_orders: false,
  can_view_contacts: true,
};

const PERMISSION_DEFS = [
  {
    key: "can_manage_orders" as keyof PermSet,
    label: "Standard Orders",
    description: "View, update status, track deliveries for normal orders",
    icon: ShoppingBag,
    color: "text-blue-500",
  },
  {
    key: "can_manage_preorders" as keyof PermSet,
    label: "Pre-Orders",
    description: "Manage pre-order requests, quotes, approvals",
    icon: ShoppingCart,
    color: "text-purple-500",
  },
  {
    key: "can_manage_pcb_orders" as keyof PermSet,
    label: "PCB Orders",
    description: "Review PCB fabrication requests, quotes, payments",
    icon: Layers,
    color: "text-orange-500",
  },
  {
    key: "can_view_contacts" as keyof PermSet,
    label: "Messages & Support",
    description: "Read and reply to customer messages and contact forms",
    icon: MessageSquare,
    color: "text-green-500",
  },
];

const ModeratorPermissionsManager = () => {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState<string | null>(null);
  const [addDialog, setAddDialog] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<{ id: string; name: string } | null>(null);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [editPerms, setEditPerms] = useState<Record<string, PermSet>>({});

  const { data: moderators } = useQuery({
    queryKey: ["admin-moderators"],
    queryFn: async () => {
      const { data: roles, error } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "moderator");
      if (error) throw error;
      if (!roles?.length) return [];

      const userIds = roles.map((r: any) => r.user_id);

      const [{ data: profiles }, { data: permissions }] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name, phone, avatar_url").in("user_id", userIds),
        (supabase as any).from("moderator_permissions").select("*").in("user_id", userIds),
      ]);

      return userIds.map((uid: string) => {
        const profile = profiles?.find((p: any) => p.user_id === uid);
        const perms = (permissions as any[])?.find((p: any) => p.user_id === uid);
        return {
          user_id: uid,
          full_name: profile?.full_name || "Unknown",
          phone: profile?.phone || "",
          avatar_url: profile?.avatar_url || "",
          permissions: perms ? {
            can_manage_orders: perms.can_manage_orders,
            can_manage_preorders: perms.can_manage_preorders,
            can_manage_pcb_orders: perms.can_manage_pcb_orders,
            can_view_contacts: perms.can_view_contacts,
          } : { ...defaultPerms },
          hasPermRecord: !!perms,
        };
      });
    },
  });

  // All non-admin, non-moderator users for adding
  const { data: eligibleUsers } = useQuery({
    queryKey: ["admin-eligible-for-moderator"],
    queryFn: async () => {
      const { data: allRoles } = await supabase.from("user_roles").select("user_id");
      const usedIds = allRoles?.map((r: any) => r.user_id) || [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, phone")
        .order("full_name");
      return (profiles || []).filter((p: any) => !usedIds.includes(p.user_id));
    },
    enabled: addDialog,
  });

  const getLocalPerms = (uid: string, fallback: PermSet): PermSet =>
    editPerms[uid] ?? fallback;

  const updateLocalPerm = (uid: string, key: keyof PermSet, val: boolean, fallback: PermSet) => {
    setEditPerms(prev => ({
      ...prev,
      [uid]: { ...getLocalPerms(uid, fallback), [key]: val },
    }));
  };

  const savePermissions = async (uid: string, fallback: PermSet) => {
    const perms = getLocalPerms(uid, fallback);
    setSaving(uid);
    try {
      const { error } = await (supabase as any)
        .from("moderator_permissions")
        .upsert({ user_id: uid, ...perms, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
      if (error) throw error;
      toast({ title: "Permissions saved", description: "Moderator access updated successfully." });
      queryClient.invalidateQueries({ queryKey: ["admin-moderators"] });
      setEditPerms(prev => { const n = { ...prev }; delete n[uid]; return n; });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  const addModerator = async () => {
    if (!selectedUserId) return;
    setSaving("add");
    try {
      // Assign moderator role
      const { error: roleErr } = await supabase
        .from("user_roles")
        .insert({ user_id: selectedUserId, role: "moderator" as any });
      if (roleErr) throw roleErr;

      // Create default permissions
      await (supabase as any)
        .from("moderator_permissions")
        .upsert({ user_id: selectedUserId, ...defaultPerms }, { onConflict: "user_id" });

      toast({ title: "Moderator added", description: "User promoted to moderator with default permissions." });
      queryClient.invalidateQueries({ queryKey: ["admin-moderators"] });
      queryClient.invalidateQueries({ queryKey: ["admin-eligible-for-moderator"] });
      queryClient.invalidateQueries({ queryKey: ["admin-user-roles"] });
      setAddDialog(false);
      setSelectedUserId("");
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  const removeModerator = async (uid: string) => {
    setSaving(uid);
    try {
      await supabase.from("user_roles").delete().eq("user_id", uid).eq("role", "moderator" as any);
      await (supabase as any).from("moderator_permissions").delete().eq("user_id", uid);
      toast({ title: "Moderator removed", description: "User demoted to regular user." });
      queryClient.invalidateQueries({ queryKey: ["admin-moderators"] });
      queryClient.invalidateQueries({ queryKey: ["admin-eligible-for-moderator"] });
      queryClient.invalidateQueries({ queryKey: ["admin-user-roles"] });
      setRemoveTarget(null);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-secondary/10">
            <Shield className="w-5 h-5 text-secondary" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Moderator Permissions</h2>
            <p className="text-xs text-muted-foreground">Control what each moderator can access</p>
          </div>
        </div>
        <Button size="sm" onClick={() => setAddDialog(true)} className="gap-2">
          <UserPlus className="w-4 h-4" />
          Add Moderator
        </Button>
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {PERMISSION_DEFS.map(p => (
          <div key={p.key} className="flex items-center gap-2 p-3 rounded-lg border border-border bg-card">
            <p.icon className={`w-4 h-4 shrink-0 ${p.color}`} />
            <div>
              <p className="text-xs font-semibold text-foreground">{p.label}</p>
              <p className="text-[10px] text-muted-foreground leading-tight">{p.description}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Moderator cards */}
      {!moderators?.length && (
        <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-border rounded-xl">
          <Lock className="w-10 h-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No moderators yet</p>
          <p className="text-xs text-muted-foreground mt-1">Click "Add Moderator" to assign a user</p>
        </div>
      )}

      <div className="space-y-4">
        {moderators?.map((mod: any) => {
          const localPerms = getLocalPerms(mod.user_id, mod.permissions);
          const isDirty = JSON.stringify(localPerms) !== JSON.stringify(mod.permissions);

          return (
            <div key={mod.user_id} className="border border-border rounded-xl bg-card p-5 space-y-4">
              {/* Moderator header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="w-10 h-10">
                    <AvatarFallback className="bg-secondary/10 text-secondary font-bold">
                      {(mod.full_name || "M")[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-foreground text-sm">{mod.full_name}</p>
                      <Badge variant="secondary" className="text-[10px]">Moderator</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{mod.phone || "No phone"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isDirty && (
                    <Button
                      size="sm"
                      onClick={() => savePermissions(mod.user_id, mod.permissions)}
                      disabled={saving === mod.user_id}
                      className="gap-1.5 h-8 text-xs"
                    >
                      <Save className="w-3.5 h-3.5" />
                      {saving === mod.user_id ? "Saving…" : "Save"}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setRemoveTarget({ id: mod.user_id, name: mod.full_name })}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Permission toggles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PERMISSION_DEFS.map(pdef => (
                  <div
                    key={pdef.key}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                      localPerms[pdef.key]
                        ? "border-secondary/30 bg-secondary/5"
                        : "border-border bg-muted/20"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <pdef.icon className={`w-4 h-4 ${localPerms[pdef.key] ? pdef.color : "text-muted-foreground"}`} />
                      <div>
                        <Label className="text-xs font-medium cursor-pointer">{pdef.label}</Label>
                        <p className="text-[10px] text-muted-foreground">{pdef.description}</p>
                      </div>
                    </div>
                    <Switch
                      checked={localPerms[pdef.key]}
                      onCheckedChange={(v) => updateLocalPerm(mod.user_id, pdef.key, v, mod.permissions)}
                    />
                  </div>
                ))}
              </div>

              {/* Access summary */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="text-[10px] text-muted-foreground font-medium mr-1">Access:</span>
                {PERMISSION_DEFS.filter(p => localPerms[p.key]).map(p => (
                  <span key={p.key} className="inline-flex items-center gap-1 bg-secondary/10 text-secondary text-[10px] px-2 py-0.5 rounded-full">
                    <p.icon className="w-2.5 h-2.5" />
                    {p.label}
                  </span>
                ))}
                {!PERMISSION_DEFS.some(p => localPerms[p.key]) && (
                  <span className="text-[10px] text-destructive">No permissions — moderator has no access</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add moderator dialog */}
      <Dialog open={addDialog} onOpenChange={setAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Moderator</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select User</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a user…" />
                </SelectTrigger>
                <SelectContent>
                  {eligibleUsers?.map((u: any) => (
                    <SelectItem key={u.user_id} value={u.user_id}>
                      <span className="font-medium">{u.full_name || "Unknown"}</span>
                      {u.phone && <span className="ml-2 text-muted-foreground text-xs">{u.phone}</span>}
                    </SelectItem>
                  ))}
                  {!eligibleUsers?.length && (
                    <SelectItem value="__none__" disabled>No eligible users</SelectItem>
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                New moderator will get default access: Standard Orders + Messages.
                You can change permissions after adding.
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setAddDialog(false)}>Cancel</Button>
              <Button onClick={addModerator} disabled={!selectedUserId || saving === "add"}>
                {saving === "add" ? "Adding…" : "Add Moderator"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Remove confirm */}
      <AlertDialog open={!!removeTarget} onOpenChange={() => setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Moderator</AlertDialogTitle>
            <AlertDialogDescription>
              Remove <strong>{removeTarget?.name}</strong> as moderator? They will lose all dashboard access and be reverted to a regular user.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => removeTarget && removeModerator(removeTarget.id)}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ModeratorPermissionsManager;
