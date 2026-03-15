-- Fix 1: Remove CSS filter from logo (doesn't work in email clients) and use white text logo approach
-- Fix 2: Replace all shop-sun-lk.lovable.app references with nanocircuit.lk
UPDATE public.email_templates
SET html_body = replace(
  replace(
    replace(
      html_body,
      'filter:brightness(0) invert(1)',
      'filter:none'
    ),
    'https://shop-sun-lk.lovable.app/profile',
    'https://nanocircuit.lk/profile'
  ),
  'https://shop-sun-lk.lovable.app',
  'https://nanocircuit.lk'
);

-- Fix 3: Replace the logo PNG (dark) with the SVG which renders cleanly at any color
UPDATE public.email_templates
SET html_body = replace(
  html_body,
  'https://rcefmfiqqqsfurkdljup.supabase.co/storage/v1/object/public/images/site-logo.png',
  'https://rcefmfiqqqsfurkdljup.supabase.co/storage/v1/object/public/images/site-logo.svg'
);