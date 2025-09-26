import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// XP rates and economics configuration
export const XP_CONFIG = {
  // Earning rates
  XP_PER_KM: 1,
  XP_PER_ZONE_CREATION: 10,
  XP_BONUS_FIRST_ZONE: 50,
  XP_REFERRAL_BONUS: 500,
  XP_NEW_USER_REFERRAL_BONUS: 100,
  
  // Spending/costs
  ZONE_CREATION_FEE: 5,
  ZONE_RENT_PERCENTAGE: 0.1, // 10% of zone value
  UNAUTHORIZED_ENTRY_PENALTY_MULTIPLIER: 2,
  
  // Limits
  MAX_DAILY_EARNINGS: 100,
  MIN_BALANCE_FOR_ZONE_CREATION: 10,
  
  // Conversion rates (future)
  XP_TO_TOKEN_RATE: 1000, // 1000 XP = 1 SRXP token
};

export interface XPTransaction {
  id: string;
  user_id: string;
  amount: number;
  type: string;
  description: string;
  metadata?: any;
  created_at: string;
}

export interface XPBalance {
  userId: string;
  balance: number;
  totalEarned: number;
  totalSpent: number;
  lastUpdated: Date;
}

// Get user's current XP balance
export async function getUserXPBalance(userId: string): Promise<number> {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('xp')
      .eq('id', userId)
      .single();
    
    return profile?.xp || 0;
  } catch (error) {
    console.error('Error fetching XP balance:', error);
    return 0;
  }
}

// Award XP to user
export async function awardXP(
  userId: string,
  amount: number,
  type: string,
  description: string,
  metadata?: any
): Promise<{ success: boolean; newBalance?: number; error?: string }> {
  try {
    // Get current balance
    const currentBalance = await getUserXPBalance(userId);
    const newBalance = currentBalance + amount;
    
    // Start transaction
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ xp: newBalance })
      .eq('id', userId);
    
    if (updateError) throw updateError;
    
    // Log transaction
    const { error: txError } = await supabase
      .from('xp_transactions')
      .insert({
        user_id: userId,
        amount,
        type,
        description,
        metadata
      });
    
    if (txError) console.error('Error logging XP transaction:', txError);
    
    return { success: true, newBalance };
  } catch (error) {
    console.error('Error awarding XP:', error);
    return { success: false, error: error.message };
  }
}

// Spend XP (for zone creation, etc.)
export async function spendXP(
  userId: string,
  amount: number,
  type: string,
  description: string,
  metadata?: any
): Promise<{ success: boolean; newBalance?: number; error?: string }> {
  try {
    // Get current balance
    const currentBalance = await getUserXPBalance(userId);
    
    // Check sufficient balance
    if (currentBalance < amount) {
      return {
        success: false,
        error: `Insufficient XP balance. You have ${currentBalance} XP, need ${amount} XP.`
      };
    }
    
    const newBalance = currentBalance - amount;
    
    // Update balance
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ xp: newBalance })
      .eq('id', userId);
    
    if (updateError) throw updateError;
    
    // Log transaction
    const { error: txError } = await supabase
      .from('xp_transactions')
      .insert({
        user_id: userId,
        amount: -amount,
        type,
        description,
        metadata
      });
    
    if (txError) console.error('Error logging XP transaction:', txError);
    
    return { success: true, newBalance };
  } catch (error) {
    console.error('Error spending XP:', error);
    return { success: false, error: error.message };
  }
}

// Process zone rent payment
export async function payZoneRent(
  renterId: string,
  ownerId: string,
  zoneId: string,
  rentAmount: number
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check renter balance
    const renterBalance = await getUserXPBalance(renterId);
    if (renterBalance < rentAmount) {
      return {
        success: false,
        error: `Insufficient XP for rent. You have ${renterBalance} XP, need ${rentAmount} XP.`
      };
    }
    
    // Deduct from renter
    const { success: deductSuccess, error: deductError } = await spendXP(
      renterId,
      rentAmount,
      'rent',
      `Zone rent payment for zone ${zoneId}`,
      { zoneId, ownerId }
    );
    
    if (!deductSuccess) {
      return { success: false, error: deductError };
    }
    
    // Credit to owner
    const { success: creditSuccess, error: creditError } = await awardXP(
      ownerId,
      rentAmount,
      'rent',
      `Zone rent received for zone ${zoneId}`,
      { zoneId, renterId }
    );
    
    if (!creditSuccess) {
      // Attempt to refund renter if credit fails
      await awardXP(
        renterId,
        rentAmount,
        'refund',
        `Rent refund for zone ${zoneId}`,
        { zoneId, reason: 'owner_credit_failed' }
      );
      return { success: false, error: creditError };
    }
    
    // Log rental transaction
    const { error: rentalError } = await supabase
      .from('transactions')
      .insert({
        from_user_id: renterId,
        to_user_id: ownerId,
        amount: rentAmount,
        type: 'rent',
        region_id: zoneId,
        status: 'completed',
        metadata: { timestamp: new Date().toISOString() }
      });
    
    if (rentalError) console.error('Error logging rental:', rentalError);
    
    return { success: true };
  } catch (error) {
    console.error('Error processing rent payment:', error);
    return { success: false, error: error.message };
  }
}

