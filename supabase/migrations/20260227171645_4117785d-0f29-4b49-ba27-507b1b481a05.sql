
-- Combo Packs system
CREATE TABLE public.combo_packs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  images TEXT[] DEFAULT '{}'::TEXT[],
  combo_price NUMERIC NOT NULL DEFAULT 0,
  original_price NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.combo_pack_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  combo_id UUID NOT NULL REFERENCES public.combo_packs(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.combo_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.combo_pack_items ENABLE ROW LEVEL SECURITY;

-- Combo packs public read
CREATE POLICY "Combo packs viewable by everyone" ON public.combo_packs FOR SELECT USING (true);
CREATE POLICY "Admins can insert combo packs" ON public.combo_packs FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update combo packs" ON public.combo_packs FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete combo packs" ON public.combo_packs FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- Combo pack items public read
CREATE POLICY "Combo pack items viewable by everyone" ON public.combo_pack_items FOR SELECT USING (true);
CREATE POLICY "Admins can insert combo pack items" ON public.combo_pack_items FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update combo pack items" ON public.combo_pack_items FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete combo pack items" ON public.combo_pack_items FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- Admins can view all reviews (for moderation)
CREATE POLICY "Admins can view all reviews" ON public.reviews FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete reviews" ON public.reviews FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- Admins can view profiles for user management
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Trigger for combo_packs updated_at
CREATE TRIGGER update_combo_packs_updated_at
BEFORE UPDATE ON public.combo_packs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
