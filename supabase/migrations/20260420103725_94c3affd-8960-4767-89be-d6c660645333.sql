-- 1) PROFILES
DROP POLICY IF EXISTS "Public can check phone existence" ON public.profiles;

CREATE OR REPLACE FUNCTION public.phone_exists(_phone text)
RETURNS TABLE(found boolean, is_suspended boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT TRUE, COALESCE(p.is_suspended, false)
  FROM public.profiles p
  WHERE p.phone = _phone
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.phone_exists(text) TO anon, authenticated;

-- 2) OTP_VERIFICATIONS
DROP POLICY IF EXISTS "Anyone can read OTP by phone" ON public.otp_verifications;
DROP POLICY IF EXISTS "Anyone can create OTP verification" ON public.otp_verifications;

-- 3) COUPONS
DROP POLICY IF EXISTS "Anyone can view active coupons" ON public.coupons;

CREATE POLICY "Public can view valid active coupons"
ON public.coupons FOR SELECT
TO anon, authenticated
USING (
  is_active = true
  AND (starts_at IS NULL OR starts_at <= now())
  AND (expires_at IS NULL OR expires_at > now())
);

CREATE POLICY "Admins can view all coupons"
ON public.coupons FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));