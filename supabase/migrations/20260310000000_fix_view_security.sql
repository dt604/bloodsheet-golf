-- Fixing Supabase Security Warning: View defined with SECURITY DEFINER property
-- This migration updates the user_blood_coin_balances view to use security_invoker = true
-- ensuring that the RLS of the querying user is applied.

CREATE OR REPLACE VIEW public.user_blood_coin_balances 
WITH (security_invoker = true)
AS
SELECT
    user_id,
    COALESCE(SUM(amount), 0) as balance
FROM
    public.wallet_transactions
GROUP BY
    user_id;
