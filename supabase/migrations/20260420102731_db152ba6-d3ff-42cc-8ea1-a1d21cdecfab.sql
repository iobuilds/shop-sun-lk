-- Allow authenticated users to upload Gerber files (PCB orders) and other user content folders to images bucket
CREATE POLICY "Users can upload pcb-gerbers"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'images' AND (storage.foldername(name))[1] = 'pcb-gerbers');

CREATE POLICY "Users can read pcb-gerbers"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'images' AND (storage.foldername(name))[1] = 'pcb-gerbers');

-- Also allow authenticated users to upload general user-content (preorder slips, arrival slips, etc.)
CREATE POLICY "Users can upload slips"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'images'
  AND (storage.foldername(name))[1] = ANY (ARRAY['slips', 'arrival-slips', 'preorder-slips', 'pcb-slips', 'attachments'])
);

CREATE POLICY "Users can read slips"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'images'
  AND (storage.foldername(name))[1] = ANY (ARRAY['slips', 'arrival-slips', 'preorder-slips', 'pcb-slips', 'attachments', 'pcb-gerbers'])
);