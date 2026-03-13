
-- Create sms_scheduled_campaigns table
CREATE TABLE public.sms_scheduled_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phones JSONB NOT NULL DEFAULT '[]'::jsonb,
  message TEXT NOT NULL,
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled',
  sent_at TIMESTAMP WITH TIME ZONE,
  recipient_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  provider_response JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.sms_scheduled_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage scheduled campaigns"
  ON public.sms_scheduled_campaigns
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
