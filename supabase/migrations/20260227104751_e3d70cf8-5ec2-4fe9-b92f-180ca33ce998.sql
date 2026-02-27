
-- 1. Add receipt_url to orders for bank transfer receipts
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS receipt_url text;

-- 2. Allow users to update their own orders (for receipt upload only)
CREATE POLICY "Users can update own orders receipt"
ON public.orders
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 3. Create pages table for static CMS content
CREATE TABLE public.pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  is_published boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pages are viewable by everyone"
ON public.pages FOR SELECT
USING (is_published = true);

CREATE POLICY "Admins can view all pages"
ON public.pages FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert pages"
ON public.pages FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update pages"
ON public.pages FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete pages"
ON public.pages FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_pages_updated_at
BEFORE UPDATE ON public.pages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Seed default static pages
INSERT INTO public.pages (slug, title, content) VALUES
  ('about-us', 'About Us', 'Welcome to TechLK – Sri Lanka''s premier destination for electronics, Arduino boards, sensors, 3D printing supplies, and more. We are passionate about empowering makers, hobbyists, students, and professionals with high-quality components at competitive prices.\n\nFounded in Colombo, TechLK has grown to serve thousands of customers across the island with fast, reliable delivery and expert support.\n\nOur mission is to make technology accessible to everyone in Sri Lanka.'),
  ('contact', 'Contact Us', '**Address:** No. 42, Galle Road, Colombo 03, Sri Lanka\n\n**Phone:** +94 77 123 4567\n\n**Email:** info@techlk.lk\n\n**Business Hours:** Monday – Saturday, 9:00 AM – 6:00 PM\n\nFeel free to reach out for any inquiries, bulk orders, or support.'),
  ('refund-policy', 'Refund Policy', '**Returns & Refunds**\n\nWe accept returns within 7 days of delivery for defective or incorrect items. To initiate a return, please contact our support team with your order ID.\n\n**Conditions:**\n- Item must be unused and in original packaging\n- Proof of purchase required\n- Shipping costs for returns are borne by the customer unless the item is defective\n\n**Refund Process:**\nOnce we receive the returned item, refunds will be processed within 5–7 business days to the original payment method.'),
  ('privacy-policy', 'Privacy Policy', '**Your Privacy Matters**\n\nTechLK collects personal information (name, email, phone, address) solely for order processing and delivery.\n\n**We do not:**\n- Sell your data to third parties\n- Store payment card details on our servers\n- Share data without your consent\n\n**Security:**\nAll transactions are encrypted using SSL. Payment processing is handled securely via Stripe.'),
  ('terms', 'Terms & Conditions', '**Terms of Service**\n\nBy using TechLK, you agree to these terms:\n\n1. Products are subject to availability\n2. Prices are in Sri Lankan Rupees (LKR) and may change without notice\n3. We reserve the right to cancel orders for any reason\n4. Warranty claims are handled per manufacturer policy\n5. Users must be 18+ to place orders\n\n**Limitation of Liability:**\nTechLK is not liable for damages arising from product misuse or modification.');

-- 5. Storage policy for receipt uploads
CREATE POLICY "Users can upload receipts"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'images' AND (storage.foldername(name))[1] = 'receipts');

CREATE POLICY "Users can view receipts"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'images' AND (storage.foldername(name))[1] = 'receipts');
