-- Create wallet_transactions table
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('grant', 'wager_deduction', 'wager_win', 'transfer_sent', 'transfer_received', 'redemption')),
    reference_id UUID,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for querying balances and history
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_id ON public.wallet_transactions(user_id);

-- Enable RLS
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

-- Users can only read their own transactions
CREATE POLICY "Users can view their own wallet transactions"
    ON public.wallet_transactions FOR SELECT
    USING (auth.uid() = user_id);

-- Create a view for easy balance querying
CREATE OR REPLACE VIEW public.user_blood_coin_balances AS
SELECT
    user_id,
    COALESCE(SUM(amount), 0) as balance
FROM
    public.wallet_transactions
GROUP BY
    user_id;

-- Initial grant function for new users or existing users
CREATE OR REPLACE FUNCTION grant_initial_blood_coins()
RETURNS json AS $$
DECLARE
    v_user record;
    v_count integer;
    v_granted integer := 0;
BEGIN
    FOR v_user IN (SELECT id FROM auth.users) LOOP
        SELECT count(*) INTO v_count FROM public.wallet_transactions WHERE user_id = v_user.id AND type = 'grant';
        IF v_count = 0 THEN
            INSERT INTO public.wallet_transactions (user_id, amount, type, metadata)
            VALUES (v_user.id, 1000, 'grant', '{"reason": "Initial Sign Up Bonus"}');
            v_granted := v_granted + 1;
        END IF;
    END LOOP;
    RETURN json_build_object('success', true, 'users_granted', v_granted);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
