ALTER TABLE public.matches
ADD COLUMN IF NOT EXISTS blood_coins_settled BOOLEAN DEFAULT false;

CREATE OR REPLACE FUNCTION public.settle_match_blood_coins(match_id UUID, payouts JSONB)
RETURNS JSON AS $$
DECLARE
    v_match record;
    v_item jsonb;
    v_sum numeric := 0;
    v_user_id uuid;
    v_amount numeric;
BEGIN
    -- Ensure match exists and is completed
    SELECT id, status, blood_coins_settled INTO v_match FROM public.matches WHERE id = match_id FOR UPDATE;
    
    IF v_match IS NULL THEN
        RAISE EXCEPTION 'Match not found';
    END IF;

    IF v_match.status != 'completed' THEN
        RAISE EXCEPTION 'Match is not completed yet';
    END IF;

    IF v_match.blood_coins_settled THEN
        RETURN json_build_object('success', true, 'message', 'Already settled');
    END IF;

    -- Validate that payouts sum to 0
    FOR v_item IN SELECT * FROM jsonb_array_elements(payouts) LOOP
        v_sum := v_sum + (v_item->>'amount')::numeric;
    END LOOP;

    -- Check if sum is zero
    IF ABS(v_sum) > 0.01 THEN
        RAISE EXCEPTION 'Payouts do not sum to zero (sum: %)', v_sum;
    END IF;

    -- Create Wallet Transactions
    FOR v_item IN SELECT * FROM jsonb_array_elements(payouts) LOOP
        v_user_id := (v_item->>'userId')::uuid;
        v_amount := ROUND((v_item->>'amount')::numeric);

        IF v_amount != 0 THEN
            INSERT INTO public.wallet_transactions (user_id, amount, type, reference_id, metadata)
            VALUES (
                v_user_id, 
                v_amount, 
                CASE WHEN v_amount > 0 THEN 'wager_win' ELSE 'wager_deduction' END,
                v_match.id,
                jsonb_build_object('match_id', v_match.id, 'settlement_type', 'auto')
            );
        END IF;
    END LOOP;

    -- Mark match as settled
    UPDATE public.matches SET blood_coins_settled = true WHERE id = match_id;

    RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
