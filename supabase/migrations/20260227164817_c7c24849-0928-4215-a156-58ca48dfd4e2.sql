
-- Contact messages table
CREATE TABLE public.contact_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

-- Anyone can submit a contact message
CREATE POLICY "Anyone can submit contact messages"
  ON public.contact_messages FOR INSERT
  WITH CHECK (true);

-- Admins can view all contact messages
CREATE POLICY "Admins can view contact messages"
  ON public.contact_messages FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update (mark as read)
CREATE POLICY "Admins can update contact messages"
  ON public.contact_messages FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can delete
CREATE POLICY "Admins can delete contact messages"
  ON public.contact_messages FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Coupons table
CREATE TABLE public.coupons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  discount_type TEXT NOT NULL DEFAULT 'percentage', -- 'percentage' or 'fixed'
  discount_value NUMERIC NOT NULL DEFAULT 0,
  min_order_amount NUMERIC DEFAULT 0,
  max_uses INTEGER,
  used_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

-- Everyone can view active coupons (for validation)
CREATE POLICY "Anyone can view active coupons"
  ON public.coupons FOR SELECT
  USING (true);

-- Admins can manage coupons
CREATE POLICY "Admins can insert coupons"
  ON public.coupons FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update coupons"
  ON public.coupons FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete coupons"
  ON public.coupons FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Add discount columns to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS coupon_code TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount_amount NUMERIC NOT NULL DEFAULT 0;
