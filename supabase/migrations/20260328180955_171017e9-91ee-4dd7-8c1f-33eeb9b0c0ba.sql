
-- Update handle_new_user to auto-assign manager role to first user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE 
  default_casino_id UUID;
  user_count INTEGER;
BEGIN
  SELECT id INTO default_casino_id FROM public.casinos LIMIT 1;
  
  INSERT INTO public.profiles (user_id, casino_id, display_name)
  VALUES (NEW.id, default_casino_id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  
  -- Count existing users to determine if this is the first user
  SELECT COUNT(*) INTO user_count FROM public.profiles;
  
  -- First user gets all roles (bootstrap manager)
  IF user_count <= 1 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES 
      (NEW.id, 'manager'),
      (NEW.id, 'cashier'),
      (NEW.id, 'pit'),
      (NEW.id, 'reception');
  END IF;
  
  RETURN NEW;
END;
$$;

-- Seed gaming tables for Main Casino
INSERT INTO public.gaming_tables (casino_id, name, game, status, float_amount, denominations)
SELECT c.id, t.name, t.game, 'open'::table_status, t.float_amount, t.denominations
FROM public.casinos c
CROSS JOIN (VALUES 
  ('Table 1', 'Blackjack', 50000.00, ARRAY[5,25,100,500,1000]),
  ('Table 2', 'Blackjack', 50000.00, ARRAY[5,25,100,500,1000]),
  ('Table 3', 'Roulette', 75000.00, ARRAY[5,25,100,500,1000,5000]),
  ('Table 4', 'Baccarat', 100000.00, ARRAY[25,100,500,1000,5000]),
  ('Table 5', 'Poker', 60000.00, ARRAY[5,25,100,500,1000]),
  ('Table 6', 'Blackjack', 50000.00, ARRAY[5,25,100,500,1000])
) AS t(name, game, float_amount, denominations)
WHERE c.code = 'MAIN'
ON CONFLICT DO NOTHING;

-- Seed dealers for Main Casino
INSERT INTO public.dealers (casino_id, name)
SELECT c.id, d.name
FROM public.casinos c
CROSS JOIN (VALUES 
  ('Alex K.'), ('Maria S.'), ('David P.'), ('Elena R.'),
  ('James W.'), ('Sophie L.'), ('Marco B.'), ('Anna T.'),
  ('Robert C.'), ('Lisa M.')
) AS d(name)
WHERE c.code = 'MAIN'
ON CONFLICT DO NOTHING;

-- Add more tag conflicts for validation
INSERT INTO public.tag_conflicts (tag_a, tag_b) VALUES 
  ('Free Food', 'No Food')
ON CONFLICT DO NOTHING;
