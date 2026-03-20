import { useState, useEffect, useRef } from "react";
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
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  useEffect(() => {
    let mounted = true;

    const check = async (userId?: string) => {
      try {
        let uid = userId;
        if (!uid) {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            if (mounted) {
              setIsAdmin(false);
              setIsModerator(false);
              setLoading(false);
              navigateRef.current("/auth");
            }
            return;
          }
          uid = session.user.id;
        }

        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", uid);

        if (!mounted) return;

        const roleList = roles?.map((r: any) => r.role) || [];
        const hasAdmin = roleList.includes("admin");
        const hasModerator = roleList.includes("moderator");

        if (!hasAdmin && !hasModerator) {
          navigateRef.current("/");
          return;
        }

        setIsAdmin(hasAdmin);
        setIsModerator(hasModerator);
        setUserRole(hasAdmin ? "admin" : "moderator");

        if (hasModerator && !hasAdmin) {
          const { data: perms } = await (supabase as any)
            .from("moderator_permissions")
            .select("*")
            .eq("user_id", uid)
            .maybeSingle();

          if (mounted) {
            if (perms) {
              setModeratorPermissions({
                can_manage_orders: perms.can_manage_orders,
                can_manage_preorders: perms.can_manage_preorders,
                can_manage_pcb_orders: perms.can_manage_pcb_orders,
                can_view_contacts: perms.can_view_contacts,
              });
            } else {
              setModeratorPermissions(DEFAULT_MODERATOR_PERMISSIONS);
            }
          }
        } else if (hasAdmin) {
          setModeratorPermissions({
            can_manage_orders: true,
            can_manage_preorders: true,
            can_manage_pcb_orders: true,
            can_view_contacts: true,
          });
        }
      } catch (err) {
        console.error("Admin auth check failed:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    // Handle auth state changes — INITIAL_SESSION fires immediately with existing session
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION") {
        if (session?.user?.id) {
          check(session.user.id);
        } else {
          if (mounted) {
            setLoading(false);
            navigateRef.current("/auth");
          }
        }
      } else if (event === "SIGNED_OUT") {
        if (mounted) {
          setIsAdmin(false);
          setIsModerator(false);
          navigateRef.current("/auth");
        }
      } else if (event === "SIGNED_IN" || event === "USER_UPDATED") {
        if (session?.user?.id) check(session.user.id);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);


  return { isAdmin, isModerator, userRole, moderatorPermissions, loading };
};
