import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Search, Plus, Wallet, ArrowUpCircle, ArrowDownCircle } from "lucide-react";

interface WalletManagerProps {
  profiles: any[];
}

const WalletManager = ({ profiles }: WalletManagerProps) => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [creditDialog, setCreditDialog] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [creditForm, setCreditForm] = useState({ amount: "", reason: "", order_id: "" });
  const [historyDialog, setHistoryDialog] = useState(false);
  const [historyWalletId, setHistoryWalletId] = useState<string | null>(null);

  const { data: wallets } = useQuery({
    queryKey: ["admin-wallets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wallets" as any)
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: walletHistory } = useQuery({
    queryKey: ["admin-wallet-history", historyWalletId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wallet_transactions" as any)
        .select("*")
        .eq("wallet_id", historyWalletId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as any[];
    },
    enabled: !!historyWalletId,
  });

  const getProfile = (userId: string) => profiles.find(p => p.user_id === userId);

  const filteredWallets = wallets?.filter(w => {
    if (!search) return true;
    const profile = getProfile(w.user_id);
    return profile?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
           profile?.phone?.includes(search);
  });

  const addCredit = async () => {
    if (!selectedUserId || !creditForm.amount || !creditForm.reason) return;
    try {
      // Ensure wallet exists
      let { data: wallet } = await supabase
        .from("wallets" as any)
        .select("id")
        .eq("user_id", selectedUserId)
        .maybeSingle();

      if (!wallet) {
        const { data: newWallet, error: wErr } = await supabase
          .from("wallets" as any)
          .insert({ user_id: selectedUserId, balance: 0 })
          .select()
          .single();
        if (wErr) throw wErr;
        wallet = newWallet;
      }

      const { error } = await supabase
        .from("wallet_transactions" as any)
        .insert({
          wallet_id: (wallet as any).id,
          user_id: selectedUserId,
          amount: Number(creditForm.amount),
          type: Number(creditForm.amount) >= 0 ? "credit" : "debit",
          reason: creditForm.reason,
          order_id: creditForm.order_id || null,
        });
      if (error) throw error;
      toast({ title: "Wallet updated successfully" });
      setCreditDialog(false);
      setCreditForm({ amount: "", reason: "", order_id: "" });
      queryClient.invalidateQueries({ queryKey: ["admin-wallets"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input placeholder="Search by name or phone..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 text-xs pl-8" />
        </div>
        <Button size="sm" onClick={() => { setSelectedUserId(""); setCreditDialog(true); }} className="gap-1.5">
          <Plus className="w-4 h-4" /> Add Credit
        </Button>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">User</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Phone</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Balance</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Updated</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredWallets?.map((w: any) => {
                const profile = getProfile(w.user_id);
                return (
                  <tr key={w.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 text-foreground font-medium">{profile?.full_name || w.user_id.slice(0, 8)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{profile?.phone || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`font-bold ${Number(w.balance) > 0 ? "text-secondary" : "text-muted-foreground"}`}>
                        Rs. {Number(w.balance).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(w.updated_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { setSelectedUserId(w.user_id); setCreditDialog(true); }}>
                          <Plus className="w-3 h-3 mr-1" /> Credit
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setHistoryWalletId(w.id); setHistoryDialog(true); }}>
                          History
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {(!wallets || wallets.length === 0) && (
                <tr><td colSpan={5} className="text-center py-16 text-muted-foreground">
                  <Wallet className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No wallets yet</p>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Credit Dialog */}
      <Dialog open={creditDialog} onOpenChange={setCreditDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add Wallet Credit</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>User</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger>
                <SelectContent>
                  {profiles.map(p => (
                    <SelectItem key={p.user_id} value={p.user_id}>
                      {p.full_name || p.user_id.slice(0, 8)} {p.phone ? `(${p.phone})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Amount (Rs.)</Label>
              <Input type="number" value={creditForm.amount} onChange={(e) => setCreditForm({ ...creditForm, amount: e.target.value })} placeholder="500 (positive=credit, negative=debit)" />
            </div>
            <div>
              <Label>Reason *</Label>
              <Textarea value={creditForm.reason} onChange={(e) => setCreditForm({ ...creditForm, reason: e.target.value })} placeholder="Refund for order #123 / Goodwill credit" rows={2} />
            </div>
            <div>
              <Label>Related Order ID (optional)</Label>
              <Input value={creditForm.order_id} onChange={(e) => setCreditForm({ ...creditForm, order_id: e.target.value })} placeholder="Order UUID" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCreditDialog(false)}>Cancel</Button>
              <Button onClick={addCredit} disabled={!selectedUserId || !creditForm.amount || !creditForm.reason}>Add</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={historyDialog} onOpenChange={setHistoryDialog}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Wallet History</DialogTitle></DialogHeader>
          <div className="space-y-2">
            {walletHistory?.map((t: any) => (
              <div key={t.id} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                {Number(t.amount) >= 0 ? (
                  <ArrowUpCircle className="w-5 h-5 text-secondary shrink-0" />
                ) : (
                  <ArrowDownCircle className="w-5 h-5 text-destructive shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{t.reason}</p>
                  <p className="text-[10px] text-muted-foreground">{new Date(t.created_at).toLocaleString()}</p>
                </div>
                <span className={`font-bold text-sm ${Number(t.amount) >= 0 ? "text-secondary" : "text-destructive"}`}>
                  {Number(t.amount) >= 0 ? "+" : ""}Rs. {Math.abs(Number(t.amount)).toLocaleString()}
                </span>
              </div>
            ))}
            {(!walletHistory || walletHistory.length === 0) && (
              <p className="text-center py-8 text-muted-foreground text-sm">No transactions yet</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WalletManager;
