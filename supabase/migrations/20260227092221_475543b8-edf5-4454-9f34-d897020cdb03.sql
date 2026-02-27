
-- Allow admins to insert daily deals
CREATE POLICY "Admins can insert deals"
ON public.daily_deals
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Allow admins to update daily deals
CREATE POLICY "Admins can update deals"
ON public.daily_deals
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to delete daily deals
CREATE POLICY "Admins can delete deals"
ON public.daily_deals
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to view all deals (including inactive)
CREATE POLICY "Admins can view all deals"
ON public.daily_deals
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to update orders (status, payment)
CREATE POLICY "Admins can update orders"
ON public.orders
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
