import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
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

  try {
    // Verify caller is admin
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !user) throw new Error("Not authenticated");

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
        // Update profile
        const { error } = await supabaseAdmin
          .from("profiles")
          .update({
            is_suspended: true,
            suspended_at: new Date().toISOString(),
            suspended_reason: reason || "Suspended by admin",
          })
          .eq("user_id", target_user_id);
        if (error) throw error;

        // Ban user in auth (prevents login)
        const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(
          target_user_id,
          { ban_duration: "876000h" } // ~100 years
        );
        if (banError) throw banError;

        result.message = "User suspended successfully";
        break;
      }

      case "unsuspend": {
        const { error } = await supabaseAdmin
          .from("profiles")
          .update({
            is_suspended: false,
            suspended_at: null,
            suspended_reason: null,
          })
          .eq("user_id", target_user_id);
        if (error) throw error;

        // Unban user
        const { error: unbanError } = await supabaseAdmin.auth.admin.updateUserById(
          target_user_id,
          { ban_duration: "none" }
        );
        if (unbanError) throw unbanError;

        result.message = "User unsuspended successfully";
        break;
      }

      case "delete": {
        // Check if user has orders
        const { count } = await supabaseAdmin
          .from("orders")
          .select("*", { count: "exact", head: true })
          .eq("user_id", target_user_id);

        if ((count || 0) > 0) {
          throw new Error(`Cannot delete: user has ${count} existing orders. Use suspend/deactivate instead.`);
        }

        // Delete profile first
        await supabaseAdmin.from("profiles").delete().eq("user_id", target_user_id);
        await supabaseAdmin.from("user_roles").delete().eq("user_id", target_user_id);
        await supabaseAdmin.from("wallets").delete().eq("user_id", target_user_id);
        await supabaseAdmin.from("wishlists").delete().eq("user_id", target_user_id);

        // Delete auth user
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(target_user_id);
        if (deleteError) throw deleteError;

        result.message = "User deleted successfully";
        break;
      }

      case "update_profile": {
        const { full_name, phone, city, address_line1, address_line2, postal_code } = params;
        
        // Check phone uniqueness if changing
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
          updateData.phone_verified = false; // Reset verification
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

        result.message = "Profile updated successfully";
        break;
      }

      case "update_email": {
        const { email } = params;
        if (!email) throw new Error("Email is required");

        // Check email uniqueness
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

        result.message = "Email updated successfully";
        break;
      }

      case "change_role": {
        const { role } = params;
        if (!["admin", "moderator", "user"].includes(role)) throw new Error("Invalid role");

        // First, delete ALL existing roles for this user
        const { error: deleteError } = await supabaseAdmin
          .from("user_roles")
          .delete()
          .eq("user_id", target_user_id);
        if (deleteError) throw deleteError;

        // If the new role is not "user", insert the elevated role
        // "user" is the default when no role entry exists
        if (role !== "user") {
          const { error: insertError } = await supabaseAdmin
            .from("user_roles")
            .insert({ user_id: target_user_id, role });
          if (insertError) throw insertError;
        }

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
    // Always return 200 so supabase-js doesn't throw a FunctionsHttpError.
    // The caller checks res.data.error to detect failures.
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }
});
