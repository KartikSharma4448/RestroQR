'use client';

import { useState } from 'react';
import { useCart } from './CartContext';

interface OrderCartBarProps {
  tableToken: string;
  restaurantToken: string;
}

export default function OrderCartBar({ tableToken, restaurantToken }: OrderCartBarProps) {
  const { items, totalItems, totalPrice, addItem, removeItem, clearCart } = useCart();
  const [isOpen, setIsOpen] = useState(false);
  const [isPlacing, setIsPlacing] = useState(false);
  const [orderResult, setOrderResult] = useState<{
    orderRef: string;
    total: string;
    items: { name: string; quantity: number; price: string }[];
  } | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);

  if (totalItems === 0 && !orderResult) return null;

  // Show order confirmation modal
  if (orderResult) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 backdrop-blur-sm">
        <div className="w-full max-w-sm rounded-[2rem] border border-white/10 bg-white p-6 shadow-2xl animate-scaleUp">
          {/* Success icon container */}
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 border-4 border-white shadow-xl shadow-emerald-500/10">
            <svg className="h-9 w-9 text-emerald-600 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h2 className="text-center text-2xl font-black text-slate-800 tracking-tight">Order Placed!</h2>
          <p className="mt-1.5 text-center text-sm text-slate-400 font-semibold">
            Order Reference: <span className="font-extrabold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-lg">{orderResult.orderRef}</span>
          </p>

          {/* Order summary card */}
          <div className="mt-6 rounded-2xl bg-slate-50 border border-slate-100 p-4">
            {orderResult.items.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between py-2 text-sm border-b border-slate-200/40 last:border-0">
                <span className="text-slate-600 font-bold">{item.name} <span className="text-slate-400 font-medium">× {item.quantity}</span></span>
                <span className="font-black text-slate-800">₹{parseFloat(item.price).toFixed(0)}</span>
              </div>
            ))}
            <div className="mt-3 border-t border-slate-200/80 pt-3">
              <div className="flex items-center justify-between text-base font-black">
                <span className="text-slate-800">Total Amount</span>
                <span className="text-slate-900">₹{parseFloat(orderResult.total).toFixed(0)}</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setOrderResult(null)}
            className="mt-6 w-full rounded-2xl bg-slate-900 py-3.5 text-sm font-black text-white shadow-lg transition-all hover:bg-slate-800 active:scale-[0.98]"
          >
            Order More Dishes
          </button>
        </div>
      </div>
    );
  }

  const handlePlaceOrder = async () => {
    if (items.length === 0 || isPlacing) return;

    setIsPlacing(true);
    setOrderError(null);

    try {
      const savedPhone = localStorage.getItem('loyalty_phone');
      const savedName = localStorage.getItem('loyalty_name');

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://restroqr-api.onrender.com';
      const response = await fetch(`${apiUrl}/api/public/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableToken,
          items: items.map((item) => ({
            itemId: item.id,
            quantity: item.quantity,
          })),
          customerName: savedName || undefined,
          customerPhone: savedPhone || undefined,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        const message = errorBody?.error?.message || 'Something went wrong. Please try again.';
        setOrderError(message);
        setIsPlacing(false);
        return;
      }

      const result = await response.json();
      setOrderResult(result.data);
      clearCart();
      setIsOpen(false);
    } catch {
      setOrderError('Network error. Please check your connection and try again.');
    } finally {
      setIsPlacing(false);
    }
  };

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
            {/* Handle bar */}
            <div className="flex justify-center py-3">
              <div className="h-1.5 w-12 rounded-full bg-slate-200" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-6 pb-4 border-b border-slate-100">
              <h2 className="text-xl font-black tracking-tight text-slate-800">Review Your Order</h2>
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

            {/* Error message */}
            {orderError && (
              <div className="mx-6 rounded-2xl bg-rose-50 border border-rose-100 px-4 py-3 text-xs font-bold text-rose-700">
                ⚠️ {orderError}
              </div>
            )}

            {/* Total + Place Order button */}
            <div className="border-t border-slate-100 px-6 pt-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-base font-black text-slate-800">Total Amount</p>
                  <p className="text-xs text-slate-400 font-bold mt-0.5">{totalItems} {totalItems === 1 ? 'item' : 'items'} selected</p>
                </div>
                <p className="text-2xl font-black text-slate-900">₹{totalPrice.toFixed(0)}</p>
              </div>
              <button
                type="button"
                onClick={handlePlaceOrder}
                disabled={isPlacing}
                className="w-full rounded-2xl bg-orange-500 py-4 text-sm font-black text-white shadow-xl shadow-orange-500/25 transition-all hover:bg-orange-600 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isPlacing ? 'Sending Order to Kitchen...' : 'Place Order'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Cart Bar with Place Order */}
      {!isOpen && (
        <div className="fixed inset-x-0 bottom-0 z-50 animate-slideUp">
          <div className="mx-auto max-w-3xl px-4 pb-6">
            <button
              type="button"
              onClick={() => setIsOpen(true)}
              className="flex w-full items-center justify-between rounded-2xl bg-orange-500 px-6 py-4 shadow-xl shadow-orange-600/25 transition-all duration-300 hover:bg-orange-600 hover:shadow-2xl active:scale-[0.98]"
            >
              <div className="flex flex-col text-left">
                <span className="text-sm font-black text-white leading-tight">
                  {totalItems} {totalItems === 1 ? 'item' : 'items'}
                </span>
                <span className="text-xs text-orange-100 font-bold mt-0.5">
                  ₹{totalPrice.toFixed(0)}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm font-black text-white tracking-tight">
                Review &amp; Place Order
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
