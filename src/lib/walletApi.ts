import { supabase } from './supabase';

export interface WalletTransaction {
    id: string;
    user_id: string;
    amount: number;
    type: 'grant' | 'wager_deduction' | 'wager_win' | 'transfer_sent' | 'transfer_received' | 'redemption';
    reference_id?: string;
    metadata?: any;
    created_at: string;
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
