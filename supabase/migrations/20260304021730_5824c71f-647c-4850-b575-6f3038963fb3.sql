
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (
    user_id,
    full_name,
    phone,
    phone_verified,
    address_line1,
    address_line2,
    city,
    postal_code
  )
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'phone',
    COALESCE((NEW.raw_user_meta_data ->> 'phone_verified')::boolean, false),
    NEW.raw_user_meta_data ->> 'address_line1',
    NEW.raw_user_meta_data ->> 'address_line2',
    NEW.raw_user_meta_data ->> 'city',
    NEW.raw_user_meta_data ->> 'postal_code'
  );
  RETURN NEW;
END;
$function$;
