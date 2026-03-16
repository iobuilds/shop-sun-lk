import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Listens for real-time profile changes and immediately signs out
 * the current user if their account gets suspended while they are logged in.
 */
export const useSuspensionGuard = () => {
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const setup = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const userId = session.user.id;

      // Subscribe to changes on this user's profile row
      channel = supabase
        .channel(`suspension-guard-${userId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "profiles",
            filter: `user_id=eq.${userId}`,
          },
          async (payload) => {
            const newRow = payload.new as any;
            if (newRow?.is_suspended === true) {
              toast.error("🚫 Your account has been suspended. You will be logged out.", {
                duration: 5000,
              });
              // Small delay so toast is visible before redirect
              setTimeout(async () => {
                await supabase.auth.signOut();
                window.location.href = "/auth";
              }, 2000);
            }
          }
        )
        .subscribe();
    };

    setup();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);
};
