import pool from '../config/database';

export interface LoyaltyStatusResult {
  phone: string;
  name: string | null;
  completedVisits: number;
  starsCount: number; // visit_count % 6
  rewardUnlocked: boolean;
  visitsToNextReward: number;
}

/**
 * Fetches the loyalty status of a customer based on their phone number and restaurant ID.
 * Calculates visit counts based on orders marked completed or payment_received.
 */
export async function getLoyaltyStatus(
  restaurantId: string,
  phone: string
): Promise<LoyaltyStatusResult> {
  const cleanPhone = phone.trim();

  // 1. Get the count of completed visits
  const countResult = await pool.query(
    `SELECT COUNT(*)::int as completed_visits
     FROM orders
     WHERE restaurant_id = $1 
       AND customer_phone = $2 
       AND status IN ('completed', 'payment_received')`,
    [restaurantId, cleanPhone]
  );
  
  const completedVisits = countResult.rows[0]?.completed_visits || 0;

  // 2. Fetch the latest customer name used
  const nameResult = await pool.query(
    `SELECT customer_name
     FROM orders
     WHERE restaurant_id = $1 
       AND customer_phone = $2 
       AND customer_name IS NOT NULL 
       AND customer_name != ''
     ORDER BY created_at DESC
     LIMIT 1`,
    [restaurantId, cleanPhone]
  );

  const name = nameResult.rows[0]?.customer_name || null;

  // Visit reward milestone is every 6 visits
  const starsCount = completedVisits % 6;
  
  // Unlocked reward is true if they have completed a milestone (at least 6 visits and starsCount is 0)
  // Or more simply: if they just finished 6, 12, 18, etc. visits.
  // We can treat it as unlocked if they have at least 1 completed milestone and have completed their latest set of 6.
  const rewardUnlocked = completedVisits > 0 && starsCount === 0;
  const visitsToNextReward = 6 - starsCount;

  return {
    phone: cleanPhone,
    name,
    completedVisits,
    starsCount,
    rewardUnlocked,
    visitsToNextReward,
  };
}
