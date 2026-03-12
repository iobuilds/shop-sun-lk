
CREATE TABLE IF NOT EXISTS public.moderator_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  can_manage_orders boolean NOT NULL DEFAULT true,
  can_manage_preorders boolean NOT NULL DEFAULT false,
  can_manage_pcb_orders boolean NOT NULL DEFAULT false,
  can_view_contacts boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.moderator_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage moderator permissions"
  ON public.moderator_permissions
  FOR ALL
  TO public
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Moderators can view own permissions"
  ON public.moderator_permissions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
