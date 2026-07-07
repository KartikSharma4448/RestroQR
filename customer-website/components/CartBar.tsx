'use client';

import { useState } from 'react';
import { useCart } from './CartContext';

export default function CartBar() {
  const { items, totalItems, totalPrice, addItem, removeItem } = useCart();
  const [isOpen, setIsOpen] = useState(false);

  if (totalItems === 0) return null;

  return (
    <>
      {/* Bottom Sheet Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm transition-opacity duration-300"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Bottom Sheet */}
      {isOpen && (
        <div className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-3xl animate-slideUp">
          <div className="rounded-t-[2.5rem] border-t border-slate-100 bg-white/95 pb-6 shadow-2xl backdrop-blur-xl">
            {/* Handle bar for bottom sheet feel */}
            <div className="flex justify-center py-3">
              <div className="h-1.5 w-12 rounded-full bg-slate-200" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-6 pb-4 border-b border-slate-100">
              <h2 className="text-xl font-black tracking-tight text-slate-800">Your Selection</h2>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-colors"
                aria-label="Close"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Items List */}
            <div className="max-h-[45vh] overflow-y-auto px-6 py-4">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between border-b border-slate-50 py-4 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex h-5 w-5 items-center justify-center rounded-lg border-2 ${
                        item.badge === 'veg' ? 'border-emerald-600 bg-emerald-50' : 'border-rose-600 bg-rose-50'
                      }`}
                    >
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${
                          item.badge === 'veg' ? 'bg-emerald-600' : 'bg-rose-600'
                        }`}
                      />
                    </span>
                    <div>
                      <p className="text-sm font-extrabold text-slate-800 leading-tight">{item.name}</p>
                      <p className="text-xs text-slate-500 font-bold mt-1">₹{item.price.toFixed(0)}</p>
                    </div>
                  </div>

                  {/* Quantity controls */}
                  <div className="flex items-center gap-0 overflow-hidden rounded-xl border border-emerald-600 bg-emerald-600 shadow-md shadow-emerald-500/5">
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="flex h-8 w-8 items-center justify-center text-white hover:bg-emerald-700 active:scale-90 transition-all"
                      aria-label={`Decrease ${item.name}`}
                    >
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3.5} d="M20 12H4" />
                      </svg>
                    </button>
                    <span className="flex h-8 w-8 items-center justify-center bg-white text-xs font-black text-emerald-600">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => addItem({ id: item.id, name: item.name, price: item.price, badge: item.badge })}
                      className="flex h-8 w-8 items-center justify-center text-white hover:bg-emerald-700 active:scale-90 transition-all"
                      aria-label={`Increase ${item.name}`}
                    >
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3.5} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="border-t border-slate-100 px-6 pt-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-base font-black text-slate-800">Total Amount</p>
                  <p className="text-xs text-slate-400 font-bold mt-0.5">{totalItems} {totalItems === 1 ? 'item' : 'items'} selected</p>
                </div>
                <p className="text-2xl font-black text-slate-900">₹{totalPrice.toFixed(0)}</p>
              </div>
              
              {/* Table QR Ordering Notice */}
              <div className="mt-4 rounded-2xl bg-amber-50 border border-amber-100/80 p-3 text-center">
                <p className="text-xs font-black text-amber-800 leading-normal">
                  📢 Phone se order place karne ke liye table par lage QR code ko scan karein. Ye checkouts/view-only menu hai.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Cart Bar */}
      {!isOpen && (
        <div className="fixed inset-x-0 bottom-0 z-50 animate-slideUp">
          <div className="mx-auto max-w-3xl px-4 pb-6">
            <button
              type="button"
              onClick={() => setIsOpen(true)}
              className="flex w-full items-center justify-between rounded-2xl bg-emerald-600 px-6 py-4 shadow-xl shadow-emerald-700/25 transition-all duration-300 hover:bg-emerald-700 hover:shadow-2xl active:scale-[0.98]"
            >
              <div className="flex flex-col text-left">
                <span className="text-sm font-black text-white leading-tight">
                  {totalItems} {totalItems === 1 ? 'item' : 'items'}
                </span>
                <span className="text-xs text-emerald-100 font-bold mt-0.5">
                  ₹{totalPrice.toFixed(0)}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm font-black text-white tracking-tight">
                View Selection
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
