ALTER TABLE public.preorder_requests 
  ADD COLUMN IF NOT EXISTS slip_url text,
  ADD COLUMN IF NOT EXISTS arrival_slip_url text;