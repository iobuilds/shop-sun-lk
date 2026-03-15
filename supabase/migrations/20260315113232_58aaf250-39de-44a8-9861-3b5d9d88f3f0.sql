
-- Component Families table (e.g. "Resistor", "Capacitor", "LED", etc.)
CREATE TABLE public.component_families (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,                          -- e.g. "Resistor"
  slug TEXT NOT NULL UNIQUE,                   -- e.g. "resistor"
  component_type TEXT NOT NULL,                -- e.g. "resistor", "capacitor", "ic", "diode", etc.
  description TEXT,
  images TEXT[] DEFAULT '{}'::TEXT[],          -- shared family images
  datasheet_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Component Variants table (each row = one selectable SKU)
CREATE TABLE public.component_variants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  family_id UUID NOT NULL REFERENCES public.component_families(id) ON DELETE CASCADE,
  -- Core parametric attributes
  mount_type TEXT NOT NULL DEFAULT 'SMD',      -- 'SMD' | 'Through-hole'
  value TEXT,                                  -- e.g. "10kΩ", "100nF", "5mm"
  package TEXT,                                -- e.g. "0402", "0603", "DIP-8", "TO-92"
  tolerance TEXT,                              -- e.g. "1%", "5%", "10%"
  wattage TEXT,                                -- e.g. "1/4W", "1W"
  voltage_rating TEXT,                         -- for caps/diodes
  extra_specs JSONB DEFAULT '{}'::JSONB,       -- any other parameters
  -- Pricing & stock
  price NUMERIC NOT NULL DEFAULT 0,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  is_available BOOLEAN NOT NULL DEFAULT true,  -- admin toggleable availability
  sku TEXT,
  -- Per-variant overrides
  images TEXT[] DEFAULT '{}'::TEXT[],          -- override family images if set
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes for fast filtering
CREATE INDEX idx_component_variants_family_id ON public.component_variants(family_id);
CREATE INDEX idx_component_variants_mount_type ON public.component_variants(mount_type);
CREATE INDEX idx_component_variants_value ON public.component_variants(value);
CREATE INDEX idx_component_variants_package ON public.component_variants(package);
CREATE INDEX idx_component_families_type ON public.component_families(component_type);
CREATE INDEX idx_component_families_slug ON public.component_families(slug);

-- Timestamps trigger
CREATE TRIGGER update_component_families_updated_at
  BEFORE UPDATE ON public.component_families
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_component_variants_updated_at
  BEFORE UPDATE ON public.component_variants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.component_families ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.component_variants ENABLE ROW LEVEL SECURITY;

-- Public: read active families
CREATE POLICY "Anyone can view active component families"
  ON public.component_families FOR SELECT
  USING (is_active = true);

-- Admin: full access families
CREATE POLICY "Admins can manage component families"
  ON public.component_families FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Public: read available variants
CREATE POLICY "Anyone can view available component variants"
  ON public.component_variants FOR SELECT
  USING (is_available = true);

-- Admin: full access variants
CREATE POLICY "Admins can manage component variants"
  ON public.component_variants FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
