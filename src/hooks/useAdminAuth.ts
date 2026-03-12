import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export type UserRole = "admin" | "moderator" | "user";

export interface ModeratorPermissions {
  can_manage_orders: boolean;
  can_manage_preorders: boolean;
  can_manage_pcb_orders: boolean;
  can_view_contacts: boolean;
}

const DEFAULT_MODERATOR_PERMISSIONS: ModeratorPermissions = {
  can_manage_orders: true,
  can_manage_preorders: false,
  can_manage_pcb_orders: false,
  can_view_contacts: true,
};

export const useAdminAuth = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isModerator, setIsModerator] = useState(false);
  const [userRole, setUserRole] = useState<UserRole>("user");
  const [moderatorPermissions, setModeratorPermissions] = useState<ModeratorPermissions>(DEFAULT_MODERATOR_PERMISSIONS);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id);

      const roleList = roles?.map((r: any) => r.role) || [];
      const hasAdmin = roleList.includes("admin");
      const hasModerator = roleList.includes("moderator");

      if (!hasAdmin && !hasModerator) {
        navigate("/");
        return;
      }

      setIsAdmin(hasAdmin);
      setIsModerator(hasModerator);
      setUserRole(hasAdmin ? "admin" : "moderator");

      // Fetch moderator permissions if moderator (not admin)
      if (hasModerator && !hasAdmin) {
        const { data: perms } = await (supabase as any)
          .from("moderator_permissions")
          .select("*")
          .eq("user_id", session.user.id)
          .maybeSingle();

        if (perms) {
          setModeratorPermissions({
            can_manage_orders: perms.can_manage_orders,
            can_manage_preorders: perms.can_manage_preorders,
            can_manage_pcb_orders: perms.can_manage_pcb_orders,
            can_view_contacts: perms.can_view_contacts,
          });
        } else {
          // No explicit record → use defaults
          setModeratorPermissions(DEFAULT_MODERATOR_PERMISSIONS);
        }
      } else if (hasAdmin) {
        // Admins have all permissions
        setModeratorPermissions({
          can_manage_orders: true,
          can_manage_preorders: true,
          can_manage_pcb_orders: true,
          can_view_contacts: true,
        });
      }

      setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      check();
    });

    check();
    return () => subscription.unsubscribe();
  }, [navigate]);

  return { isAdmin, isModerator, userRole, moderatorPermissions, loading };
};
