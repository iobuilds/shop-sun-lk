
-- Add attachment fields to products table
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS video_url text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS datasheet_url text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT '[]'::jsonb;

-- Add comment for clarity
COMMENT ON COLUMN public.products.video_url IS 'Product video URL (YouTube, etc.)';
COMMENT ON COLUMN public.products.datasheet_url IS 'Product datasheet/PDF URL';
COMMENT ON COLUMN public.products.attachments IS 'Array of {name, url, type} for additional files';
