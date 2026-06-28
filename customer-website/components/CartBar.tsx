'use client';

import { useCart } from './CartContext';

export default function CartBar() {
  const { items, totalItems, totalPrice } = useCart();

  if (totalItems === 0) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 animate-slideUp">
      <div className="mx-auto max-w-3xl px-4 pb-4">
        <div className="flex items-center justify-between rounded-2xl bg-green-600 px-5 py-3.5 shadow-2xl shadow-green-600/30">
          <div className="flex flex-col">
            <span className="text-sm font-bold text-white">
              {totalItems} {totalItems === 1 ? 'item' : 'items'}
            </span>
            <span className="text-xs text-green-100">
              ₹{totalPrice.toFixed(0)}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            View Selection
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
