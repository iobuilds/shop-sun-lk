import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, ExternalLink, Link2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const LINK_TYPES = [
  { value: "manufacturer", label: "Manufacturer" },
  { value: "datasheet", label: "Official Datasheet" },
  { value: "digikey", label: "Digi-Key" },
  { value: "mouser", label: "Mouser" },
  { value: "aliexpress", label: "AliExpress" },
  { value: "lcsc", label: "LCSC" },
  { value: "amazon", label: "Amazon" },
  { value: "other", label: "Other" },
];

const RELATION_TYPES = [
  { value: "similar", label: "Similar / Alternative" },
  { value: "equivalent", label: "Equivalent" },
  { value: "upgraded", label: "Upgraded Version" },
];

interface Props {
  productId: string;
  allProducts: { id: string; name: string }[];
}

const ProductLinksManager = ({ productId, allProducts }: Props) => {
  const queryClient = useQueryClient();
  const [newLink, setNewLink] = useState({ label: "", url: "", link_type: "other", is_active: true });
  const [newSimilar, setNewSimilar] = useState({ similar_product_id: "", relation_type: "similar" });

  const { data: externalLinks } = useQuery({
    queryKey: ["product-external-links", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_external_links" as any)
        .select("*")
        .eq("product_id", productId)
        .order("sort_order");
      if (error) throw error;
      return data as any[];
    },
    enabled: !!productId,
  });

  const { data: similarItems } = useQuery({
    queryKey: ["product-similar-items", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_similar_items" as any)
        .select("*, products:similar_product_id(id, name, images, slug)")
        .eq("product_id", productId);
      if (error) throw error;
      return data as any[];
    },
    enabled: !!productId,
  });

  const addLink = async () => {
    if (!newLink.label || !newLink.url) return;
    const { error } = await supabase.from("product_external_links" as any).insert({
      product_id: productId,
      ...newLink,
      sort_order: (externalLinks?.length || 0),
    } as any);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Link added" });
    setNewLink({ label: "", url: "", link_type: "other", is_active: true });
    queryClient.invalidateQueries({ queryKey: ["product-external-links", productId] });
  };

  const deleteLink = async (id: string) => {
    await supabase.from("product_external_links" as any).delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["product-external-links", productId] });
  };

  const toggleLink = async (id: string, is_active: boolean) => {
    await supabase.from("product_external_links" as any).update({ is_active } as any).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["product-external-links", productId] });
  };

  const addSimilar = async () => {
    if (!newSimilar.similar_product_id) return;
    const { error } = await supabase.from("product_similar_items" as any).insert({
      product_id: productId,
      ...newSimilar,
    } as any);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Similar product linked" });
    setNewSimilar({ similar_product_id: "", relation_type: "similar" });
    queryClient.invalidateQueries({ queryKey: ["product-similar-items", productId] });
  };

  const deleteSimilar = async (id: string) => {
    await supabase.from("product_similar_items" as any).delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["product-similar-items", productId] });
  };

  return (
    <div className="space-y-6 border-t border-border pt-4">
      {/* External Links */}
      <div>
        <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <ExternalLink className="w-4 h-4 text-secondary" /> International Links
        </h4>
        {externalLinks && externalLinks.length > 0 && (
          <div className="space-y-2 mb-3">
            {externalLinks.map((link: any) => (
              <div key={link.id} className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
                <span className="text-xs bg-muted px-2 py-0.5 rounded font-mono">{link.link_type}</span>
                <span className="text-sm text-foreground flex-1 truncate">{link.label}</span>
                <Switch
                  checked={link.is_active}
                  onCheckedChange={(v) => toggleLink(link.id, v)}
                  className="scale-75"
                />
                <button onClick={() => deleteLink(link.id)} className="p-1 text-muted-foreground hover:text-destructive">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
          <Input
            value={newLink.label}
            onChange={(e) => setNewLink({ ...newLink, label: e.target.value })}
            placeholder="Link label"
            className="text-sm"
          />
          <Input
            value={newLink.url}
            onChange={(e) => setNewLink({ ...newLink, url: e.target.value })}
            placeholder="https://..."
            className="text-sm"
          />
          <Select value={newLink.link_type} onValueChange={(v) => setNewLink({ ...newLink, link_type: v })}>
            <SelectTrigger className="w-32 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {LINK_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="sm" onClick={addLink} className="mt-2 gap-1" disabled={!newLink.label || !newLink.url}>
          <Plus className="w-3.5 h-3.5" /> Add Link
        </Button>
      </div>

      {/* Similar Products */}
      <div>
        <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Link2 className="w-4 h-4 text-secondary" /> Similar / Alternative Products
        </h4>
        {similarItems && similarItems.length > 0 && (
          <div className="space-y-2 mb-3">
            {similarItems.map((item: any) => (
              <div key={item.id} className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
                <span className="text-xs bg-muted px-2 py-0.5 rounded capitalize">{item.relation_type}</span>
                <span className="text-sm text-foreground flex-1 truncate">{item.products?.name || "Unknown"}</span>
                <button onClick={() => deleteSimilar(item.id)} className="p-1 text-muted-foreground hover:text-destructive">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <Select value={newSimilar.similar_product_id} onValueChange={(v) => setNewSimilar({ ...newSimilar, similar_product_id: v })}>
            <SelectTrigger className="flex-1 text-sm"><SelectValue placeholder="Select product" /></SelectTrigger>
            <SelectContent className="max-h-60">
              {allProducts
                .filter((p) => p.id !== productId)
                .map((p) => (
                  <SelectItem key={p.id} value={p.id} className="text-xs">{p.name}</SelectItem>
                ))}
            </SelectContent>
          </Select>
          <Select value={newSimilar.relation_type} onValueChange={(v) => setNewSimilar({ ...newSimilar, relation_type: v })}>
            <SelectTrigger className="w-40 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {RELATION_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="sm" onClick={addSimilar} className="mt-2 gap-1" disabled={!newSimilar.similar_product_id}>
          <Plus className="w-3.5 h-3.5" /> Link Product
        </Button>
      </div>
    </div>
  );
};

export default ProductLinksManager;
