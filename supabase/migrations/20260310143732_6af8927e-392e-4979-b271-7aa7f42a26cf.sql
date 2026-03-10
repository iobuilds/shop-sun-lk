
-- PCB Order Requests table
CREATE TABLE public.pcb_order_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  payment_status TEXT NOT NULL DEFAULT 'unpaid',
  arrival_payment_status TEXT NOT NULL DEFAULT 'unpaid',
  quantity INTEGER NOT NULL DEFAULT 1,
  layer_count INTEGER NOT NULL DEFAULT 2,
  surface_finish TEXT NOT NULL DEFAULT 'HASL',
  board_thickness TEXT NOT NULL DEFAULT '1.6mm',
  pcb_color TEXT NOT NULL DEFAULT 'Green',
  customer_note TEXT,
  admin_notes TEXT,
  unit_cost_total NUMERIC DEFAULT 0,
  shipping_fee NUMERIC DEFAULT 0,
  tax_amount NUMERIC DEFAULT 0,
  grand_total NUMERIC,
  arrival_shipping_fee NUMERIC,
  arrival_tax_amount NUMERIC,
  slip_url TEXT,
  arrival_slip_url TEXT,
  gerber_file_url TEXT,
  gerber_file_name TEXT,
  quoted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.pcb_order_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create own PCB requests" ON public.pcb_order_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own PCB requests" ON public.pcb_order_requests
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own PCB requests" ON public.pcb_order_requests
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all PCB requests" ON public.pcb_order_requests
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update PCB requests" ON public.pcb_order_requests
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete PCB requests" ON public.pcb_order_requests
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_pcb_order_requests_updated_at
  BEFORE UPDATE ON public.pcb_order_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.set_pcb_quoted_at()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'quoted' AND (OLD.status IS DISTINCT FROM 'quoted') THEN
    NEW.quoted_at = now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_pcb_quoted_at_trigger
  BEFORE UPDATE ON public.pcb_order_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_pcb_quoted_at();