// Apply unauthorized entry penalty
export async function applyUnauthorizedEntryPenalty(
  userId: string,
  zoneId: string,
  baseRentAmount: number
): Promise<{ success: boolean; penaltyAmount?: number; error?: string }> {
  try {
    const penaltyAmount = baseRentAmount * XP_CONFIG.UNAUTHORIZED_ENTRY_PENALTY_MULTIPLIER;
    const currentBalance = await getUserXPBalance(userId);
    
    if (currentBalance >= penaltyAmount) {
      // Can pay penalty
      const { success, newBalance, error } = await spendXP(
        userId,
        penaltyAmount,
        'penalty',
        `Unauthorized zone entry penalty for zone ${zoneId}`,
        { zoneId, baseRent: baseRentAmount }
      );
      
      if (success) {
        toast.error(`Penalty applied: ${penaltyAmount} XP deducted for unauthorized entry`);
      }
      
      return { success, penaltyAmount, error };
    } else {
      // Record debt
      const debtAmount = penaltyAmount - currentBalance;
      
      // Set balance to 0
      await supabase
        .from('profiles')
        .update({ xp: 0 })
        .eq('id', userId);
      
      // Log debt transaction
      await supabase
        .from('xp_transactions')
        .insert({
          user_id: userId,
          amount: -penaltyAmount,
          type: 'penalty',
          description: `Unauthorized entry penalty (${debtAmount} XP debt)`,
          metadata: { zoneId, debt: debtAmount }
        });
      
      toast.error(`Penalty: Balance set to 0. You owe ${debtAmount} XP.`);
      
      return {
        success: true,
        penaltyAmount,
        error: `Insufficient balance. ${debtAmount} XP debt recorded.`
      };
    }
  } catch (error) {
    console.error('Error applying penalty:', error);
    return { success: false, error: error.message };
  }
}

// Calculate XP for run completion
export function calculateRunXP(distanceKm: number, duration: number): number {
  const baseXP = Math.floor(distanceKm * XP_CONFIG.XP_PER_KM);
  
  // Bonus for longer runs
  let bonusXP = 0;
  if (distanceKm >= 10) bonusXP += 10;
  if (distanceKm >= 20) bonusXP += 20;
  
  // Speed bonus (if maintaining good pace)
  const avgSpeedKmh = (distanceKm / duration) * 3600;
  if (avgSpeedKmh >= 8 && avgSpeedKmh <= 15) {
    bonusXP += 5;
  }
  
  return baseXP + bonusXP;
}

// Get user's XP transaction history
export async function getUserXPHistory(
  userId: string,
  limit: number = 20
): Promise<XPTransaction[]> {
  try {
    const { data, error } = await supabase
      .from('xp_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    
    return data || [];
  } catch (error) {
    console.error('Error fetching XP history:', error);
    return [];
  }
}

// Check daily earning limit
export async function checkDailyEarningLimit(userId: string): Promise<{
  canEarn: boolean;
  earnedToday: number;
  remaining: number;
}> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const { data, error } = await supabase
      .from('xp_transactions')
      .select('amount')
      .eq('user_id', userId)
      .gte('created_at', today.toISOString())
      .in('type', ['earn', 'bonus', 'referral']);
    
    if (error) throw error;
    
    const earnedToday = (data || [])
      .reduce((sum, tx) => sum + (tx.amount > 0 ? tx.amount : 0), 0);
    
    const remaining = Math.max(0, XP_CONFIG.MAX_DAILY_EARNINGS - earnedToday);
    
    return {
      canEarn: earnedToday < XP_CONFIG.MAX_DAILY_EARNINGS,
      earnedToday,
      remaining
    };
  } catch (error) {
    console.error('Error checking daily limit:', error);
    return {
      canEarn: true,
      earnedToday: 0,
      remaining: XP_CONFIG.MAX_DAILY_EARNINGS
    };
  }
}

// Process referral bonus
export async function processReferralBonus(
  referrerId: string,
  newUserId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Award bonus to referrer
    await awardXP(
      referrerId,
      XP_CONFIG.XP_REFERRAL_BONUS,
      'referral',
      'Referral bonus for inviting a new user',
      { referredUserId: newUserId }
    );
    
    // Award bonus to new user
    await awardXP(
      newUserId,
      XP_CONFIG.XP_NEW_USER_REFERRAL_BONUS,
      'bonus',
      'Welcome bonus for using referral code',
      { referrerId }
    );
    
    // Update referrer stats
    const { data: referrerProfile } = await supabase
      .from('profiles')
      .select('referral_count, referral_xp_earned')
      .eq('id', referrerId)
      .single();
    
    if (referrerProfile) {
      await supabase
        .from('profiles')
        .update({
          referral_count: (referrerProfile.referral_count || 0) + 1,
          referral_xp_earned: (referrerProfile.referral_xp_earned || 0) + XP_CONFIG.XP_REFERRAL_BONUS
        })
        .eq('id', referrerId);
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error processing referral bonus:', error);
    return { success: false, error: error.message };
  }
}