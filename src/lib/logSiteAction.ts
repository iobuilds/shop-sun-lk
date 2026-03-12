import { supabase } from "@/integrations/supabase/client";

/**
 * Log any site-wide action (user or admin) into admin_activity_logs.
 * Silently fails — never breaks the UI.
 */
export const logSiteAction = async (
  action: string,
  targetType?: string,
  targetId?: string,
  details?: Record<string, any>
) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    await supabase.from("admin_activity_logs").insert({
      admin_id: session?.user?.id ?? "00000000-0000-0000-0000-000000000000",
      admin_email: session?.user?.email ?? null,
      action,
      target_type: targetType ?? null,
      target_id: targetId ?? null,
      details: details ?? {},
    });
  } catch {
    // Logging failures should never break the UI
  }
};
