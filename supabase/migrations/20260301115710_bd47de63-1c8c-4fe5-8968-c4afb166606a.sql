
-- Create order status history table for delivery timeline
CREATE TABLE public.order_status_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  note TEXT,
  tracking_number TEXT,
  courier_name TEXT,
  tracking_link TEXT,
  expected_delivery TEXT,
  changed_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins can manage status history"
ON public.order_status_history
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Users can view status history for their own orders
CREATE POLICY "Users can view own order status history"
ON public.order_status_history
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.orders
  WHERE orders.id = order_status_history.order_id
  AND orders.user_id = auth.uid()
));

-- Public can view status history (for track order by ID)
CREATE POLICY "Public can view order status history"
ON public.order_status_history
FOR SELECT
USING (true);

-- Add tracking columns to orders table for current tracking info
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tracking_number TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS courier_name TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tracking_link TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS expected_delivery TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_note TEXT;
