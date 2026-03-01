
-- Allow admins to delete SMS logs
CREATE POLICY "Admins can delete SMS logs"
ON public.sms_logs
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));
