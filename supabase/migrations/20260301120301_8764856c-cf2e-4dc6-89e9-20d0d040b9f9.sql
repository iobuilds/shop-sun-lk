
-- Create storage bucket for database backups
INSERT INTO storage.buckets (id, name, public) VALUES ('db-backups', 'db-backups', false)
ON CONFLICT (id) DO NOTHING;

-- RLS: Only admins can access backup files
CREATE POLICY "Admins can manage backup files"
ON storage.objects
FOR ALL
USING (bucket_id = 'db-backups' AND public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (bucket_id = 'db-backups' AND public.has_role(auth.uid(), 'admin'::public.app_role));

-- Create backup logs table
CREATE TABLE public.db_backup_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL, -- 'backup' or 'restore'
  file_name text NOT NULL,
  file_size bigint,
  created_by uuid REFERENCES auth.users(id),
  created_by_email text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.db_backup_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage backup logs"
ON public.db_backup_logs
FOR ALL
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
