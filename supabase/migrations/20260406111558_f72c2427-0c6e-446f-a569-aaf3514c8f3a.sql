
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS shipping_source text DEFAULT 'local',
  ADD COLUMN IF NOT EXISTS ships_from text,
  ADD COLUMN IF NOT EXISTS delivery_eta text;
