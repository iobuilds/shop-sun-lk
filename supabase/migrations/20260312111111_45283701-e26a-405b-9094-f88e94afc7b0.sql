
-- Allow anonymous users to check if a phone number is already registered
-- This is needed so the registration form can block duplicate phone numbers before sending OTP
CREATE POLICY "Public can check phone existence"
  ON public.profiles
  FOR SELECT
  USING (true);
