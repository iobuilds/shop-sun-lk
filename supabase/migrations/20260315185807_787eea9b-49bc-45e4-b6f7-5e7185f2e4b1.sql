-- Remove all broken/old logo HTML from email templates, leaving templates clean for the edge function to inject fresh logo
UPDATE public.email_templates
SET html_body = regexp_replace(
  regexp_replace(
    html_body,
    '<div style="background:#1a1a2e[^"]*"[^>]*padding[^>]*><img src="https://shop-sun-lk\.lovable\.app/site-logo\.png"[^>]*></div>',
    '',
    'g'
  ),
  '<div style="background:#1a1a2e[^"]*"[^>]*padding[^>]*><img src="https://rcefmfiqqqsfurkdljup\.supabase\.co/storage/v1/object/public/images/site-logo\.png"[^>]*></div>',
  '',
  'g'
);