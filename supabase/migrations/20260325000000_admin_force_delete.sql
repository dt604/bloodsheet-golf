-- ─── Admin Force Delete Functions ────────────────────────────────────────────
-- These run as SECURITY DEFINER so they bypass RLS and can delete any record.
-- Only callable by is_admin users (enforced in the function body).

-- Force-delete a match and all related records regardless of debt/payment state
CREATE OR REPLACE FUNCTION public.force_delete_match(p_match_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify caller is an admin
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'Unauthorized: admin only';
  END IF;

  -- Delete payments tied to debts for this match
  DELETE FROM public.payments
  WHERE debt_id IN (SELECT id FROM public.debts WHERE match_id = p_match_id);

  -- Delete debts for this match
  DELETE FROM public.debts WHERE match_id = p_match_id;

  -- Delete the match (cascades to hole_scores, match_players, presses,
  -- match_attestations, match_media via ON DELETE CASCADE)
  DELETE FROM public.matches WHERE id = p_match_id;
END;
$$;

-- Force-delete a user and all their related financial records
CREATE OR REPLACE FUNCTION public.force_delete_user(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify caller is an admin
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'Unauthorized: admin only';
  END IF;

  -- Delete payments where user is payer or receiver
  DELETE FROM public.payments
  WHERE payer_id = p_user_id OR receiver_id = p_user_id;

  -- Delete debts where user is debtor or creditor
  DELETE FROM public.debts
  WHERE debtor_id = p_user_id OR creditor_id = p_user_id;

  -- Delete the auth user (cascades to profiles, wallet_transactions, etc.)
  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$;

-- Bulk version for users
CREATE OR REPLACE FUNCTION public.force_delete_users_bulk(p_user_ids UUID[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'Unauthorized: admin only';
  END IF;

  DELETE FROM public.payments
  WHERE payer_id = ANY(p_user_ids) OR receiver_id = ANY(p_user_ids);

  DELETE FROM public.debts
  WHERE debtor_id = ANY(p_user_ids) OR creditor_id = ANY(p_user_ids);

  DELETE FROM auth.users WHERE id = ANY(p_user_ids);
END;
$$;

-- Revoke public execute, grant only to authenticated
REVOKE EXECUTE ON FUNCTION public.force_delete_match(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.force_delete_user(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.force_delete_users_bulk(UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.force_delete_match(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.force_delete_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.force_delete_users_bulk(UUID[]) TO authenticated;
