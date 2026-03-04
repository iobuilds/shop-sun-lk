
-- Drop the old restrictive user SELECT policy
DROP POLICY IF EXISTS "Users can view own assignments" ON public.coupon_assignments;

-- Create a new policy that matches by user_id OR by phone through profiles
CREATE POLICY "Users can view own assignments"
ON public.coupon_assignments
FOR SELECT
USING (
  auth.uid() = user_id
  OR phone IN (
    SELECT REPLACE(p.phone, ' ', '') FROM public.profiles p WHERE p.user_id = auth.uid() AND p.phone IS NOT NULL
  )
);
