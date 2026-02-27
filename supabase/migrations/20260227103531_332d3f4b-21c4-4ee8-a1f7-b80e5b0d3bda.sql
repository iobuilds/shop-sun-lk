
-- Function to reduce stock when order items are inserted
CREATE OR REPLACE FUNCTION public.reduce_stock_on_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.products
  SET stock_quantity = GREATEST(0, COALESCE(stock_quantity, 0) - NEW.quantity)
  WHERE id = NEW.product_id;
  RETURN NEW;
END;
$$;

-- Trigger on order_items insert
CREATE TRIGGER trg_reduce_stock_on_order
AFTER INSERT ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.reduce_stock_on_order();

-- Admin can view all orders (needed for admin panel)
CREATE POLICY "Admins can view all orders"
ON public.orders
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admin can view all order items
CREATE POLICY "Admins can view all order items"
ON public.order_items
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));
