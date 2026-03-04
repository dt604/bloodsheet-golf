-- Ensure is_admin column exists on profiles
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'is_admin') THEN
        ALTER TABLE public.profiles ADD COLUMN is_admin BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Set Dan (admin_id from previous migrations) as admin
UPDATE public.profiles SET is_admin = TRUE WHERE id = '0175505e-7d16-4d58-9160-f2503e04242c';

-- Admin adjustment RPC
CREATE OR REPLACE FUNCTION admin_adjust_blood_coins(
    target_user_id UUID,
    adjustment_amount NUMERIC,
    adjustment_reason TEXT
)
RETURNS JSON AS $$
DECLARE
    caller_is_admin BOOLEAN;
    new_transaction_id UUID;
BEGIN
    -- 1. Security Check: Verify the caller is an admin
    SELECT is_admin INTO caller_is_admin FROM public.profiles WHERE id = auth.uid();
    
    IF NOT caller_is_admin THEN
        RAISE EXCEPTION 'Unauthorized: Only administrators can adjust balances.';
    END IF;

    -- 2. Record the transaction
    INSERT INTO public.wallet_transactions (
        user_id, 
        amount, 
        type, 
        metadata
    )
    VALUES (
        target_user_id, 
        adjustment_amount, 
        'grant', -- Using 'grant' for consistency, but with metadata reason
        jsonb_build_object(
            'reason', adjustment_reason,
            'admin_id', auth.uid(),
            'adjustment_type', 'admin_manual'
        )
    )
    RETURNING id INTO new_transaction_id;

    RETURN json_build_object(
        'success', true, 
        'transaction_id', new_transaction_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
