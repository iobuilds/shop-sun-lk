ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS shipping_type text;

ALTER TABLE public.products
  ALTER COLUMN shipping_source SET DEFAULT 'local';

ALTER TABLE public.products
  ALTER COLUMN shipping_type SET DEFAULT 'local';

ALTER TABLE public.combo_packs
  ADD COLUMN IF NOT EXISTS shipping_source text DEFAULT 'local',
  ADD COLUMN IF NOT EXISTS ships_from text,
  ADD COLUMN IF NOT EXISTS delivery_eta text,
  ADD COLUMN IF NOT EXISTS shipping_type text;

ALTER TABLE public.combo_packs
  ALTER COLUMN shipping_source SET DEFAULT 'local';

ALTER TABLE public.combo_packs
  ALTER COLUMN shipping_type SET DEFAULT 'local';

UPDATE public.products
SET
  shipping_source = COALESCE(NULLIF(shipping_source, ''), NULLIF(shipping_type, ''), NULLIF(specifications->>'_shipping_type', ''), 'local'),
  shipping_type = COALESCE(NULLIF(shipping_source, ''), NULLIF(shipping_type, ''), NULLIF(specifications->>'_shipping_type', ''), 'local'),
  ships_from = COALESCE(NULLIF(ships_from, ''), NULLIF(specifications->>'_ships_from', '')),
  delivery_eta = COALESCE(NULLIF(delivery_eta, ''), NULLIF(specifications->>'_delivery_eta', ''));

UPDATE public.combo_packs
SET
  shipping_source = COALESCE(NULLIF(shipping_source, ''), NULLIF(shipping_type, ''), 'local'),
  shipping_type = COALESCE(NULLIF(shipping_source, ''), NULLIF(shipping_type, ''), 'local');

CREATE OR REPLACE FUNCTION public.sync_shipping_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.shipping_source IS NOT NULL AND btrim(NEW.shipping_source) <> '' THEN
    NEW.shipping_source := lower(NEW.shipping_source);
    NEW.shipping_type := NEW.shipping_source;
  ELSIF NEW.shipping_type IS NOT NULL AND btrim(NEW.shipping_type) <> '' THEN
    NEW.shipping_type := lower(NEW.shipping_type);
    NEW.shipping_source := NEW.shipping_type;
  ELSE
    NEW.shipping_source := 'local';
    NEW.shipping_type := 'local';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_products_shipping_columns ON public.products;
CREATE TRIGGER sync_products_shipping_columns
BEFORE INSERT OR UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.sync_shipping_columns();

DROP TRIGGER IF EXISTS sync_combo_packs_shipping_columns ON public.combo_packs;
CREATE TRIGGER sync_combo_packs_shipping_columns
BEFORE INSERT OR UPDATE ON public.combo_packs
FOR EACH ROW
EXECUTE FUNCTION public.sync_shipping_columns();