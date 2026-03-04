
-- Allow moderators to view all orders
CREATE POLICY "Moderators can view all orders"
ON public.orders FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'moderator'::app_role));

-- Allow moderators to update orders
CREATE POLICY "Moderators can update orders"
ON public.orders FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'moderator'::app_role));

-- Allow moderators to view all order items
CREATE POLICY "Moderators can view all order items"
ON public.order_items FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'moderator'::app_role));

-- Allow moderators to manage order status history
CREATE POLICY "Moderators can manage status history"
ON public.order_status_history FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'moderator'::app_role));

-- Allow moderators to view profiles (for customer info in orders)
CREATE POLICY "Moderators can view all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'moderator'::app_role));

-- Allow moderators to view products (for order item details)
-- Products already have public SELECT so this is covered

-- Allow moderators to view user roles (needed by useAdminAuth)
CREATE POLICY "Moderators can view own roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);
