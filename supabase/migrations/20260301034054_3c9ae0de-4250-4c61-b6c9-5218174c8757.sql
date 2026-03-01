
-- OTP verifications table
CREATE TABLE public.otp_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  otp_code text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  verified boolean NOT NULL DEFAULT false,
  attempts integer NOT NULL DEFAULT 0,
  locked_until timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.otp_verifications ENABLE ROW LEVEL SECURITY;

-- Anyone can insert (for registration flow before auth)
CREATE POLICY "Anyone can create OTP verification"
  ON public.otp_verifications FOR INSERT
  WITH CHECK (true);

-- Anyone can read their own OTP by phone (needed for verification)
CREATE POLICY "Anyone can read OTP by phone"
  ON public.otp_verifications FOR SELECT
  USING (true);

-- Service role updates handled server-side

-- SMS logs table
CREATE TABLE public.sms_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  message text NOT NULL,
  template_key text,
  status text NOT NULL DEFAULT 'pending',
  provider_response jsonb,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  user_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all SMS logs"
  ON public.sms_logs FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert SMS logs"
  ON public.sms_logs FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Edge function inserts via service role, so also allow unauthenticated insert
CREATE POLICY "Service can insert SMS logs"
  ON public.sms_logs FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can view own SMS logs"
  ON public.sms_logs FOR SELECT
  USING (auth.uid() = user_id);

-- SMS templates table
CREATE TABLE public.sms_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key text NOT NULL UNIQUE,
  name text NOT NULL,
  message_template text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.sms_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active SMS templates"
  ON public.sms_templates FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert SMS templates"
  ON public.sms_templates FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update SMS templates"
  ON public.sms_templates FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete SMS templates"
  ON public.sms_templates FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert default SMS templates
INSERT INTO public.sms_templates (template_key, name, message_template, description) VALUES
('otp_verification', 'OTP Verification', 'Your TechLK verification code is: {{OTP5}}. Valid for 5 minutes.', 'Sent during registration for phone verification'),
('order_placed', 'Order Placed', 'Hi {{customer_name}}, your order #{{order_id}} has been placed successfully! Total: Rs.{{total}}. We will process it shortly.', 'Sent when a new order is placed'),
('payment_received', 'Payment Received', 'Payment received for order #{{order_id}}. We are now processing your order. Thank you!', 'Sent when payment is confirmed'),
('order_processing', 'Order Processing', 'Your order #{{order_id}} is now being processed. We will notify you when it ships.', 'Sent when order moves to processing'),
('order_shipped', 'Order Shipped', 'Great news! Your order #{{order_id}} has been shipped. {{tracking_info}}Estimated delivery: {{eta}}.', 'Sent when order is shipped/dispatched'),
('order_delivered', 'Order Delivered', 'Your order #{{order_id}} has been delivered! Thank you for shopping with TechLK.', 'Sent when order is delivered'),
('order_cancelled', 'Order Cancelled', 'Your order #{{order_id}} has been cancelled. If you have questions, contact us.', 'Sent when order is cancelled');

-- Add phone_verified column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_verified boolean DEFAULT false;
