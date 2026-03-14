-- Allow authenticated admin users to upload/manage files in the db-backups bucket directly
CREATE POLICY "Admins can upload to db-backups"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'db-backups'
  AND public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Admins can update db-backups"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'db-backups'
  AND public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Admins can read db-backups"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'db-backups'
  AND public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Admins can delete db-backups"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'db-backups'
  AND public.has_role(auth.uid(), 'admin')
);
