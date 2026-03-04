import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { Debt, Payment } from '../types';

interface LedgerState {
    debtsOwedByMe: Debt[];
    debtsOwedToMe: Debt[];
    payments: Payment[];
    paymentHistory: Payment[];
    isLoading: boolean;
    error: string | null;

    loadDebts: (userId: string) => Promise<void>;
    createDebt: (matchId: string, debtorId: string, creditorId: string, amount: number) => Promise<Debt | null>;
    requestPaymentInfo: (debtId: string) => Promise<void>;
    providePaymentInfo: (paymentId: string, method: Payment['method'], address: string) => Promise<void>;
    submitPayment: (paymentId: string, amount: number) => Promise<void>;
    confirmPayment: (paymentId: string) => Promise<void>;
    settleWithCash: (debtId: string, amount: number) => Promise<void>;
}

export const useLedgerStore = create<LedgerState>((set, get) => ({
    debtsOwedByMe: [],
    debtsOwedToMe: [],
    payments: [],
    paymentHistory: [],
    isLoading: false,
    error: null,

    loadDebts: async (userId: string) => {
        set({ isLoading: true, error: null });
        try {
            // Fetch debts where user is debtor
            const { data: owedByMeData, error: err1 } = await supabase
                .from('debts')
                .select(`
                    *,
                    creditor:profiles!debts_creditor_id_fkey(id, full_name, avatar_url)
                `)
                .eq('debtor_id', userId)
                .in('status', ['pending', 'partial'])
                .order('created_at', { ascending: false });

            if (err1) throw err1;

            // Fetch debts where user is creditor
            const { data: owedToMeData, error: err2 } = await supabase
                .from('debts')
                .select(`
                    *,
                    debtor:profiles!debts_debtor_id_fkey(id, full_name, avatar_url)
                `)
                .eq('creditor_id', userId)
                .in('status', ['pending', 'partial'])
                .order('created_at', { ascending: false });

            if (err2) throw err2;

            // Fetch related payments for all these debts
            const allDebtIds = [
                ...(owedByMeData || []).map(d => d.id),
                ...(owedToMeData || []).map(d => d.id)
            ];

            let paymentsData: any[] = [];
            if (allDebtIds.length > 0) {
                const { data: pData, error: err3 } = await supabase
                    .from('payments')
                    .select('*')
                    .in('debt_id', allDebtIds)
                    .in('status', ['requested_info', 'pending_confirmation'])
                    .order('created_at', { ascending: true });

                if (err3) throw err3;
                if (pData) paymentsData = pData;
            }

            // Fetch payment history (confirmed payments involving user)
            const { data: historyData, error: err4 } = await supabase
                .from('payments')
                .select(`
                    *,
                    payer:profiles!payments_payer_id_fkey(id, full_name, avatar_url),
                    receiver:profiles!payments_receiver_id_fkey(id, full_name, avatar_url)
                `)
                .or(`payer_id.eq.${userId},receiver_id.eq.${userId}`)
                .eq('status', 'confirmed')
                .order('updated_at', { ascending: false })
                .limit(50);

            if (err4) throw err4;

            // Map keys
            const mapDebt = (d: any): Debt => ({
                id: d.id,
                matchId: d.match_id,
                debtorId: d.debtor_id,
                creditorId: d.creditor_id,
                originalAmount: Number(d.original_amount),
                remainingAmount: Number(d.remaining_amount),
                status: d.status,
                createdAt: d.created_at,
                updatedAt: d.updated_at,
                debtor: d.debtor ? {
                    id: d.debtor.id,
                    fullName: d.debtor.full_name,
                    avatarUrl: d.debtor.avatar_url
                } : undefined,
                creditor: d.creditor ? {
                    id: d.creditor.id,
                    fullName: d.creditor.full_name,
                    avatarUrl: d.creditor.avatar_url
                } : undefined
            });

            const mapPayment = (p: any): Payment => ({
                id: p.id,
                debtId: p.debt_id,
                payerId: p.payer_id,
                receiverId: p.receiver_id,
                amount: Number(p.amount),
                method: p.method,
                paymentAddress: p.payment_address,
                status: p.status,
                createdAt: p.created_at,
                updatedAt: p.updated_at,
                payer: p.payer ? {
                    id: p.payer.id,
                    fullName: p.payer.full_name,
                    avatarUrl: p.payer.avatar_url
                } : undefined,
                receiver: p.receiver ? {
                    id: p.receiver.id,
                    fullName: p.receiver.full_name,
                    avatarUrl: p.receiver.avatar_url
                } : undefined
            });

            set({
                debtsOwedByMe: (owedByMeData || []).map(mapDebt),
                debtsOwedToMe: (owedToMeData || []).map(mapDebt),
                payments: paymentsData.map(mapPayment),
                paymentHistory: (historyData || []).map(mapPayment),
                isLoading: false
            });

        } catch (error: any) {
            console.error("Error loading debts:", error);
            set({ error: error.message, isLoading: false });
        }
    },

    createDebt: async (matchId, debtorId, creditorId, amount) => {
        set({ isLoading: true, error: null });
        try {
            const { error } = await supabase
                .from('debts')
                .insert([{
                    match_id: matchId,
                    debtor_id: debtorId,
                    creditor_id: creditorId,
                    original_amount: amount,
                    remaining_amount: amount,
                    status: 'pending'
                }])
                .select()
                .single();

            if (error) throw error;

            // Reload to get joined relations
            await get().loadDebts(debtorId);

            set({ isLoading: false });
            return null; // The exact mapping isn't as important as reloading the state
        } catch (error: any) {
            console.error("Error creating debt:", error);
            set({ error: error.message, isLoading: false });
            return null;
        }
    },

    // Debtor hits "Settle Up", sends a notification/creates a payment request
    requestPaymentInfo: async (debtId) => {
        set({ isLoading: true, error: null });
        try {
            const debt = get().debtsOwedByMe.find(d => d.id === debtId);
            if (!debt) throw new Error("Debt not found");

            const { error } = await supabase
                .from('payments')
                .insert([{
                    debt_id: debtId,
                    payer_id: debt.debtorId,
                    receiver_id: debt.creditorId,
                    amount: debt.remainingAmount, // default to remaining amount, will be finalized when submitting
                    method: 'other', // temporary until creditor provides info
                    status: 'requested_info'
                }]);

            if (error) throw error;

            await get().loadDebts(debt.debtorId);
            set({ isLoading: false });
        } catch (error: any) {
            set({ error: error.message, isLoading: false });
        }
    },

    // Creditor provides their Venmo/E-Transfer
    providePaymentInfo: async (paymentId, method, address) => {
        set({ isLoading: true, error: null });
        try {
            const { error } = await supabase
                .from('payments')
                .update({
                    method,
                    payment_address: address,
                    // keep status as requested_info until debtor actually pays?
                    // actually, let's keep it requested_info or move to a new status like 'ready_for_payment'. 
                    // Let's just keep 'requested_info' and UI knows it's ready if address is not null
                })
                .eq('id', paymentId);

            if (error) throw error;

            const myId = get().debtsOwedToMe[0]?.creditorId || get().debtsOwedByMe[0]?.debtorId;
            if (myId) await get().loadDebts(myId);

            set({ isLoading: false });
        } catch (error: any) {
            set({ error: error.message, isLoading: false });
        }
    },

    // Debtor has sent the money via Venmo/E-Transfer and clicks "I Sent It"
    submitPayment: async (paymentId, amountSent) => {
        set({ isLoading: true, error: null });
        try {
            const { error } = await supabase
                .from('payments')
                .update({
                    amount: amountSent,
                    status: 'pending_confirmation'
                })
                .eq('id', paymentId);

            if (error) throw error;

            const myId = get().debtsOwedByMe[0]?.debtorId || get().debtsOwedToMe[0]?.creditorId;
            if (myId) await get().loadDebts(myId);

            set({ isLoading: false });
        } catch (error: any) {
            set({ error: error.message, isLoading: false });
        }
    },

    // Creditor confirms receipt, updates debt remaining amount
    confirmPayment: async (paymentId) => {
        set({ isLoading: true, error: null });
        try {
            const payment = get().payments.find(p => p.id === paymentId);
            if (!payment) throw new Error("Payment not found");

            const debt = get().debtsOwedToMe.find(d => d.id === payment.debtId);
            if (!debt) throw new Error("Debt not found");

            const newRemaining = Math.max(0, debt.remainingAmount - payment.amount);
            const newStatus = newRemaining === 0 ? 'settled' : 'partial';

            // 1. Update debt
            const { error: debtErr } = await supabase
                .from('debts')
                .update({
                    remaining_amount: newRemaining,
                    status: newStatus
                })
                .eq('id', debt.id);
            if (debtErr) throw debtErr;

            // 2. Update payment status
            const { error: payErr } = await supabase
                .from('payments')
                .update({ status: 'confirmed' })
                .eq('id', paymentId);
            if (payErr) throw payErr;

            const myId = get().debtsOwedToMe[0]?.creditorId || get().debtsOwedByMe[0]?.debtorId;
            if (myId) await get().loadDebts(myId);

            set({ isLoading: false });
        } catch (error: any) {
            set({ error: error.message, isLoading: false });
        }
    },

    // Debtor bypassed transfer flow and handed over cash
    settleWithCash: async (debtId, amount) => {
        set({ isLoading: true, error: null });
        try {
            const debt = get().debtsOwedByMe.find(d => d.id === debtId);
            if (!debt) throw new Error("Debt not found");

            const { error } = await supabase
                .from('payments')
                .insert([{
                    debt_id: debtId,
                    payer_id: debt.debtorId,
                    receiver_id: debt.creditorId,
                    amount: amount,
                    method: 'cash',
                    status: 'pending_confirmation'
                }]);

            if (error) throw error;

            await get().loadDebts(debt.debtorId);
            set({ isLoading: false });
        } catch (error: any) {
            set({ error: error.message, isLoading: false });
        }
    }
}));
