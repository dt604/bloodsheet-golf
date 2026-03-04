-- Update the handle_new_user trigger function to grant 1000 Blood Coins to new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  admin_id uuid := '0175505e-7d16-4d58-9160-f2503e04242c';
  new_chat_id uuid;
BEGIN
  -- 1. Insert/Update Profile
  INSERT INTO public.profiles (id, full_name, avatar_url, handicap, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    NEW.raw_user_meta_data->>'avatar_url',
    COALESCE((NEW.raw_user_meta_data->>'handicap')::DECIMAL, 0.0),
    NEW.email
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    avatar_url = COALESCE(public.profiles.avatar_url, EXCLUDED.avatar_url),
    handicap = CASE WHEN public.profiles.handicap = 0 THEN EXCLUDED.handicap ELSE public.profiles.handicap END;

  -- 2. Auto-friend Admin & Send Welcome Message
  -- Check if admin exists and we are not the admin
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = admin_id) AND NEW.id != admin_id THEN
    -- Create Friendship
    INSERT INTO public.friendships (requester_id, addressee_id, status)
    VALUES (admin_id, NEW.id, 'accepted')
    ON CONFLICT DO NOTHING;

    -- Create Direct Chat
    INSERT INTO public.chats (type)
    VALUES ('direct')
    RETURNING id INTO new_chat_id;

    -- Add Participants
    INSERT INTO public.chat_participants (chat_id, user_id)
    VALUES (new_chat_id, admin_id), (new_chat_id, NEW.id);

    -- Send Welcome Message
    INSERT INTO public.messages (chat_id, user_id, content)
    VALUES (new_chat_id, admin_id, 'Welcome to BloodSheet! I''m Danny, the founder. Glad to have you on the green. Let me know if you have any questions!');
  END IF;

  -- 3. Initial Blood Coin Grant
  -- Check if they already got it (just in case)
  IF NOT EXISTS (SELECT 1 FROM public.wallet_transactions WHERE user_id = NEW.id AND type = 'grant' AND metadata->>'reason' = 'Initial Sign Up Bonus') THEN
    INSERT INTO public.wallet_transactions (user_id, amount, type, metadata)
    VALUES (NEW.id, 1000, 'grant', '{"reason": "Initial Sign Up Bonus"}');
  END IF;

  RETURN NEW;
END;
$function$;

-- Give 1000 Blood Coins to all existing users retroactively
DO $$
DECLARE
    v_user record;
    v_count integer;
BEGIN
    FOR v_user IN (SELECT id FROM auth.users) LOOP
        -- Check if they already have an initial grant to prevent duplicates
        SELECT count(*) INTO v_count FROM public.wallet_transactions 
        WHERE user_id = v_user.id AND type = 'grant' AND metadata->>'reason' = 'Initial Sign Up Bonus';
        
        IF v_count = 0 THEN
            INSERT INTO public.wallet_transactions (user_id, amount, type, metadata)
            VALUES (v_user.id, 1000, 'grant', '{"reason": "Initial Sign Up Bonus"}');
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;
