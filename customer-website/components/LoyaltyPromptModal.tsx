'use client';

import { useState, useEffect } from 'react';
import { Star } from 'lucide-react';
import useDialog from './useDialog';

interface LoyaltyPromptModalProps {
  onJoin: (name: string, phone: string) => void;
  onSkip: () => void;
}

export default function LoyaltyPromptModal({ onJoin, onSkip }: LoyaltyPromptModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const dialogRef = useDialog(isOpen, () => {
    localStorage.setItem('loyalty_skipped', 'true');
    onSkip();
    setIsOpen(false);
  });

  // Check if they already filled this before
  useEffect(() => {
    const savedPhone = localStorage.getItem('loyalty_phone');
    if (!savedPhone && localStorage.getItem('loyalty_skipped') !== 'true') {
      // Small delay for clean entrance animation
      const timer = setTimeout(() => setIsOpen(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Please enter your name');
      return;
    }

    if (!phone || !/^\d{10}$/.test(phone.trim())) {
      setError('Please enter a valid 10-digit phone number');
      return;
    }

    const cleanPhone = phone.trim();
    const cleanName = name.trim();

    localStorage.setItem('loyalty_phone', cleanPhone);
    localStorage.setItem('loyalty_name', cleanName);
    
    onJoin(cleanName, cleanPhone);
    setIsOpen(false);
  };

  const handleSkipAction = () => {
    localStorage.setItem('loyalty_skipped', 'true');
    onSkip();
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="loyalty-title" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="max-h-[90svh] overflow-y-auto w-full max-w-md rounded-lg border border-white/10 bg-white p-6 shadow-2xl animate-scaleUp">
        {/* Sparkle Icon */}
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-md bg-amber-50 border border-amber-200/50">
          <Star size={25} className="text-teal-700" aria-hidden="true" />
        </div>

        <h2 id="loyalty-title" className="text-center text-xl font-semibold text-slate-800 ">Join Our Rewards!</h2>
        <p className="mt-1 text-center text-xs text-slate-500 font-bold leading-normal">
          Complete 6 visits at our restaurant and unlock a free treat on us!
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="loyalty-name" className="block text-xs font-semibold text-slate-500 uppercase  mb-1.5">
              Your Name
            </label>
            <input
              id="loyalty-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Kartik Sharma"
              className="w-full rounded-md border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:border-teal-700 focus:bg-white focus:outline-none focus:ring-4 focus:ring-teal-700/10 transition-all duration-200"
            />
          </div>

          <div>
            <label htmlFor="loyalty-phone" className="block text-xs font-semibold text-slate-500 uppercase  mb-1.5">
              Phone Number
            </label>
            <input
              id="loyalty-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="10-digit mobile number"
              maxLength={10}
              className="w-full rounded-md border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:border-teal-700 focus:bg-white focus:outline-none focus:ring-4 focus:ring-teal-700/10 transition-all duration-200"
            />
          </div>

          {error && (
            <div className="rounded-md bg-rose-50 border border-rose-100 px-4 py-2.5 text-xs font-bold text-rose-700">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-2 pt-2">
            <button
              type="submit"
              className="w-full rounded-md bg-teal-700 py-3.5 text-sm font-semibold text-white shadow-lg  transition-all hover:bg-teal-800 active:scale-[0.98]"
            >
              Join Loyalty Program
            </button>
            
            <button
              type="button"
              onClick={handleSkipAction}
              className="w-full rounded-md py-3 text-xs font-bold text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all"
            >
              Maybe Later, Just View Menu
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
