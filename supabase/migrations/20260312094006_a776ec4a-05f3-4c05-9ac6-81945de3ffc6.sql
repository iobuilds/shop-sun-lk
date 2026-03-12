-- Add code_purpose column to referral_codes table
-- 'discount' = applies a discount at checkout
-- 'reference' = reference/tracking only, no discount applied
ALTER TABLE public.referral_codes 
ADD COLUMN IF NOT EXISTS code_purpose text NOT NULL DEFAULT 'discount'
CHECK (code_purpose IN ('discount', 'reference'));