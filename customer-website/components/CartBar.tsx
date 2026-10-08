'use client';

import { useState } from 'react';
import { ArrowRight, Minus, Plus, X } from 'lucide-react';
import { useCart } from './CartContext';
import useDialog from './useDialog';

export default function CartBar() {
  const { items, totalItems, totalPrice, addItem, removeItem } = useCart();
  const [isOpen, setIsOpen] = useState(false);
  const dialogRef = useDialog(isOpen, () => setIsOpen(false));

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
        <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Review your selection" className="cart-sheet fixed inset-x-0 bottom-0 z-50 mx-auto max-w-3xl animate-slideUp">
          <div className="rounded-t-lg border-t border-slate-100 bg-white/95 pb-6 shadow-2xl backdrop-blur-xl">
            {/* Handle bar for bottom sheet feel */}
            <div className="flex justify-center py-3">
              <div className="h-1.5 w-12 rounded-full bg-slate-200" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-6 pb-4 border-b border-slate-100">
              <h2 className="text-xl font-semibold  text-slate-800">Your Selection</h2>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-colors"
                aria-label="Close"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>

            {/* Items List */}
            <div className="max-h-[45vh] overflow-y-auto px-6 py-4">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="cart-item flex items-center justify-between border-b border-slate-50 py-4 last:border-0"
                >
                  <div className="min-w-0 flex flex-1 items-center gap-3">
                    <span
                      className={`inline-flex h-5 w-5 items-center justify-center rounded-lg border-2 ${
                        item.badge === 'veg' ? 'border-teal-700 bg-emerald-50' : 'border-rose-600 bg-rose-50'
                      }`}
                    >
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${
                          item.badge === 'veg' ? 'bg-teal-700' : 'bg-rose-600'
                        }`}
                      />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-800 leading-tight">{item.name}</p>
                      <p className="text-xs text-slate-500 font-bold mt-1">₹{item.price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
                    </div>
                  </div>

                  {/* Quantity controls */}
                  <div className="shrink-0 flex items-center gap-0 overflow-hidden rounded-md border border-teal-700 bg-teal-700 shadow-md shadow-emerald-500/5">
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="flex h-11 w-11 items-center justify-center text-white hover:bg-teal-800 active:scale-90 transition-all"
                      aria-label={`Decrease ${item.name}`}
                    >
                      <Minus size={16} aria-hidden="true" />
                    </button>
                    <span className="flex h-11 w-11 items-center justify-center bg-white text-xs font-semibold text-emerald-600">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => addItem({ id: item.id, name: item.name, price: item.price, badge: item.badge })}
                      className="flex h-11 w-11 items-center justify-center text-white hover:bg-teal-800 active:scale-90 transition-all"
                      aria-label={`Increase ${item.name}`}
                    >
                      <Plus size={16} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="border-t border-slate-100 px-6 pt-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-base font-semibold text-slate-800">Total Amount</p>
                  <p className="text-xs text-slate-400 font-bold mt-0.5">{totalItems} {totalItems === 1 ? 'item' : 'items'} selected</p>
                </div>
                <p className="text-2xl font-semibold text-slate-900">₹{totalPrice.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
              </div>
              
              {/* Table QR Ordering Notice */}
              <div className="mt-4 rounded-lg bg-amber-50 border border-amber-100/80 p-3 text-center">
                <p className="text-xs font-semibold text-amber-800 leading-normal">
                  This is a browse-only selection. Table ordering is available through your table QR.
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
              className="cart-launcher flex w-full items-center justify-between rounded-lg bg-teal-700 px-6 py-4 shadow-xl  transition-all duration-300 hover:bg-teal-800 hover:shadow-2xl active:scale-[0.98]"
            >
              <div className="flex flex-col text-left">
                <span className="text-sm font-semibold text-white leading-tight">
                  {totalItems} {totalItems === 1 ? 'item' : 'items'}
                </span>
                <span className="text-xs text-emerald-100 font-bold mt-0.5">
                  ₹{totalPrice.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm font-semibold text-white ">
                View Selection
                <ArrowRight size={18} aria-hidden="true" />
              </div>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
