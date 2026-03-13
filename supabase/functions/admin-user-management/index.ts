import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function logAdminAction(supabaseAdmin: any, {
  adminId, adminEmail, action, targetType, targetId, details, ipAddress,
}: {
  adminId: string; adminEmail?: string; action: string;
  targetType?: string; targetId?: string; details?: Record<string, any>; ipAddress?: string;
}) {
  await supabaseAdmin.from("admin_activity_logs").insert({
    admin_id: adminId,
    admin_email: adminEmail || null,
    action,
    target_type: targetType || null,
    target_id: targetId || null,
    details: details || {},
    ip_address: ipAddress || null,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  const ipAddress = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";

  try {
    // Verify caller is admin
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !user) throw new Error("Not authenticated");

    // Get admin email from auth
    const { data: { user: adminUser } } = await supabaseAdmin.auth.admin.getUserById(user.id);
    const adminEmail = adminUser?.email || user.email || "unknown";

    // Check admin role
    const { data: adminRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!adminRole) throw new Error("Not authorized: admin role required");

    const { action, target_user_id, ...params } = await req.json();
    if (!action || !target_user_id) throw new Error("action and target_user_id required");

    // Prevent self-modification for dangerous actions
    if (["delete", "suspend", "change_role"].includes(action) && target_user_id === user.id) {
      throw new Error("Cannot perform this action on your own account");
    }

    let result: any = { success: true };

    switch (action) {
      case "suspend": {
        const { reason } = params;
        const { error } = await supabaseAdmin
          .from("profiles")
          .update({
            is_suspended: true,
            suspended_at: new Date().toISOString(),
            suspended_reason: reason || "Suspended by admin",
          })
          .eq("user_id", target_user_id);
        if (error) throw error;

        const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(
          target_user_id,
          { ban_duration: "876000h" }
        );
        if (banError) throw banError;

        await logAdminAction(supabaseAdmin, {
          adminId: user.id, adminEmail, action: "user_suspended",
          targetType: "user", targetId: target_user_id,
          details: { reason: reason || "Suspended by admin" }, ipAddress,
        });

        result.message = "User suspended successfully";
        break;
      }

      case "unsuspend": {
        const { error } = await supabaseAdmin
          .from("profiles")
          .update({ is_suspended: false, suspended_at: null, suspended_reason: null })
          .eq("user_id", target_user_id);
        if (error) throw error;

        const { error: unbanError } = await supabaseAdmin.auth.admin.updateUserById(
          target_user_id,
          { ban_duration: "none" }
        );
        if (unbanError) throw unbanError;

        await logAdminAction(supabaseAdmin, {
          adminId: user.id, adminEmail, action: "user_unsuspended",
          targetType: "user", targetId: target_user_id,
          details: {}, ipAddress,
        });

        result.message = "User unsuspended successfully";
        break;
      }

      case "delete": {
        const { count } = await supabaseAdmin
          .from("orders")
          .select("*", { count: "exact", head: true })
          .eq("user_id", target_user_id);

        if ((count || 0) > 0) {
          throw new Error(`Cannot delete: user has ${count} existing orders. Use suspend/deactivate instead.`);
        }

        // Get user info before deletion for log
        const { data: targetProfile } = await supabaseAdmin
          .from("profiles")
          .select("full_name, phone")
          .eq("user_id", target_user_id)
          .maybeSingle();
        const { data: { user: targetAuthUser } } = await supabaseAdmin.auth.admin.getUserById(target_user_id);

        await supabaseAdmin.from("profiles").delete().eq("user_id", target_user_id);
        await supabaseAdmin.from("user_roles").delete().eq("user_id", target_user_id);
        await supabaseAdmin.from("wallets").delete().eq("user_id", target_user_id);
        await supabaseAdmin.from("wishlists").delete().eq("user_id", target_user_id);

        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(target_user_id);
        if (deleteError) throw deleteError;

        await logAdminAction(supabaseAdmin, {
          adminId: user.id, adminEmail, action: "user_deleted",
          targetType: "user", targetId: target_user_id,
          details: {
            deleted_user_email: targetAuthUser?.email || "unknown",
            deleted_user_name: targetProfile?.full_name || "unknown",
          }, ipAddress,
        });

        result.message = "User deleted successfully";
        break;
      }

      case "update_profile": {
        const { full_name, phone, city, address_line1, address_line2, postal_code } = params;

        if (phone) {
          const cleanPhone = phone.replace(/\s/g, "");
          const { data: existing } = await supabaseAdmin
            .from("profiles")
            .select("user_id")
            .eq("phone", cleanPhone)
            .neq("user_id", target_user_id)
            .maybeSingle();
          if (existing) throw new Error("This phone number is already used by another user");
        }

        const updateData: any = {};
        if (full_name !== undefined) updateData.full_name = full_name;
        if (phone !== undefined) {
          updateData.phone = phone.replace(/\s/g, "");
          updateData.phone_verified = false;
        }
        if (city !== undefined) updateData.city = city;
        if (address_line1 !== undefined) updateData.address_line1 = address_line1;
        if (address_line2 !== undefined) updateData.address_line2 = address_line2;
        if (postal_code !== undefined) updateData.postal_code = postal_code;

        const { error } = await supabaseAdmin
          .from("profiles")
          .update(updateData)
          .eq("user_id", target_user_id);
        if (error) throw error;

        await logAdminAction(supabaseAdmin, {
          adminId: user.id, adminEmail, action: "user_profile_updated",
          targetType: "user", targetId: target_user_id,
          details: { fields_changed: Object.keys(updateData) }, ipAddress,
        });

        result.message = "Profile updated successfully";
        break;
      }

      case "update_email": {
        const { email } = params;
        if (!email) throw new Error("Email is required");

        const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
        const emailTaken = existingUsers?.users?.some(
          (u: any) => u.email === email && u.id !== target_user_id
        );
        if (emailTaken) throw new Error("This email is already used by another user");

        const { error } = await supabaseAdmin.auth.admin.updateUserById(
          target_user_id,
          { email, email_confirm: true }
        );
        if (error) throw error;

        await logAdminAction(supabaseAdmin, {
          adminId: user.id, adminEmail, action: "user_email_updated",
          targetType: "user", targetId: target_user_id,
          details: { new_email: email }, ipAddress,
        });

        result.message = "Email updated successfully";
        break;
      }

      case "change_role": {
        const { role } = params;
        if (!["admin", "moderator", "user"].includes(role)) throw new Error("Invalid role");

        // Get previous role for log
        const { data: prevRoles } = await supabaseAdmin
          .from("user_roles")
          .select("role")
          .eq("user_id", target_user_id);
        const prevRole = prevRoles?.[0]?.role || "user";

        const { error: deleteError } = await supabaseAdmin
          .from("user_roles")
          .delete()
          .eq("user_id", target_user_id);
        if (deleteError) throw deleteError;

        if (role !== "user") {
          const { error: insertError } = await supabaseAdmin
            .from("user_roles")
            .insert({ user_id: target_user_id, role });
          if (insertError) throw insertError;
        }

        await logAdminAction(supabaseAdmin, {
          adminId: user.id, adminEmail, action: "user_role_changed",
          targetType: "user", targetId: target_user_id,
          details: { from_role: prevRole, to_role: role }, ipAddress,
        });

        result.message = `Role changed to ${role} successfully`;
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify({ success: true, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }
});
