
-- Create stock_receipts table to log each stock-in event
CREATE TABLE public.stock_receipts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  lcsc_part_number text,
  mpn text,
  qty_received integer NOT NULL DEFAULT 0,
  buy_price numeric,
  buy_date date NOT NULL DEFAULT CURRENT_DATE,
  order_reference text,
  notes text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.stock_receipts ENABLE ROW LEVEL SECURITY;

-- Only admins can manage stock receipts
CREATE POLICY "Admins can manage stock receipts"
  ON public.stock_receipts
  FOR ALL
  TO public
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Index for fast lookup by product
CREATE INDEX idx_stock_receipts_product_id ON public.stock_receipts(product_id);
CREATE INDEX idx_stock_receipts_lcsc_part ON public.stock_receipts(lcsc_part_number);
