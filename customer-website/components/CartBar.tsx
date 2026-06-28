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
          className="fixed inset-0 z-50 bg-black/50 transition-opacity"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Bottom Sheet */}
      {isOpen && (
        <div className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-3xl animate-slideUp">
          <div className="rounded-t-2xl bg-white shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <h2 className="text-lg font-bold text-gray-900">Your Selection</h2>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-full p-1.5 text-gray-500 hover:bg-gray-100"
                aria-label="Close"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Items List */}
            <div className="max-h-[50vh] overflow-y-auto px-5 py-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between border-b border-gray-50 py-3 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex h-4 w-4 items-center justify-center rounded-sm border-2 ${
                        item.badge === 'veg' ? 'border-green-600' : 'border-red-600'
                      }`}
                    >
                      <span
                        className={`h-2 w-2 rounded-full ${
                          item.badge === 'veg' ? 'bg-green-600' : 'bg-red-600'
                        }`}
                      />
                    </span>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{item.name}</p>
                      <p className="text-xs text-gray-500">₹{item.price.toFixed(0)}</p>
                    </div>
                  </div>

                  {/* Quantity controls */}
                  <div className="flex items-center gap-0 overflow-hidden rounded-lg border border-green-600">
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="flex h-7 w-7 items-center justify-center bg-green-600 text-white hover:bg-green-700"
                      aria-label={`Decrease ${item.name}`}
                    >
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M20 12H4" />
                      </svg>
                    </button>
                    <span className="flex h-7 w-7 items-center justify-center bg-white text-xs font-bold text-green-600">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => addItem({ id: item.id, name: item.name, price: item.price, badge: item.badge })}
                      className="flex h-7 w-7 items-center justify-center bg-green-600 text-white hover:bg-green-700"
                      aria-label={`Increase ${item.name}`}
                    >
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="border-t border-gray-100 px-5 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-base font-bold text-gray-900">Total</p>
                  <p className="text-xs text-gray-500">{totalItems} {totalItems === 1 ? 'item' : 'items'}</p>
                </div>
                <p className="text-xl font-bold text-gray-900">₹{totalPrice.toFixed(0)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Cart Bar */}
      {!isOpen && (
        <div className="fixed inset-x-0 bottom-0 z-50 animate-slideUp">
          <div className="mx-auto max-w-3xl px-4 pb-4">
            <button
              type="button"
              onClick={() => setIsOpen(true)}
              className="flex w-full items-center justify-between rounded-2xl bg-green-600 px-5 py-3.5 shadow-2xl shadow-green-600/30 transition hover:bg-green-700 active:scale-[0.98]"
            >
              <div className="flex flex-col text-left">
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
            </button>
          </div>
        </div>
      )}
    </>
  );
}
