CREATE POLICY "Users can upload pcb-revision-slips"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'images' AND (storage.foldername(name))[1] = 'pcb-revision-slips');

CREATE POLICY "Users can read pcb-revision-slips"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'images' AND (storage.foldername(name))[1] = 'pcb-revision-slips');

CREATE POLICY "Users can upload chat-attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'images' AND (storage.foldername(name))[1] = 'chat-attachments');

CREATE POLICY "Users can read chat-attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'images' AND (storage.foldername(name))[1] = 'chat-attachments');