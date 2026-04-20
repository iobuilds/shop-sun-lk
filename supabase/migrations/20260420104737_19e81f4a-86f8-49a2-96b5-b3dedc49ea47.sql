UPDATE public.sms_templates
SET message_template = REPLACE(REPLACE(REPLACE(REPLACE(
        message_template,
        'techlk.lk', 'nanocircuit.lk'),
        'TechLK',    'NanoCircuit.lk'),
        'TechLk',    'NanoCircuit.lk'),
        'techlk',    'nanocircuit.lk')
WHERE message_template ~* 'techlk';

UPDATE public.pages
SET content = REPLACE(REPLACE(REPLACE(REPLACE(
        content,
        'techlk.lk', 'nanocircuit.lk'),
        'TechLK',    'NanoCircuit.lk'),
        'TechLk',    'NanoCircuit.lk'),
        'techlk',    'nanocircuit.lk')
WHERE content ~* 'techlk';

UPDATE public.pages
SET title = REPLACE(REPLACE(REPLACE(
        title,
        'TechLK',    'NanoCircuit.lk'),
        'TechLk',    'NanoCircuit.lk'),
        'techlk',    'nanocircuit.lk')
WHERE title ~* 'techlk';

UPDATE public.site_settings
SET value = REPLACE(REPLACE(REPLACE(REPLACE(
        value::text,
        'techlk.lk', 'nanocircuit.lk'),
        'TechLK',    'NanoCircuit.lk'),
        'TechLk',    'NanoCircuit.lk'),
        'techlk',    'nanocircuit.lk')::jsonb
WHERE value::text ~* 'techlk';

UPDATE public.email_templates
SET html_body = REPLACE(REPLACE(REPLACE(REPLACE(
        html_body,
        'techlk.lk', 'nanocircuit.lk'),
        'TechLK',    'NanoCircuit.lk'),
        'TechLk',    'NanoCircuit.lk'),
        'techlk',    'nanocircuit.lk'),
    text_body = CASE WHEN text_body IS NULL THEN NULL ELSE
        REPLACE(REPLACE(REPLACE(REPLACE(
            text_body,
            'techlk.lk', 'nanocircuit.lk'),
            'TechLK',    'NanoCircuit.lk'),
            'TechLk',    'NanoCircuit.lk'),
            'techlk',    'nanocircuit.lk')
    END,
    subject = REPLACE(REPLACE(REPLACE(REPLACE(
        subject,
        'techlk.lk', 'nanocircuit.lk'),
        'TechLK',    'NanoCircuit.lk'),
        'TechLk',    'NanoCircuit.lk'),
        'techlk',    'nanocircuit.lk')
WHERE html_body ~* 'techlk' OR COALESCE(text_body,'') ~* 'techlk' OR subject ~* 'techlk';