/**
 * Balance Calculation Fix
 * Transaction history'den doğru balance hesaplama
 */

import { supabase } from '@/lib/supabaseClient';

/**
 * Transaction type'ların balance'a effect'ini döndürür
 */
function getTransactionEffect(type: string, amount: number): number {
  // Normalize amount (some transactions stored as negative already)
  const normalizedAmount = Math.abs(amount);
  
  switch (type.toLowerCase()) {
    // Income transactions
    case 'mining_reward':
    case 'reward': 
    case 'task_reward':
    case 'task_reward_claimed':
    case 'deposit':
    case 'daily_bonus':
    case 'garage_bonus':
      return normalizedAmount; // ADD to balance
      
    // Expense transactions  
    case 'purchase_car':
    case 'purchase_garage':
    case 'repair':
    case 'repair_car':
    case 'refill':
    case 'refill_car':
    case 'expense':
    case 'withdraw':
      return -normalizedAmount; // SUBTRACT from balance
      
    default:
      console.warn(`[BalanceFixer] Unknown transaction type: ${type}`);
      // Eğer amount zaten negatifse (expense), olduğu gibi kullan
      // Eğer amount pozitifse (income), olduğu gibi kullan
      return amount >= 0 ? normalizedAmount : -normalizedAmount;
  }
}

/**
 * Kullanıcının gerçek balance'ını transaction history'den hesapla
 */
export async function calculateTrueBalance(userId: string): Promise<{
  currentBalance: number;
  calculatedBalance: number;
  difference: number;
  transactionCount: number;
  lastTransactionDate: string;
}> {
  
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('balance, created_at')
    .eq('id', userId)
    .single();
    
  if (userError) throw userError;

  const { data: transactions, error: txError } = await supabase
    .from('transactions')
    .select('type, amount, date, status')
    .eq('user_id', userId)
    .eq('status', 'confirmed')
    .order('date', { ascending: true });
    
  if (txError) throw txError;

  if (!transactions || transactions.length === 0) {
    return {
      currentBalance: user.balance,
      calculatedBalance: 1000, // Initial balance
      difference: user.balance - 1000,
      transactionCount: 0,
      lastTransactionDate: user.created_at
    };
  }

  // Calculate balance from transaction history
  let calculatedBalance = 1000; // Starting balance
  
  transactions.forEach(tx => {
    const effect = getTransactionEffect(tx.type, tx.amount);
    calculatedBalance += effect;
  });

  return {
    currentBalance: user.balance,
    calculatedBalance,
    difference: user.balance - calculatedBalance,
    transactionCount: transactions.length,
    lastTransactionDate: transactions[transactions.length - 1]?.date || user.created_at
  };
}

/**
 * Balance audit raporu
 */
export async function auditUserBalance(userId: string): Promise<{
  isConsistent: boolean;
  analysis: any;
  recommendations: string[];
}> {
  
  const analysis = await calculateTrueBalance(userId);
  const recommendations: string[] = [];
  
  // Major inconsistency check
  if (Math.abs(analysis.difference) > 1000) {
    recommendations.push('🚨 Major balance inconsistency detected');
    recommendations.push('Contact support for balance recovery');
  } else if (Math.abs(analysis.difference) > 100) {
    recommendations.push('⚠️ Minor balance inconsistency');
    recommendations.push('Monitor for further discrepancies');
  }
  
  // Transaction pattern analysis
  if (analysis.transactionCount > 500) {
    recommendations.push('📊 High transaction volume - consider archiving old data');
  }
  
  const isConsistent = Math.abs(analysis.difference) <= 10; // 10 NMFP tolerance
  
  return {
    isConsistent,
    analysis,
    recommendations
  };
}
