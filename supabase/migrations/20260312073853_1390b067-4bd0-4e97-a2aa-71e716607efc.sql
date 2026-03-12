
-- Create admin activity logs table
CREATE TABLE IF NOT EXISTS public.admin_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  admin_id uuid NOT NULL,
  admin_email text,
  action text NOT NULL,
  target_type text,
  target_id text,
  details jsonb DEFAULT '{}',
  ip_address text
);

-- RLS: only admins can view/manage logs
ALTER TABLE public.admin_activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view activity logs"
  ON public.admin_activity_logs FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service can insert activity logs"
  ON public.admin_activity_logs FOR INSERT
  WITH CHECK (true);

-- Index for performance
CREATE INDEX admin_activity_logs_admin_id_idx ON public.admin_activity_logs (admin_id);
CREATE INDEX admin_activity_logs_created_at_idx ON public.admin_activity_logs (created_at DESC);
CREATE INDEX admin_activity_logs_action_idx ON public.admin_activity_logs (action);
