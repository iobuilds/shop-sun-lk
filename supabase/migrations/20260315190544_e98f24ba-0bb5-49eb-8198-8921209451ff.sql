UPDATE public.email_templates
SET html_body = replace(html_body, 'shop-sun-lk.lovable.app', 'nanocircuit.lk')
WHERE html_body LIKE '%shop-sun-lk.lovable.app%';