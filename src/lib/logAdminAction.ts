import { logSiteAction } from "@/lib/logSiteAction";

/** @deprecated Use logSiteAction instead */
export const logAdminAction = async (
  action: string,
  targetType?: string,
  targetId?: string,
  details?: Record<string, any>
) => {
  await logSiteAction(action, targetType, targetId, details);
};
