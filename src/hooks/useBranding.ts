import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useBranding = () => {
  const { data: company } = useQuery({
    queryKey: ["site-company-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_settings" as any)
        .select("*")
        .eq("key", "company")
        .maybeSingle();
      if (error) throw error;
      return (data as any)?.value as any || null;
    },
    staleTime: 5 * 60 * 1000,
  });

  const storeName = company?.store_name || "NanoCircuit.lk";
  const logoUrl = company?.logo_url || "/site-logo.png";
  const initial = storeName.charAt(0).toUpperCase();

  return { storeName, logoUrl, initial, company };
};
