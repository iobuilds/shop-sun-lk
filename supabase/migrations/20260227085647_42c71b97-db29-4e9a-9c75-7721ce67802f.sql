
-- Allow admins to manage products
CREATE POLICY "Admins can insert products"
  ON public.products FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update products"
  ON public.products FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete products"
  ON public.products FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to manage categories
CREATE POLICY "Admins can insert categories"
  ON public.categories FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update categories"
  ON public.categories FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete categories"
  ON public.categories FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to manage banners
CREATE POLICY "Admins can insert banners"
  ON public.banners FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update banners"
  ON public.banners FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete banners"
  ON public.banners FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- Also allow admins to see inactive banners
DROP POLICY IF EXISTS "Banners are viewable by everyone" ON public.banners;
CREATE POLICY "Public can view active banners"
  ON public.banners FOR SELECT
  USING (is_active = true);
CREATE POLICY "Admins can view all banners"
  ON public.banners FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));
