
-- Create site_settings table for SEO and general site configuration
CREATE TABLE public.site_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view site settings"
  ON public.site_settings FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert site settings"
  ON public.site_settings FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update site settings"
  ON public.site_settings FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete site settings"
  ON public.site_settings FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Seed default SEO settings
INSERT INTO public.site_settings (key, value) VALUES
  ('seo', '{"store_name": "TechLK", "tagline": "Sri Lanka''s #1 Electronics Store", "meta_description": "Shop Arduino boards, sensors, 3D printing supplies, and electronic components. Best prices in Sri Lanka with fast delivery.", "meta_keywords": "electronics, arduino, sensors, 3d printing, Sri Lanka, electronic components, microcontrollers", "og_image": "", "google_analytics_id": "", "facebook_pixel_id": ""}'::jsonb);
