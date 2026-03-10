
-- Allow users to update payment_status and arrival_payment_status on their own requests
DROP POLICY IF EXISTS "Users can update own preorder payment status" ON public.preorder_requests;
CREATE POLICY "Users can update own preorder payment status"
ON public.preorder_requests
FOR UPDATE
TO public
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
