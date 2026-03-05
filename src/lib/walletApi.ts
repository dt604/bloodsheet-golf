import { supabase } from './supabase';

export interface WalletTransaction {
    id: string;
    user_id: string;
    amount: number;
    type: 'grant' | 'wager_deduction' | 'wager_win' | 'transfer_sent' | 'transfer_received' | 'redemption' | 'admin_adjustment';
    reference_id?: string;
    metadata?: any;
    created_at: string;
}

export interface StoreItem {
    id: string;
    name: string;
    description: string;
    image_url: string;
    blood_coin_price: number;
    category: string;
    stock_count: number;
    is_active: boolean;
}

export interface RedemptionResult {
    success: boolean;
    redemption_id?: string;
    new_balance?: number;
    error?: string;
}

export async function getBloodCoinBalance(userId: string): Promise<number> {
    const { data, error } = await supabase
        .from('user_blood_coin_balances')
        .select('balance')
        .eq('user_id', userId)
        .single();

    if (error) {
        if (error.code === 'PGRST116') {
            // No balance entry means 0 balance
            return 0;
        }
        console.error("Error fetching balance:", error);
        return 0;
    }

    return Number(data?.balance || 0);
}

export async function fetchRecentTransactions(userId: string): Promise<WalletTransaction[]> {
    const { data, error } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);

    if (error) {
        console.error("Error fetching transactions:", error);
        return [];
    }

    return data as WalletTransaction[];
}

export async function getStoreItems(): Promise<StoreItem[]> {
    const { data, error } = await supabase
        .from('store_items')
        .select('*')
        .eq('is_active', true)
        .order('blood_coin_price', { ascending: true });

    if (error) {
        console.error("Error fetching store items:", error);
        return [];
    }

    return data as StoreItem[];
}

export async function redeemBloodCoins(userId: string, itemId: string): Promise<RedemptionResult> {
    const { data, error } = await supabase.rpc('redeem_blood_coins', {
        p_user_id: userId,
        p_item_id: itemId
    });

    if (error) {
        console.error("RPC Error in redeem_blood_coins:", error);
        return { success: false, error: error.message };
    }

    // The RPC returns a JSON object matching RedemptionResult
    return data as RedemptionResult;
}
