import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const useWishlist = () => {
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUserId(session?.user?.id ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => setUserId(session?.user?.id ?? null));
    return () => subscription.unsubscribe();
  }, []);

  const { data: wishlistIds = [] } = useQuery({
    queryKey: ["wishlist", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wishlists")
        .select("product_id")
        .eq("user_id", userId!);
      if (error) throw error;
      return data.map((w) => w.product_id);
    },
    enabled: !!userId,
  });

  const isInWishlist = (productId: string) => wishlistIds.includes(productId);

  const toggleWishlist = async (productId: string) => {
    if (!userId) {
      toast.error("Please sign in to use your wishlist");
      return;
    }
    if (isInWishlist(productId)) {
      await supabase.from("wishlists").delete().eq("user_id", userId).eq("product_id", productId);
      toast.success("Removed from wishlist");
    } else {
      await supabase.from("wishlists").insert({ user_id: userId, product_id: productId });
      toast.success("Added to wishlist");
    }
    queryClient.invalidateQueries({ queryKey: ["wishlist", userId] });
  };

  return { wishlistIds, isInWishlist, toggleWishlist, isLoggedIn: !!userId };
};
