'use client';

import { useState, useEffect, useCallback } from 'react';

interface LoyaltyStarsCardProps {
  restaurantToken: string;
}

interface LoyaltyData {
  name: string | null;
  completedVisits: number;
  starsCount: number;
  rewardUnlocked: boolean;
  visitsToNextReward: number;
}

export default function LoyaltyStarsCard({ restaurantToken }: LoyaltyStarsCardProps) {
  const [phone, setPhone] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [data, setData] = useState<LoyaltyData | null>(null);
  const [loading, setLoading] = useState(false);
  const [isPromptOpen, setIsPromptOpen] = useState(false);

  const fetchLoyalty = useCallback(async (clientPhone: string) => {
    setLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://restroqr-api.onrender.com';
      const response = await fetch(
        `${apiUrl}/api/public/loyalty/${clientPhone}?restaurantToken=${restaurantToken}`
      );
      if (response.ok) {
        const result = await response.json();
        setData(result.data);
      }
    } catch (e) {
      console.error('Failed to fetch loyalty status:', e);
    } finally {
      setLoading(false);
    }
  }, [restaurantToken]);

  const loadLocalData = useCallback(() => {
    const savedPhone = localStorage.getItem('loyalty_phone');
    const savedName = localStorage.getItem('loyalty_name');
    
    if (savedPhone) {
      setPhone(savedPhone);
      setName(savedName);
      fetchLoyalty(savedPhone);
    } else {
      setPhone(null);
      setName(null);
      setData(null);
    }
  }, [fetchLoyalty]);

  useEffect(() => {
    loadLocalData();

    // Listen to local storage changes (so modal submit updates this card)
    const handleStorageChange = () => loadLocalData();
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [loadLocalData]);

  // Periodic polling for status changes (e.g. when order is completed by the owner app)
  useEffect(() => {
    if (!phone) return;
    const interval = setInterval(() => {
      fetchLoyalty(phone);
    }, 12000); // Poll every 12 seconds
    return () => clearInterval(interval);
  }, [phone, fetchLoyalty]);

  if (!phone) {
    return (
      <div className="mx-4 mb-6 rounded-3xl border border-dashed border-amber-300 bg-amber-50/20 p-5 text-center">
        <h3 className="text-sm font-black text-amber-800">🎁 Star Visit Rewards</h3>
        <p className="mt-1 text-xs text-slate-500 font-semibold leading-relaxed">
          Order 6 times from our tables & unlock a free treat on us!
        </p>
        <button
          type="button"
          onClick={() => {
            // Trigger storage event manually to show prompt modal
            localStorage.removeItem('loyalty_skipped');
            localStorage.removeItem('loyalty_phone');
            window.dispatchEvent(new Event('storage'));
            // Force page reload to trigger modal
            window.location.reload();
          }}
          className="mt-3.5 inline-flex items-center justify-center rounded-xl bg-amber-500 px-5 py-2.5 text-xs font-black text-white shadow-md shadow-amber-500/10 hover:bg-amber-600 active:scale-95 transition-all"
        >
          Join Rewards Program
        </button>
      </div>
    );
  }

  const activeStars = data ? data.starsCount : 0;
  const totalVisits = data ? data.completedVisits : 0;
  const isRewardUnlocked = data ? data.rewardUnlocked : false;
  const displayName = name || (data ? data.name : '') || 'Guest';

  return (
    <div className="mx-4 mb-6 overflow-hidden rounded-3xl border border-slate-100 bg-white p-5 shadow-lg shadow-slate-100/50">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider">Loyalty Progress</h3>
          <p className="text-base font-black text-slate-800 mt-0.5">Welcome back, {displayName}! 👋</p>
        </div>
        <div className="rounded-xl bg-slate-50 border border-slate-200/50 px-2.5 py-1 text-center">
          <p className="text-[10px] font-black text-slate-400 uppercase">Visits</p>
          <p className="text-sm font-black text-slate-800">{totalVisits}</p>
        </div>
      </div>

      {/* Stars row */}
      <div className="mt-5 flex items-center justify-between gap-2.5 rounded-2xl bg-slate-50/50 border border-slate-100 p-4">
        {[1, 2, 3, 4, 5, 6].map((starIndex) => {
          const isFilled = starIndex <= activeStars;
          return (
            <div
              key={starIndex}
              className={`flex h-10 w-10 items-center justify-center rounded-xl border text-xl transition-all duration-300 ${
                isFilled
                  ? 'bg-amber-500 border-amber-600 text-white shadow-md shadow-amber-500/20 scale-105'
                  : 'bg-slate-100/50 border-slate-200/50 text-slate-300'
              }`}
            >
              ★
            </div>
          );
        })}
      </div>

      {/* Summary message */}
      <div className="mt-4 text-center">
        {loading && !data ? (
          <p className="text-xs font-bold text-slate-400">Syncing visits...</p>
        ) : isRewardUnlocked ? (
          <div className="rounded-2xl bg-emerald-50 border border-emerald-100/80 p-3 animate-pulse">
            <p className="text-xs font-black text-emerald-800 leading-normal">
              🎉 <strong>Loyalty Reward Unlocked!</strong> Claim your free reward item at the billing counter! 🥤🍰
            </p>
          </div>
        ) : (
          <p className="text-xs text-slate-500 font-bold leading-normal">
            ⭐️ {activeStars} of 6 visits completed. {6 - activeStars} more order completions to unlock your free treat!
          </p>
        )}
      </div>
    </div>
  );
}
