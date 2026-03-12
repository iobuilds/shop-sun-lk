import { supabase } from "@/integrations/supabase/client";

export const logAdminAction = async (
  action: string,
  targetType?: string,
  targetId?: string,
  details?: Record<string, any>
) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from("admin_activity_logs").insert({
      admin_id: session.user.id,
      admin_email: session.user.email ?? null,
      action,
      target_type: targetType ?? null,
      target_id: targetId ?? null,
      details: details ?? {},
    });
  } catch {
    // Logging failures should never break the UI
  }
};
