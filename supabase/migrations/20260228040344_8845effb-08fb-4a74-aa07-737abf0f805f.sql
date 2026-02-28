
-- Create promo_banners table for below-hero promotional banners
CREATE TABLE public.promo_banners (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  subtitle text,
  description text,
  image_url text NOT NULL DEFAULT '',
  link_url text,
  badge_text text,
  gradient_from text DEFAULT 'primary',
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.promo_banners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Promo banners viewable by everyone" ON public.promo_banners FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can view all promo banners" ON public.promo_banners FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert promo banners" ON public.promo_banners FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update promo banners" ON public.promo_banners FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete promo banners" ON public.promo_banners FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Seed default promo banners
INSERT INTO public.promo_banners (title, subtitle, description, badge_text, image_url, link_url, gradient_from, sort_order) VALUES
('Combo Starter Packs', 'Save up to 25%', 'Get everything you need in one box. Perfect for beginners.', 'Save up to 25%', '', '/category/combo-packs', 'primary', 0),
('Daily Deals Live Now', '⚡ Flash Sale', 'Up to 40% off on selected electronics. Limited stock!', '⚡ Flash Sale', '', '/daily-deals', 'destructive', 1);
