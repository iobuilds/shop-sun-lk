
-- Create storage bucket for product and category images
INSERT INTO storage.buckets (id, name, public) VALUES ('images', 'images', true);

-- Allow anyone to view images
CREATE POLICY "Images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'images');

-- Allow admins to upload images
CREATE POLICY "Admins can upload images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'images' AND public.has_role(auth.uid(), 'admin'::public.app_role));

-- Allow admins to update images
CREATE POLICY "Admins can update images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'images' AND public.has_role(auth.uid(), 'admin'::public.app_role));

-- Allow admins to delete images
CREATE POLICY "Admins can delete images"
ON storage.objects FOR DELETE
USING (bucket_id = 'images' AND public.has_role(auth.uid(), 'admin'::public.app_role));
