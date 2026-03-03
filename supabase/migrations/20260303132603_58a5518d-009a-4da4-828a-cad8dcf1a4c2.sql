
-- Function to assign a user to the demo brand as admin (first user) or operador (subsequent)
CREATE OR REPLACE FUNCTION public.assign_default_brand_role()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _brand_id UUID := '00000000-0000-0000-0000-000000000001';
  _role app_role;
  _count INT;
BEGIN
  -- Check if any users already have a role for this brand
  SELECT COUNT(*) INTO _count FROM public.user_roles WHERE brand_id = _brand_id;
  
  IF _count = 0 THEN
    _role := 'admin';
  ELSE
    _role := 'operador';
  END IF;
  
  INSERT INTO public.user_roles (user_id, brand_id, role)
  VALUES (NEW.id, _brand_id, _role)
  ON CONFLICT (user_id, brand_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Trigger: assign brand role after user creation
CREATE TRIGGER on_auth_user_created_assign_role
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_default_brand_role();
