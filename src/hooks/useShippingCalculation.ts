import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CartItem } from "@/contexts/CartContext";

interface ShippingSettings {
  local_fee: number;
  overseas_fee: number;
  free_shipping_threshold: number;
}

interface ShippingResult {
  shipping: number;
  hasOverseas: boolean;
  isFreeship: boolean;
  localFee: number;
  overseasFee: number;
  freeThreshold: number;
  shippingNote: string;
  freeShippingGap: number | null;
  isLoading: boolean;
}

export const useShippingCalculation = (items: CartItem[], subtotal: number): ShippingResult => {
  // Fetch shipping settings from DB (single source of truth)
  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ["shipping-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_settings" as any)
        .select("*")
        .eq("key", "shipping_settings")
        .maybeSingle();
      if (error) throw error;
      return (data as any)?.value as ShippingSettings || null;
    },
    staleTime: 30 * 1000, // 30s — stays fresh but re-fetches often enough
  });

  // Fetch product specifications to detect overseas items
  const productIds = items.map((i) => i.id);
  const { data: productSpecs, isLoading: specsLoading } = useQuery({
    queryKey: ["product-shipping-types", ...productIds],
    queryFn: async () => {
      if (productIds.length === 0) return [];
      const { data } = await supabase
        .from("products")
        .select("id, specifications")
        .in("id", productIds);
      return data || [];
    },
    enabled: productIds.length > 0,
    staleTime: 60 * 1000,
  });

  const localFee = settings?.local_fee ?? 350;
  const overseasFee = settings?.overseas_fee ?? 1500;
  const freeThreshold = settings?.free_shipping_threshold ?? 5000;

  // Check if any item is overseas
  const hasOverseas = (productSpecs || []).some((p: any) => {
    return p.shipping_source === "overseas" || (p.specifications || {})._shipping_type === "overseas";
  });

  let shipping: number;
  let shippingNote: string;
  let isFreeship = false;
  let freeShippingGap: number | null = null;

  if (hasOverseas) {
    shipping = overseasFee;
    shippingNote = "Overseas shipping fee applied (cart contains overseas items)";
  } else if (subtotal >= freeThreshold) {
    shipping = 0;
    isFreeship = true;
    shippingNote = `Free shipping applied (order above Rs. ${freeThreshold.toLocaleString()})`;
  } else {
    shipping = localFee;
    shippingNote = "Local shipping fee applied";
    freeShippingGap = freeThreshold - subtotal;
  }

  return {
    shipping,
    hasOverseas,
    isFreeship,
    localFee,
    overseasFee,
    freeThreshold,
    shippingNote,
    freeShippingGap,
    isLoading: settingsLoading || specsLoading,
  };
};
