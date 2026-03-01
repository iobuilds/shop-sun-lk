
-- Table for external reference links per product
CREATE TABLE public.product_external_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  url TEXT NOT NULL,
  link_type TEXT NOT NULL DEFAULT 'other',
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for similar/alternative product mappings
CREATE TABLE public.product_similar_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  similar_product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL DEFAULT 'similar',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(product_id, similar_product_id)
);

-- Enable RLS
ALTER TABLE public.product_external_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_similar_items ENABLE ROW LEVEL SECURITY;

-- RLS: everyone can view, admins can manage
CREATE POLICY "External links viewable by everyone" ON public.product_external_links
  FOR SELECT USING (true);
CREATE POLICY "Admins can insert external links" ON public.product_external_links
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update external links" ON public.product_external_links
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete external links" ON public.product_external_links
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Similar items viewable by everyone" ON public.product_similar_items
  FOR SELECT USING (true);
CREATE POLICY "Admins can insert similar items" ON public.product_similar_items
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update similar items" ON public.product_similar_items
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete similar items" ON public.product_similar_items
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Indexes for performance
CREATE INDEX idx_product_external_links_product_id ON public.product_external_links(product_id);
CREATE INDEX idx_product_similar_items_product_id ON public.product_similar_items(product_id);
CREATE INDEX idx_product_similar_items_similar_id ON public.product_similar_items(similar_product_id);
