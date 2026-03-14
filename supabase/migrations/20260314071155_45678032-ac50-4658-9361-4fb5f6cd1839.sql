CREATE TABLE public.image_designs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'Untitled Design',
  canvas_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  canvas_width INTEGER NOT NULL DEFAULT 1080,
  canvas_height INTEGER NOT NULL DEFAULT 1080,
  thumbnail_url TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.image_designs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage image designs"
ON public.image_designs FOR ALL TO public
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Moderators can manage image designs"
ON public.image_designs FOR ALL TO authenticated
USING (has_role(auth.uid(), 'moderator'::app_role))
WITH CHECK (has_role(auth.uid(), 'moderator'::app_role));

CREATE TRIGGER update_image_designs_updated_at
BEFORE UPDATE ON public.image_designs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();