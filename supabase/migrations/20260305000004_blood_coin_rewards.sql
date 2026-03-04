-- Add 'reward' to wallet transaction types
ALTER TABLE public.wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_type_check;
ALTER TABLE public.wallet_transactions ADD CONSTRAINT wallet_transactions_type_check 
    CHECK (type IN ('grant', 'wager_deduction', 'wager_win', 'transfer_sent', 'transfer_received', 'redemption', 'reward', 'admin_adjustment'));

-- Create reward claims table to prevent double-dipping
CREATE TABLE IF NOT EXISTS public.blood_coin_reward_claims (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
    hole_number INTEGER, -- NULL for round completion rewards
    reward_type VARCHAR(50) NOT NULL, -- 'birdie', 'eagle', 'sandie', 'round_completion'
    amount NUMERIC NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, match_id, hole_number, reward_type)
);

-- Enable RLS
ALTER TABLE public.blood_coin_reward_claims ENABLE ROW LEVEL SECURITY;

-- Users can only see their own claims
CREATE POLICY "Users can view their own reward claims"
    ON public.blood_coin_reward_claims FOR SELECT
    USING (auth.uid() = user_id);

-- RPC to process rewards atomically
CREATE OR REPLACE FUNCTION public.process_blood_coin_reward(
    p_user_id UUID,
    p_match_id UUID,
    p_hole_number INTEGER,
    p_reward_type VARCHAR,
    p_amount NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_claim_id UUID;
BEGIN
    -- 1. Check if reward already claimed
    IF EXISTS (
        SELECT 1 FROM public.blood_coin_reward_claims 
        WHERE user_id = p_user_id 
          AND match_id = p_match_id 
          AND (hole_number = p_hole_number OR (hole_number IS NULL AND p_hole_number IS NULL))
          AND reward_type = p_reward_type
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Already claimed');
    END IF;

    -- 2. Insert claim
    INSERT INTO public.blood_coin_reward_claims (user_id, match_id, hole_number, reward_type, amount)
    VALUES (p_user_id, p_match_id, p_hole_number, p_reward_type, p_amount)
    RETURNING id INTO v_claim_id;

    -- 3. Insert transaction
    INSERT INTO public.wallet_transactions (user_id, amount, type, reference_id, metadata)
    VALUES (
        p_user_id, 
        p_amount, 
        'reward', 
        p_match_id, 
        jsonb_build_object(
            'reward_type', p_reward_type,
            'hole_number', p_hole_number,
            'claim_id', v_claim_id
        )
    );

    RETURN jsonb_build_object('success', true, 'claim_id', v_claim_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
