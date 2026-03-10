
-- Pre-order requests table
CREATE TABLE public.preorder_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  -- statuses: pending, quoted, approved, sourcing, arrived, completed, cancelled
  admin_notes text,
  customer_note text,
  unit_cost_total numeric DEFAULT 0,
  shipping_fee numeric DEFAULT 0,
  tax_amount numeric DEFAULT 0,
  grand_total numeric GENERATED ALWAYS AS (unit_cost_total + shipping_fee + tax_amount) STORED,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Pre-order items table
CREATE TABLE public.preorder_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  preorder_id uuid NOT NULL REFERENCES public.preorder_requests(id) ON DELETE CASCADE,
  -- Either a store product or an external link
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  external_url text,
  quantity integer NOT NULL DEFAULT 1,
  expected_date date,
  unit_price numeric, -- admin fills when quoting
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_preorder_requests_user_id ON public.preorder_requests(user_id);
CREATE INDEX idx_preorder_requests_status ON public.preorder_requests(status);
CREATE INDEX idx_preorder_items_preorder_id ON public.preorder_items(preorder_id);

-- RLS
ALTER TABLE public.preorder_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preorder_items ENABLE ROW LEVEL SECURITY;

-- preorder_requests policies
CREATE POLICY "Users can create own preorder requests"
  ON public.preorder_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own preorder requests"
  ON public.preorder_requests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all preorder requests"
  ON public.preorder_requests FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update preorder requests"
  ON public.preorder_requests FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete preorder requests"
  ON public.preorder_requests FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Moderators can view preorder requests"
  ON public.preorder_requests FOR SELECT
  USING (has_role(auth.uid(), 'moderator'::app_role));

-- preorder_items policies
CREATE POLICY "Users can insert items for own request"
  ON public.preorder_items FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.preorder_requests
    WHERE id = preorder_items.preorder_id AND user_id = auth.uid()
  ));

CREATE POLICY "Users can view items for own request"
  ON public.preorder_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.preorder_requests
    WHERE id = preorder_items.preorder_id AND user_id = auth.uid()
  ));

CREATE POLICY "Admins can manage preorder items"
  ON public.preorder_items FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Updated at trigger
CREATE TRIGGER update_preorder_requests_updated_at
  BEFORE UPDATE ON public.preorder_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
