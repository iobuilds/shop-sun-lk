import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export type UserRole = "admin" | "moderator" | "user";

export const useAdminAuth = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isModerator, setIsModerator] = useState(false);
  const [userRole, setUserRole] = useState<UserRole>("user");
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
      setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      check();
    });

    check();
    return () => subscription.unsubscribe();
  }, [navigate]);

  return { isAdmin, isModerator, userRole, loading };
};
