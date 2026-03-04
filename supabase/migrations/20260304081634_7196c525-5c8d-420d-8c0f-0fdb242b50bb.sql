
-- Allow moderators to view all conversations
CREATE POLICY "Moderators can view all conversations"
ON public.conversations FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'moderator'::app_role));

-- Allow moderators to update conversations
CREATE POLICY "Moderators can update conversations"
ON public.conversations FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'moderator'::app_role));

-- Allow moderators to view all conversation messages
CREATE POLICY "Moderators can view all messages"
ON public.conversation_messages FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'moderator'::app_role));

-- Allow moderators to insert messages (reply to customers)
CREATE POLICY "Moderators can insert messages"
ON public.conversation_messages FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'moderator'::app_role));

-- Allow moderators to update messages (mark as read)
CREATE POLICY "Moderators can update messages"
ON public.conversation_messages FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'moderator'::app_role));

-- Allow moderators to view contact messages
CREATE POLICY "Moderators can view contact messages"
ON public.contact_messages FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'moderator'::app_role));

-- Allow moderators to update contact messages (mark as read)
CREATE POLICY "Moderators can update contact messages"
ON public.contact_messages FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'moderator'::app_role));
