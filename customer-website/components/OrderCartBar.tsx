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

  // Show order confirmation
  if (orderResult) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
        <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
          {/* Success icon */}
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h2 className="text-center text-xl font-bold text-gray-900">Order Placed!</h2>
          <p className="mt-1 text-center text-sm text-gray-500">
            Your order reference: <span className="font-semibold text-gray-900">{orderResult.orderRef}</span>
          </p>

          {/* Order summary */}
          <div className="mt-4 rounded-lg bg-gray-50 p-3">
            {orderResult.items.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between py-1.5 text-sm">
                <span className="text-gray-700">{item.name} × {item.quantity}</span>
                <span className="font-medium text-gray-900">₹{parseFloat(item.price).toFixed(0)}</span>
              </div>
            ))}
            <div className="mt-2 border-t border-gray-200 pt-2">
              <div className="flex items-center justify-between text-base font-bold">
                <span className="text-gray-900">Total</span>
                <span className="text-gray-900">₹{parseFloat(orderResult.total).toFixed(0)}</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setOrderResult(null)}
            className="mt-5 w-full rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold text-white shadow transition hover:bg-green-700 active:scale-[0.98]"
          >
            Order More
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
      // Clear the cart after successful order
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
              <h2 className="text-lg font-bold text-gray-900">Your Order</h2>
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

            {/* Error message */}
            {orderError && (
              <div className="mx-5 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                {orderError}
              </div>
            )}

            {/* Total + Place Order button */}
            <div className="border-t border-gray-100 px-5 py-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-base font-bold text-gray-900">Total</p>
                  <p className="text-xs text-gray-500">{totalItems} {totalItems === 1 ? 'item' : 'items'}</p>
                </div>
                <p className="text-xl font-bold text-gray-900">₹{totalPrice.toFixed(0)}</p>
              </div>
              <button
                type="button"
                onClick={handlePlaceOrder}
                disabled={isPlacing}
                className="w-full rounded-xl bg-orange-500 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-orange-500/30 transition hover:bg-orange-600 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isPlacing ? 'Placing Order...' : 'Place Order'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Cart Bar with Place Order */}
      {!isOpen && (
        <div className="fixed inset-x-0 bottom-0 z-50 animate-slideUp">
          <div className="mx-auto max-w-3xl px-4 pb-4">
            <button
              type="button"
              onClick={() => setIsOpen(true)}
              className="flex w-full items-center justify-between rounded-2xl bg-orange-500 px-5 py-3.5 shadow-2xl shadow-orange-500/30 transition hover:bg-orange-600 active:scale-[0.98]"
            >
              <div className="flex flex-col text-left">
                <span className="text-sm font-bold text-white">
                  {totalItems} {totalItems === 1 ? 'item' : 'items'}
                </span>
                <span className="text-xs text-orange-100">
                  ₹{totalPrice.toFixed(0)}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                Place Order
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
