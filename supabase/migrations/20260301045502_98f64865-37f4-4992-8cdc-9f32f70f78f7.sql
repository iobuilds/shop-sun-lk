-- Add cost_price column to products table for profit tracking
ALTER TABLE public.products ADD COLUMN cost_price numeric DEFAULT NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.products.cost_price IS 'Cost price of the product for profit calculation (admin only)';