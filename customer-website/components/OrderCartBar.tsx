'use client';

import { useEffect, useRef, useState } from 'react';
import OrderPayment, { type PaymentAccess } from './OrderPayment';
import { ArrowRight, Check, Minus, Plus, X } from 'lucide-react';
import { MAX_ITEM_QUANTITY, useCart } from './CartContext';
import useDialog from './useDialog';

interface OrderCartBarProps {
  tableToken: string;
  restaurantToken: string;
  customerEmailRequired?: boolean;
}

export default function OrderCartBar({ tableToken, restaurantToken, customerEmailRequired = false }: OrderCartBarProps) {
  const { items, totalItems, totalPrice, addItem, removeItem, clearCart } = useCart();
  const [isOpen, setIsOpen] = useState(false);
  const [isPlacing, setIsPlacing] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const checkoutRequest = useRef<{ fingerprint: string; id: string } | null>(null);
  const [orderResult, setOrderResult] = useState<{
    orderRef: string;
    total: string;
    emailConfirmation?: string;
    payment?: PaymentAccess;
    items: { name: string; quantity: number; price: string; optionSummary?: string }[];
  } | null>(null);
  const [recentOrder,setRecentOrder] = useState<typeof orderResult>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const savedKey = `restroqr-payment:${restaurantToken}:${tableToken}`;
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(savedKey);
      if (saved) {
        const value = JSON.parse(saved);
        if (typeof value.orderRef === 'string' && typeof value.total === 'string' &&
            /^[0-9a-f-]{36}$/i.test(value.payment?.orderId || '') && /^[0-9a-f]{64}$/.test(value.payment?.token || '') && Array.isArray(value.items)) {
          setOrderResult(value); setRecentOrder(value);
        }
      }
    } catch { /* Checkout still works when browser storage is unavailable. */ }
  }, [savedKey]);
  const closeDialog = () => {
    if (isPlacing) return;
    setIsOpen(false);
    setOrderResult(null);
  };
  const dialogRef = useDialog(orderResult ? 'confirmation' : isOpen, closeDialog);

  if (totalItems === 0 && !orderResult) return recentOrder ? <div className="fixed inset-x-0 bottom-0 z-40 bg-white p-4 shadow-lg">
    <button type="button" onClick={() => setOrderResult(recentOrder)} className="mx-auto block w-full max-w-3xl rounded-md bg-teal-700 px-4 py-3 font-semibold text-white">View last order &amp; payment</button>
  </div> : null;

  // Show order confirmation modal
  if (orderResult) {
    return (
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Order confirmation" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 backdrop-blur-sm">
        <div className="max-h-[90svh] overflow-y-auto w-full max-w-sm rounded-lg border border-white/10 bg-white p-6 shadow-2xl animate-scaleUp">
          {/* Success icon container */}
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 border-4 border-white shadow-xl shadow-emerald-500/10">
            <Check size={32} aria-hidden="true" />
          </div>

          <h2 className="text-center text-2xl font-semibold text-slate-800 ">Order Placed!</h2>
          <p className="mt-1.5 text-center text-sm text-slate-400 font-semibold">
            Order Reference: <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-lg">{orderResult.orderRef}</span>
          </p>
          {orderResult.emailConfirmation && <p role="status" className="mt-3 text-center text-sm text-slate-600">{orderResult.emailConfirmation === 'on_acceptance' ? 'Awaiting restaurant acceptance.' : 'Order confirmation email requested.'}</p>}

          {/* Order summary card */}
          <div className="mt-6 border-y border-slate-100 py-4">
            {orderResult.items.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between py-2 text-sm border-b border-slate-200/40 last:border-0">
                <span className="min-w-0 break-words pr-2 text-slate-600 font-bold">{item.name} <span className="text-slate-400 font-medium">× {item.quantity}</span>{item.optionSummary && <span className="block text-xs font-normal">{item.optionSummary}</span>}</span>
                <span className="font-semibold text-slate-800">₹{(Math.round(Number(item.price) * 100) * item.quantity / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
              </div>
            ))}
            <div className="mt-3 border-t border-slate-200/80 pt-3">
              <div className="flex items-center justify-between text-base font-semibold">
                <span className="text-slate-800">Total Amount</span>
                <span className="text-slate-900">₹{parseFloat(orderResult.total).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          {orderResult.payment && <OrderPayment access={orderResult.payment}/>}
          <button
            type="button"
            onClick={closeDialog}
            className="mt-6 w-full rounded-lg bg-slate-900 py-3.5 text-sm font-semibold text-white shadow-lg transition-all hover:bg-slate-800 active:scale-[0.98]"
          >
            Order More Dishes
          </button>
        </div>
      </div>
    );
  }

  const handlePlaceOrder = async () => {
    if (items.length === 0 || isPlacing) return;
    if (customerEmailRequired) {
      const emailInput = document.getElementById('order-customer-email') as HTMLInputElement | null;
      const phoneInput = document.getElementById('order-customer-phone') as HTMLInputElement | null;
      if (!emailInput?.reportValidity() || !phoneInput?.reportValidity()) return;
    }

    setIsPlacing(true);
    setOrderError(null);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://restroqr-api.onrender.com';
      const payload = {
        tableToken,
        ...(customerName.trim() ? { customerName: customerName.trim() } : {}),
        ...(customerEmailRequired ? { customerEmail: customerEmail.trim().toLowerCase(),
          ...(customerPhone.trim() ? { customerPhone: customerPhone.trim() } : {}) } : {}),
        items: items.map(item => ({ itemId: item.foodItemId || item.id, quantity: item.quantity,
          ...(item.variantId ? { variantId: item.variantId } : {}),
          ...(item.addOnIds?.length ? { addOnIds: item.addOnIds } : {}) })),
      };
      const fingerprint = JSON.stringify(payload);
      if (customerEmailRequired && checkoutRequest.current?.fingerprint !== fingerprint) {
        checkoutRequest.current = { fingerprint, id: crypto.randomUUID() };
      }
      const response = await fetch(`${apiUrl}/api/public/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, ...(customerEmailRequired ? { requestId: checkoutRequest.current!.id } : {}) }),
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
      if (result.data.payment) {
        setRecentOrder(result.data);
        try { sessionStorage.setItem(savedKey,JSON.stringify(result.data)); } catch { /* Optional session persistence. */ }
      }
      clearCart();
      setCustomerName('');
      setCustomerEmail('');
      setCustomerPhone('');
      checkoutRequest.current = null;
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
          onClick={closeDialog}
          aria-hidden="true"
        />
      )}

      {/* Bottom Sheet */}
      {isOpen && (
        <div ref={dialogRef} role="dialog" aria-modal="true" aria-busy={isPlacing} tabIndex={-1} aria-label="Review your order" className="cart-sheet fixed inset-x-0 bottom-0 z-50 mx-auto max-w-3xl animate-slideUp">
          <div className="rounded-t-lg border-t border-slate-100 bg-white/95 pb-6 shadow-2xl backdrop-blur-xl">
            {/* Handle bar */}
            <div className="flex justify-center py-3">
              <div className="h-1.5 w-12 rounded-full bg-slate-200" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-6 pb-4 border-b border-slate-100">
              <h2 className="text-xl font-semibold  text-slate-800">Review Your Order</h2>
              <button
                type="button"
                onClick={closeDialog}
                disabled={isPlacing}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                      {item.optionSummary && <p className="mt-1 break-words text-xs text-slate-600">{item.optionSummary}</p>}
                      <p className="text-xs text-slate-500 font-bold mt-1">₹{item.price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
                    </div>
                  </div>

                  {/* Quantity controls */}
                  <div className="shrink-0 flex items-center gap-0 overflow-hidden rounded-md border border-teal-700 bg-teal-700 shadow-md shadow-emerald-500/5">
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      disabled={isPlacing}
                      className="flex h-11 w-11 items-center justify-center text-white hover:bg-teal-800 active:scale-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      aria-label={`Decrease ${item.name}`}
                    >
                      <Minus size={16} aria-hidden="true" />
                    </button>
                    <span className="flex h-11 w-11 items-center justify-center bg-white text-xs font-semibold text-emerald-600">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => addItem(item)}
                      disabled={isPlacing || item.quantity >= MAX_ITEM_QUANTITY}
                      title={item.quantity >= MAX_ITEM_QUANTITY ? `Maximum quantity: ${MAX_ITEM_QUANTITY}` : 'Increase quantity'}
                      className="flex h-11 w-11 items-center justify-center text-white hover:bg-teal-800 active:scale-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      aria-label={`Increase ${item.name}`}
                    >
                      <Plus size={16} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="px-6 pb-4">
              {customerEmailRequired && <>
                <label htmlFor="order-customer-email" className="block text-sm font-semibold text-slate-800">Email for order confirmation</label>
                <input id="order-customer-email" type="email" required maxLength={254} autoComplete="email"
                  value={customerEmail} onChange={event => setCustomerEmail(event.target.value)} disabled={isPlacing}
                  className="mb-4 mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 text-base text-slate-900" />
              </>}
              <label htmlFor="order-customer-name" className="block text-sm font-semibold text-slate-800">
                Your name <span className="font-normal text-slate-500">(optional)</span>
              </label>
              <input
                id="order-customer-name"
                type="text"
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                maxLength={100}
                autoComplete="off"
                disabled={isPlacing}
                aria-describedby="order-customer-name-privacy"
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 text-base text-slate-900 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/20 disabled:opacity-60"
              />
              <p id="order-customer-name-privacy" className="mt-2 text-xs text-slate-500">
                Shared with the restaurant. Only your initials appear on the public order board.
              </p>
              {customerEmailRequired && <>
                <label htmlFor="order-customer-phone" className="mt-4 block text-sm font-semibold text-slate-800">Mobile number <span className="font-normal text-slate-500">(optional)</span></label>
                <input id="order-customer-phone" type="tel" inputMode="numeric" pattern="[0-9]{10}" maxLength={10} autoComplete="tel-national"
                  value={customerPhone} onChange={event => setCustomerPhone(event.target.value)} disabled={isPlacing}
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 text-base text-slate-900" />
              </>}
            </div>

            {/* Error message */}
            {orderError && (
              <div role="alert" className="mx-6 rounded-lg bg-rose-50 border border-rose-100 px-4 py-3 text-xs font-bold text-rose-700">
                {orderError}
              </div>
            )}

            {/* Total + Place Order button */}
            <div className="border-t border-slate-100 px-6 pt-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-base font-semibold text-slate-800">Total Amount</p>
                  <p className="text-xs text-slate-400 font-bold mt-0.5">{totalItems} {totalItems === 1 ? 'item' : 'items'} selected</p>
                </div>
                <p className="text-2xl font-semibold text-slate-900">₹{totalPrice.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
              </div>
              <button
                type="button"
                onClick={handlePlaceOrder}
                disabled={isPlacing}
                className="w-full rounded-lg bg-teal-700 py-4 text-sm font-semibold text-white shadow-xl  transition-all hover:bg-teal-800 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
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
            {recentOrder && <button type="button" onClick={() => setOrderResult(recentOrder)} className="mb-2 w-full rounded-md border border-teal-700 bg-white px-4 py-2 text-sm font-semibold text-teal-800">View last order &amp; payment</button>}
            <button
              type="button"
              onClick={() => setIsOpen(true)}
              className="cart-launcher flex w-full items-center justify-between rounded-lg bg-teal-700 px-6 py-4 shadow-xl  transition-all duration-300 hover:bg-teal-800 hover:shadow-2xl active:scale-[0.98]"
            >
              <div className="flex flex-col text-left">
                <span className="text-sm font-semibold text-white leading-tight">
                  {totalItems} {totalItems === 1 ? 'item' : 'items'}
                </span>
                <span className="text-xs text-teal-50 font-bold mt-0.5">
                  ₹{totalPrice.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm font-semibold text-white ">
                Review &amp; Place Order
                <ArrowRight size={18} aria-hidden="true" />
              </div>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
