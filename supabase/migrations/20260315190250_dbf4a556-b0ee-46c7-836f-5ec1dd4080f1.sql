-- Replace all logo img references with the white version (no CSS filter needed)
-- and remove filter:none (leftover from previous fix)
UPDATE public.email_templates
SET html_body = replace(
  replace(
    replace(
      html_body,
      'https://rcefmfiqqqsfurkdljup.supabase.co/storage/v1/object/public/images/site-logo.svg',
      'https://rcefmfiqqqsfurkdljup.supabase.co/storage/v1/object/public/images/site-logo-white.png'
    ),
    'https://rcefmfiqqqsfurkdljup.supabase.co/storage/v1/object/public/images/site-logo.png',
    'https://rcefmfiqqqsfurkdljup.supabase.co/storage/v1/object/public/images/site-logo-white.png'
  ),
  ';filter:none',
  ''
);