
-- =============================================
-- 1) ENHANCE COUPONS TABLE
-- =============================================

-- Add new columns to coupons
ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS coupon_type text NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS max_discount_cap numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS per_user_limit integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS starts_at timestamp with time zone DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS category_scope text NOT NULL DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS valid_category_ids uuid[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS name text DEFAULT NULL;

-- =============================================
-- 2) COUPON ASSIGNMENTS (Private coupons → users via phone)
-- =============================================

CREATE TABLE public.coupon_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id uuid NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  phone text NOT NULL,
  user_id uuid DEFAULT NULL,
  used boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(coupon_id, phone)
);

ALTER TABLE public.coupon_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage coupon assignments"
  ON public.coupon_assignments FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own assignments"
  ON public.coupon_assignments FOR SELECT
  USING (auth.uid() = user_id);

-- =============================================
-- 3) COUPON USAGE TRACKING (per-user)
-- =============================================

CREATE TABLE public.coupon_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id uuid NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  used_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.coupon_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage coupon usage"
  ON public.coupon_usage FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own coupon usage"
  ON public.coupon_usage FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service can insert coupon usage"
  ON public.coupon_usage FOR INSERT
  WITH CHECK (true);

-- =============================================
-- 4) WALLETS
-- =============================================

CREATE TABLE public.wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  balance numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all wallets"
  ON public.wallets FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own wallet"
  ON public.wallets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own wallet"
  ON public.wallets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_wallets_updated_at
  BEFORE UPDATE ON public.wallets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- 5) WALLET TRANSACTIONS
-- =============================================

CREATE TABLE public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  amount numeric NOT NULL,
  type text NOT NULL DEFAULT 'credit',
  reason text NOT NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  created_by uuid DEFAULT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all wallet transactions"
  ON public.wallet_transactions FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own wallet transactions"
  ON public.wallet_transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service can insert wallet transactions"
  ON public.wallet_transactions FOR INSERT
  WITH CHECK (true);

-- =============================================
-- 6) WALLET BALANCE UPDATE FUNCTION
-- =============================================

CREATE OR REPLACE FUNCTION public.update_wallet_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.wallets
  SET balance = balance + NEW.amount
  WHERE id = NEW.wallet_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER wallet_transaction_update_balance
  AFTER INSERT ON public.wallet_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_wallet_balance();
