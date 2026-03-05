-- Create store_items table
CREATE TABLE IF NOT EXISTS public.store_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    blood_coin_price INTEGER NOT NULL CHECK (blood_coin_price > 0),
    category TEXT NOT NULL,
    stock_count INTEGER DEFAULT -1, -- -1 means unlimited
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS for store_items
ALTER TABLE public.store_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active store items"
    ON public.store_items FOR SELECT
    USING (is_active = true);

-- Create redemptions table
CREATE TYPE redemption_status AS ENUM ('pending', 'fulfilled', 'cancelled');

CREATE TABLE IF NOT EXISTS public.redemptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    item_id UUID REFERENCES public.store_items(id) ON DELETE RESTRICT,
    status redemption_status DEFAULT 'pending',
    purchase_price INTEGER NOT NULL, -- Snapshot the price at time of purchase
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS for redemptions
ALTER TABLE public.redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own redemptions"
    ON public.redemptions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own redemptions (via RPC)"
    ON public.redemptions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Create the redemption RPC
CREATE OR REPLACE FUNCTION redeem_blood_coins(p_user_id UUID, p_item_id UUID)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_item RECORD;
    v_balance INTEGER;
    v_new_redemption_id UUID;
BEGIN
    -- 1. Check if item exists and is active
    SELECT * INTO v_item FROM public.store_items WHERE id = p_item_id AND is_active = true;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Item not found or no longer available.';
    END IF;

    -- 2. Check stock
    IF v_item.stock_count = 0 THEN
        RAISE EXCEPTION 'Item is out of stock.';
    END IF;

    -- 3. Check user balance using existing function if possible, or direct query
    SELECT COALESCE(SUM(amount), 0) INTO v_balance FROM public.wallet_transactions WHERE user_id = p_user_id;
    
    IF v_balance < v_item.blood_coin_price THEN
        RAISE EXCEPTION 'Insufficient Blood Coins. Balance: %, Required: %', v_balance, v_item.blood_coin_price;
    END IF;

    -- 4. Execute the transaction
    
    -- a. Deduct coins
    INSERT INTO public.wallet_transactions (user_id, amount, match_id, type)
    VALUES (p_user_id, -(v_item.blood_coin_price), NULL, 'redemption');

    -- b. Decrement stock if not unlimited
    IF v_item.stock_count > 0 THEN
        UPDATE public.store_items 
        SET stock_count = stock_count - 1, updated_at = now()
        WHERE id = p_item_id;
    END IF;

    -- c. Create redemption record
    INSERT INTO public.redemptions (user_id, item_id, status, purchase_price)
    VALUES (p_user_id, p_item_id, 'pending', v_item.blood_coin_price)
    RETURNING id INTO v_new_redemption_id;

    RETURN json_build_object(
        'success', true,
        'redemption_id', v_new_redemption_id,
        'new_balance', v_balance - v_item.blood_coin_price
    );
EXCEPTION 
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$;

