import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface SiteModeSettings {
  coming_soon_enabled: boolean;
  maintenance_enabled: boolean;
  coming_soon_title: string;
  coming_soon_subtitle: string;
  maintenance_title: string;
  maintenance_message: string;
}

export const useSiteModes = () => {
  return useQuery<SiteModeSettings>({
    queryKey: ["public-site-modes"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("site_settings")
        .select("value")
        .eq("key", "site_modes")
        .maybeSingle();

      if (!data?.value) {
        return {
          coming_soon_enabled: false,
          maintenance_enabled: false,
          coming_soon_title: "Coming Soon",
          coming_soon_subtitle: "We're working on something amazing. Stay tuned!",
          maintenance_title: "Site Under Maintenance",
          maintenance_message: "We're performing scheduled maintenance. We'll be back shortly.",
        };
      }
      return data.value as SiteModeSettings;
    },
    staleTime: 60000, // 1 min cache
  });
};
