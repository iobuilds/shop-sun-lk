
-- Add columns for 48hr quote expiry, payment tracking, and arrival charges
ALTER TABLE public.preorder_requests 
  ADD COLUMN IF NOT EXISTS quoted_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS arrival_shipping_fee numeric,
  ADD COLUMN IF NOT EXISTS arrival_tax_amount numeric,
  ADD COLUMN IF NOT EXISTS arrival_payment_status text NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS stripe_session_id text;

-- Set quoted_at automatically when status becomes 'quoted'
CREATE OR REPLACE FUNCTION public.set_preorder_quoted_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'quoted' AND (OLD.status IS DISTINCT FROM 'quoted') THEN
    NEW.quoted_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_preorder_quoted_at ON public.preorder_requests;
CREATE TRIGGER trg_set_preorder_quoted_at
  BEFORE UPDATE ON public.preorder_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_preorder_quoted_at();
